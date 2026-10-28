# ÁUREO — Arquitetura Técnica

**Versão documental:** 1.0
**Última revisão:** 28/10/2026
**Status:** Implementação local validada; implantação pública pendente
**Projeto:** ÁUREO — Plataforma de Leilões Online
**Desenvolvimento:** João Victor
**Apoio na análise técnica:** Kauã

## 1. Visão geral

O ÁUREO é uma aplicação full-stack de leilões online com gerenciamento de lotes, carteiras financeiras simuladas, lances concorrentes, atualizações em tempo real, liquidação e comprovantes públicos.

A arquitetura prioriza:

- Consistência financeira.
- Integridade transacional.
- Controle de concorrência.
- Autenticação e autorização.
- Separação de responsabilidades.
- Rastreabilidade de operações.
- Experiência do usuário.
- Testabilidade e manutenção.

O PostgreSQL é a fonte de verdade para saldos, reservas, lances, horários e liquidações.

O frontend não é responsável por decidir se uma operação financeira é válida.

## 2. Stack tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend | React, TypeScript, Vite |
| Navegação | React Router |
| Requisições HTTP | Axios |
| Estado remoto | TanStack React Query |
| Comunicação em tempo real | Socket.IO |
| Backend | Node.js, Express, TypeScript |
| Validação | Zod |
| Autenticação | JWT e bcryptjs |
| Sessões | Refresh tokens rotativos |
| Banco de dados | PostgreSQL 17 |
| ORM | Prisma 7 |
| Infraestrutura local | Docker Compose |
| Testes | Vitest e Supertest |
| Qualidade | TypeScript e ESLint |

## 3. Organização do repositório

```text
elite-leilao/
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── src/
│       ├── errors/
│       ├── lib/
│       ├── middlewares/
│       ├── realtime/
│       ├── routes/
│       ├── schemas/
│       ├── services/
│       ├── tests/
│       ├── app.ts
│       └── server.ts
├── frontend/
│   └── src/
│       ├── app/
│       ├── assets/
│       ├── components/
│       ├── constants/
│       ├── contexts/
│       ├── hooks/
│       ├── lib/
│       ├── pages/
│       ├── services/
│       ├── styles/
│       │   ├── components/
│       │   ├── global/
│       │   └── pages/
│       ├── types/
│       └── utils/
├── docs/
│   ├── ARCHITECTURE.md
│   └── DECISIONS.md
├── docker-compose.yml
└── README.md
```

A estrutura representa a implementação existente no repositório.

Alguns arquivos reservados para tratamento global de erros e centralização de rotas ainda estão vazios. Eles não devem ser interpretados como funcionalidades implementadas.

## 4. Arquitetura da aplicação

```text
                   FRONTEND
              React + TypeScript
                      |
              Axios / HTTP JSON
                      |
                      v
                 BACKEND
              Express + TypeScript
                      |
             Middlewares e Zod
                      |
                      v
                    Routes
                      |
                      v
                   Services
                      |
                      v
              Prisma / SQL
                      |
                      v
                 PostgreSQL


             COMUNICAÇÃO REALTIME

                  Socket.IO
                      |
             +--------+--------+
             |                 |
       Salas públicas    Salas privadas
          de lotes        por usuário
             |                 |
       lot:updated       wallet:updated
       lots:updated
```

### Responsabilidades

**Frontend:** interface, navegação, formulários, cache, estados de carregamento e apresentação dos dados.

**Routes:** recebem requisições, aplicam validações, chamam serviços e constroem respostas HTTP.

**Schemas:** validam dados de entrada utilizando Zod.

**Services:** implementam regras de negócio, consultas, transações e operações financeiras.

**Middlewares:** validam autenticação e autorização por papel.

**Prisma e PostgreSQL:** persistência, integridade e consistência transacional.

**Socket.IO:** distribui notificações após operações confirmadas.

Não foram introduzidas camadas independentes de controllers ou repositories porque, no escopo atual, as rotas e serviços já apresentam uma separação adequada.

## 5. Papéis e autorização

