# Elite Leilão — Arquitetura Técnica

**Versão:** 0.1.0  
**Status:** Arquitetura inicial em desenvolvimento  
**Projeto:** Casa de Leilões Online  
**Equipe:** João Victor e Kc(Auxiliar Técnico)

## 1. Visão geral

O Elite Leilão é uma aplicação web para gerenciamento e participação em leilões online, com saldos simulados, lances em tempo real, liquidação financeira e auditoria pública.

O projeto prioriza consistência financeira, rastreabilidade, segurança, experiência do usuário e capacidade de recuperação após falhas.

## 2. Stack tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend | React, TypeScript, Vite |
| Navegação | React Router |
| Requisições e cache | Axios, TanStack Query |
| Comunicação em tempo real | Socket.IO |
| Backend | Node.js, Express, TypeScript |
| Validação | Zod |
| Autenticação planejada | JWT e bcryptjs |
| Banco de dados | PostgreSQL 17 |
| ORM | Prisma 7 |
| Infraestrutura local | Docker Compose |
| Testes | Vitest e Supertest |

## 3. Organização do repositório

```text
elite-auctions/
├── frontend/
│   └── src/
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── errors/
│       ├── lib/
│       ├── middlewares/
│       ├── repositories/
│       ├── routes/
│       ├── schemas/
│       ├── services/
│       ├── tests/
│       ├── app.ts
│       └── server.ts
├── docs/
│   ├── adr/
│   ├── ARCHITECTURE.md
│   └── DECISIONS.md
└── docker-compose.yml
```

As pastas representam a estrutura planejada. Nem todas possuem implementações completas nesta versão.

## 4. Arquitetura da aplicação

O frontend se comunica com o backend por HTTP/JSON. A comunicação em tempo real será implementada com Socket.IO.

Fluxo planejado:

```text
React
  |
  | HTTP / WebSocket
  v
Express
  |
  +-- Middlewares
  +-- Controllers
  +-- Services
  +-- Repositories
          |
          v
      Prisma ORM
          |
          v
     PostgreSQL
```

**Responsabilidades:**

- **Controllers:** receber requisições e construir respostas HTTP.
- **Schemas:** validar dados de entrada.
- **Services:** implementar regras de negócio.
- **Repositories:** encapsular consultas e persistência quando necessário.
- **Middlewares:** autenticação, autorização e tratamento de erros.
- **Socket.IO:** distribuir eventos de atualização após operações confirmadas.

## 5. Papéis e autorização

O sistema possui dois papéis:

**AUCTIONEER (leiloeiro):** cadastra e gerencia lotes, acompanha lances e recebe créditos de leilões liquidados.

**BIDDER (participante):** possui carteira simulada, realiza lances e consulta arrematações.

Um leiloeiro não poderá realizar lances.

A autorização deverá ser validada no backend, independentemente das restrições exibidas no frontend.

## 6. Modelo de dados inicial

Entidades implementadas no Prisma:

| Entidade | Responsabilidade |
|---|---|
| User | Identidade, credenciais e papel |
| Wallet | Saldo total e saldo comprometido |
| WalletTransaction | Histórico financeiro |
| Lot | Informações, horários e estado do lote |
| Bid | Lances e encadeamento de hashes |
| Settlement | Registro de liquidação |
| Receipt | Comprovante público |

O modelo poderá receber novas entidades, índices e restrições conforme a implementação das regras financeiras e da auditoria.

## 7. Regras financeiras

Todos os valores monetários são representados em **centavos inteiros**, utilizando `BigInt`.

O saldo disponível de um participante será:

```text
saldo_disponivel = saldo_total - saldo_comprometido
```

Ao assumir a liderança de um lote, o valor do lance deverá ser comprometido na carteira do participante.

Quando outro participante superar o lance, o compromisso anterior deverá ser liberado.

Na liquidação, o vencedor terá o valor debitado e o leiloeiro receberá o crédito correspondente.

Essas operações deverão ocorrer em transações de banco de dados, com controle de concorrência e validações de integridade.

**Status:** regras definidas; implementação transacional pendente.

## 8. Ciclo de vida dos lotes

Estados previstos:

- `SCHEDULED`: leilão agendado.
- `LIVE`: leilão em andamento.
- `ENDED`: leilão encerrado.
- `CANCELLED`: leilão cancelado.

Lotes cancelados não deverão aparecer na vitrine pública.

As transições de estado serão controladas pelo backend. Os horários persistidos serão a referência para abertura e encerramento, evitando depender exclusivamente de processos em memória.

## 9. Regras de lances

Um lance deverá:

1. Ser enviado por um participante autenticado.
2. Referenciar um lote aberto e dentro do prazo.
3. Respeitar o valor de abertura ou o incremento mínimo.
4. Ser rejeitado quando enviado pelo líder atual.
5. Verificar o saldo disponível.
6. Atualizar os compromissos financeiros de forma atômica.
7. Ser registrado no histórico.
8. Gerar uma atualização em tempo real após confirmação.