O sistema possui dois papéis.

### AUCTIONEER

O leiloeiro pode:

- Criar lotes.
- Importar informações de produtos.
- Consultar seus próprios lotes.
- Cancelar lotes elegíveis.
- Liquidar lotes encerrados.
- Receber créditos simulados de liquidações.

### BIDDER

O participante pode:

- Consultar lotes públicos.
- Consultar sua carteira.
- Realizar depósitos simulados.
- Registrar lances.
- Acompanhar reservas e liberações.
- Consultar movimentações financeiras.

As verificações de autorização são executadas no backend.

Um leiloeiro não pode realizar lances como participante.

## 6. Modelo de dados

As principais entidades persistidas são:

| Entidade | Responsabilidade |
|---|---|
| User | Identidade, credenciais e papel |
| RefreshSession | Sessões persistentes e rotação de tokens |
| Wallet | Saldo total e saldo comprometido |
| WalletTransaction | Histórico de movimentações |
| Lot | Dados, horários e estado do lote |
| Bid | Histórico de lances e hashes |
| Settlement | Registro de liquidação |
| Receipt | Comprovante público |

### Representação monetária

Valores financeiros são armazenados em centavos utilizando `BIGINT`.

Exemplo:

```text
150000 centavos = R$ 1.500,00
```

Nas respostas HTTP, os valores são serializados como strings decimais para evitar perda de precisão numérica no JavaScript.

## 7. Carteiras financeiras

Cada carteira possui:

- `totalCents`: saldo total.
- `committedCents`: saldo reservado.
- `availableCents`: saldo disponível calculado.

A relação é:

```text
availableCents = totalCents - committedCents
```

### Reserva financeira

Quando um participante assume a liderança:

1. O backend verifica seu saldo disponível.
2. O valor do lance é comprometido.
3. A movimentação é registrada.
4. O novo lance é persistido.

Quando outro participante supera o lance:

1. A reserva anterior é liberada.
2. A nova reserva é criada.
3. Ambas as movimentações são registradas.

Essas operações são realizadas dentro de transações PostgreSQL.

## 8. Processamento de lances

O motor de lances está implementado em `backend/src/services/bid.service.ts`.

### Regras de aceitação

Um lance somente é aceito quando:

1. O usuário está autenticado como `BIDDER`.
2. O lote existe e está disponível.
3. O horário está dentro do período permitido.
4. O valor atende ao mínimo e ao incremento.
5. O participante possui saldo suficiente.
6. O participante não é o líder atual do lote.

### Processamento transacional

A operação utiliza isolamento `READ COMMITTED`.

O processamento segue esta sequência:

1. Bloqueio do lote com `SELECT ... FOR UPDATE`.
2. Consulta do estado atualizado.
3. Determinação do lance anterior.
4. Bloqueio das carteiras envolvidas em ordem determinística.
5. Consulta ao relógio do PostgreSQL.
6. Validação do período do leilão.
7. Verificação do saldo disponível.
8. Liberação da reserva anterior, quando aplicável.
9. Reserva do novo valor.
10. Registro das movimentações financeiras.
11. Registro do lance e de seu hash.
12. Atualização do maior lance e do encerramento.

A transação impede que dois lances conflitantes sejam confirmados simultaneamente sobre um estado desatualizado do mesmo lote.

## 9. Anti-sniping

A regra de anti-sniping protege os minutos finais de um leilão.

Quando um lance válido é aceito faltando dois minutos ou menos para o encerramento, o prazo passa a ser dois minutos após a aceitação.

```text
novoEncerramento = horarioAceitacao + 2 minutos
```

O horário de aceitação é obtido do PostgreSQL utilizando `clock_timestamp()`.

A prorrogação é persistida na mesma transação do lance.

O frontend recebe a alteração pela API e pelas notificações Socket.IO.

## 10. Ciclo de vida dos lotes

Os estados utilizados são:

| Estado | Significado |
|---|---|
| SCHEDULED | Lote agendado |
| LIVE | Lote disponível durante o período válido |
| ENDED | Lote encerrado |
| CANCELLED | Lote cancelado |

A disponibilidade para lances depende tanto do estado quanto dos horários persistidos.

O cancelamento é protegido por regras de autorização e consistência.

Lotes cancelados não aparecem no catálogo público.

O encerramento financeiro é realizado por uma operação explícita de liquidação.

Não existe mecanismo automático de recuperação de liquidações pendentes confirmado na implementação atual.

## 11. Liquidação financeira

A liquidação está implementada em `backend/src/services/settlement.service.ts`.

### Regras

- Apenas o leiloeiro responsável pode liquidar seu lote.
- A autorização é validada dentro da transação.
- O lote é bloqueado antes da verificação.
- A liquidação somente ocorre após o encerramento.
- Uma liquidação já registrada não gera novas transferências.
- Lotes sem lances podem ser encerrados sem transferência financeira.

### Liquidação com vencedor

1. Identificação do lance vencedor.
2. Validação da consistência financeira.
3. Bloqueio das carteiras.
4. Débito do vencedor.
5. Liberação da reserva correspondente.
6. Crédito do leiloeiro.
7. Registro das movimentações.
8. Registro da liquidação.
9. Emissão do comprovante.
10. Atualização do estado do lote.

A operação é idempotente.

Chamadas repetidas não devem produzir créditos ou débitos duplicados.

## 12. Comprovantes públicos

Os comprovantes são identificados por tokens públicos aleatórios.

O sistema disponibiliza uma consulta pública que permite verificar informações da liquidação sem expor dados privados desnecessários.

O comprovante pode apresentar:

- Identificação do lote.
- Título do item.
- Alias do vencedor.
- Valor da arrematação.
- Data da liquidação.

O comprovante não constitui, por si só, uma assinatura digital independente.

## 13. Auditoria de lances

Os lances são organizados em uma cadeia de hashes SHA-256.

Cada lance registra:

- Identificador do lote.
- Identificador do participante.
- Valor.
- Horário de aceitação.
- Hash anterior.
- Hash atual.

O hash atual é calculado a partir dos dados do lance e da referência ao registro anterior.

### Limitação

Uma cadeia de hashes armazenada exclusivamente no mesmo banco pode ser recalculada por um agente que possua controle completo sobre os registros.

Portanto, a implementação atual não garante imutabilidade independente.

Uma futura evolução poderá utilizar assinaturas digitais, publicação de raízes de hashes ou ancoragem externa.

## 14. Comunicação em tempo real

O backend utiliza Socket.IO para distribuir notificações.

### Eventos públicos

| Evento | Descrição |
|---|---|
| lot:join | Entrada na sala de um lote |
| lot:leave | Saída da sala |
| lot:updated | Atualização de um lote |
| lots:updated | Atualização do catálogo |

### Evento privado

| Evento | Descrição |
|---|---|
| wallet:updated | Notificação de alteração da carteira |

### Autenticação do Socket.IO

O servidor aceita conexões anônimas para acompanhamento de eventos públicos.

Quando um token JWT é apresentado:

1. O token é validado.
2. A identidade é derivada da autenticação.
3. O usuário entra em uma sala privada definida pelo servidor.
4. A conexão autenticada é encerrada quando o JWT expira.

O cliente não pode escolher arbitrariamente a sala privada de outro usuário.

### Atualização no frontend

O frontend utiliza TanStack React Query.

Ao receber notificações, invalida as consultas correspondentes e recupera os dados atualizados pela API.

O evento privado `wallet:updated` não transporta o saldo da carteira.

## 15. Autenticação e sessões

O sistema utiliza:

- Senhas protegidas com bcryptjs.
- Access tokens JWT de curta duração.
- Refresh tokens persistentes.
- Cookies HttpOnly.
- Rotação de refresh tokens.
- Revogação de sessões.
- Detecção de reutilização de tokens.

O frontend mantém o access token em memória.

Quando necessário, solicita sua renovação utilizando o refresh token.

As rotas de refresh e logout validam a origem da requisição.

### Observação de implantação