**Anti-sniping:** um lance válido aceito nos últimos dois minutos deverá estender o prazo de encerramento. A fórmula exata de extensão e seus testes serão documentados antes da implementação.

**Status:** pendente.

## 10. Concorrência e consistência

Dois participantes podem tentar realizar lances simultaneamente.

A implementação deverá serializar operações conflitantes por lote, utilizando transações e bloqueios apropriados no PostgreSQL, com tratamento de conflitos e tentativas de repetição quando necessário.

Não será suficiente verificar o maior lance apenas na memória do servidor.

## 11. Liquidação e recuperação

Cada lote poderá possuir no máximo uma liquidação registrada, conforme a restrição única em `Settlement.lotId`.

A liquidação deverá ser idempotente: executá-la novamente não poderá produzir débitos ou créditos duplicados.

Um mecanismo de recuperação deverá identificar lotes encerrados ainda não liquidados, inclusive após reinicializações do servidor.

**Status:** pendente.

## 12. Auditoria pública

Cada lance deverá integrar um histórico verificável, permitindo identificar alterações, exclusões e inserções indevidas.

Uma cadeia simples de hashes armazenada integralmente no próprio banco não é suficiente contra um agente capaz de reescrever todos os registros e recalcular os hashes.

Por isso, a solução deverá utilizar uma referência de confiança externa ao banco, como assinaturas digitais com chave privada protegida fora do PostgreSQL e mecanismos adequados de publicação ou ancoragem.

O projeto deverá documentar seu modelo de ameaça, as garantias efetivas e as limitações da verificação pública.

**Status:** estratégia final e implementação pendentes.

## 13. Integração com API externa

O leiloeiro poderá importar metadados de itens de uma API pública.

Os dados relevantes serão armazenados em `Lot.itemSnapshot`, preservando as informações utilizadas na criação do lote mesmo quando a API externa estiver indisponível.

A API provedora e a política de importação ainda serão definidas.

## 14. API implementada

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/health` | Verifica disponibilidade da API |
| GET | `/health/db` | Verifica conectividade com PostgreSQL |

Demais endpoints de autenticação, lotes, carteiras, lances, auditoria e comprovantes estão pendentes.

## 15. Ambiente de desenvolvimento

O PostgreSQL é executado com Docker Compose.

```bash
docker compose up -d
```

A porta local configurada é `5433`, encaminhada para a porta `5432` do container.

No backend:

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run seed
npm run dev
```

O seed cria três contas de demonstração, duas carteiras e um lote inicialmente aberto.

**Credenciais locais de demonstração:**

- Leiloeiro: `leiloeiro@demo.local`
- Participante 1: `participante1@demo.local`
- Participante 2: `participante2@demo.local`
- Senha inicial: `Demo@123456`

Essas credenciais são exclusivamente para desenvolvimento. Não devem ser reutilizadas em produção.

O seed não atualiza automaticamente a data de encerramento de um lote já existente; portanto, o lote demonstrativo pode expirar em execuções posteriores.

## 16. Testes e qualidade

A suíte inicial utiliza Vitest e Supertest.

Testes existentes:

- Disponibilidade da API.
- Conectividade com o PostgreSQL.

Testes planejados:

- Autenticação e autorização.
- Validação de lances.
- Concorrência entre participantes.
- Comprometimento e liberação de saldo.
- Anti-sniping.
- Liquidação idempotente.
- Recuperação após reinicialização.
- Integridade e verificação da auditoria.

## 17. Segurança

Diretrizes:

- Armazenar senhas com hash seguro.
- Validar entradas no backend.
- Não versionar arquivos `.env`.
- Utilizar segredos diferentes por ambiente.
- Aplicar autorização por papel.
- Evitar exposição de dados pessoais em comprovantes públicos.
- Tratar operações financeiras como transações atômicas.
- Proteger as chaves utilizadas na auditoria.

## 18. Implantação

A aplicação deverá disponibilizar frontend e backend acessíveis publicamente.

A hospedagem, as variáveis de ambiente, o banco gerenciado e os procedimentos de deploy serão documentados após a escolha dos provedores.

## 19. Estado atual do projeto

**Implementado:**

- Estrutura inicial de frontend e backend.
- Express com TypeScript.
- PostgreSQL em Docker.
- Prisma e migration inicial.
- Testes de saúde da API e banco.
- Seed de demonstração.

**Pendente:**

- Autenticação e autorização.
- Integração com API externa.
- CRUD e gerenciamento de lotes.
- Carteiras e depósitos.
- Lances concorrentes.
- Atualizações em tempo real.
- Anti-sniping.
- Liquidação e recuperação.
- Auditoria pública verificável.
- Comprovantes.
- Interface final e deploy.

---

Este documento deverá evoluir junto com o código. Funcionalidades planejadas não devem ser apresentadas como implementadas antes de serem verificadas.