A configuração atual utiliza `SameSite=Lax`.

Em uma implantação com frontend e backend em sites distintos, será necessário revisar a política de cookies, CORS e proteção CSRF.

## 16. Integração com API externa

O sistema permite importar informações de produtos do DummyJSON.

A integração utiliza:

- Requisições HTTP.
- Timeout de cinco segundos.
- Validação do retorno com Zod.
- Tratamento de falhas externas.
- Persistência de um snapshot dos metadados relevantes.

O cadastro manual de lotes permanece disponível quando a API externa não está acessível.

## 17. Interface e experiência do usuário

O frontend utiliza componentes reutilizáveis, hooks e contextos.

Entre os elementos implementados estão:

- `AureoLoader`.
- `SplashScreen`.
- `BidPanel`.
- `WalletPanel`.
- `LotCard`.
- Formulários e painéis de gerenciamento de lotes.

Os estilos são organizados em:

```text
frontend/src/styles/
├── components/
├── global/
└── pages/
```

A interface utiliza estados de carregamento e mecanismos de atualização dos dados.

As animações de carregamento são decisões de experiência visual, não mecanismos de autenticação.

## 18. Testes e qualidade

O backend utiliza Vitest e Supertest.

### Cobertura funcional

- Autenticação e autorização.
- Refresh tokens e sessões.
- Saúde da API.
- Conexão com PostgreSQL.
- Catálogo e criação de lotes.
- Gerenciamento e cancelamento.
- Carteiras e depósitos.
- Lances e concorrência.
- Liquidação e idempotência.
- Comprovantes.
- Socket.IO e isolamento de sessões.

### Validação registrada

Em 28/10/2026:

| Verificação | Resultado |
|---|---|
| Backend — build | Aprovado |
| Backend — testes | 110/110 aprovados |
| Suítes de backend | 13/13 aprovadas |
| Frontend — build | Aprovado |
| Frontend — ESLint | Aprovado |
| Git — diff check | Aprovado no commit anterior |

A aprovação desses testes não substitui uma auditoria de segurança ou homologação em produção.

## 19. Ambiente local

O banco PostgreSQL é iniciado pelo Docker Compose:

```bash
docker compose up -d
```

A porta local é `5433`.

### Backend

```bash
cd backend
cp .env.example .env
npm ci
npx prisma generate
npx prisma migrate deploy
npm run seed
npm run dev
```

A API utiliza a porta `3333` por padrão.

### Frontend

```bash
cd frontend
npm ci
npm run dev
```

O frontend utiliza a porta `5173` no ambiente local.

A variável `VITE_API_URL` permite configurar o endereço da API.

## 20. Implantação

A implantação pública ainda está pendente de validação.

Será necessário configurar:

1. Banco PostgreSQL acessível ao backend.
2. Migrações de produção.
3. Variáveis de ambiente e segredos.
4. Hospedagem do backend com suporte a Socket.IO.
5. Hospedagem do frontend.
6. CORS e política de cookies.
7. HTTPS.
8. Testes de autenticação e atualização em tempo real.
9. Validação dos fluxos de lances e liquidação.
10. URLs públicas na documentação.

As credenciais de desenvolvimento não devem ser reutilizadas em produção.

## 21. Limitações conhecidas

- Os saldos são simulados.
- A auditoria ainda não possui ancoragem externa.
- Não há recuperação automática de liquidações confirmada.
- O seed não cria lances iniciais.
- O deploy público ainda precisa ser homologado.
- A cobertura automatizada do frontend pode ser ampliada.
- Existem arquivos vazios reservados para possíveis evoluções arquiteturais.

## 22. Conclusão

O ÁUREO possui uma arquitetura orientada à separação de responsabilidades, com regras financeiras concentradas no backend e operações críticas protegidas por transações PostgreSQL.

O sistema já dispõe de autenticação, sessões persistentes, lances concorrentes, anti-sniping, carteiras simuladas, comunicação em tempo real e liquidação idempotente.

A próxima etapa é a implantação pública e a validação ponta a ponta do ambiente hospedado.