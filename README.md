# ÁUREO — Plataforma de Leilões Online

Plataforma full-stack de leilões online desenvolvida por **João Victor** para o desafio técnico **Elite Dev 2026 — Verzel**, utilizando React, TypeScript, Node.js, Express, PostgreSQL e Socket.IO.

O ÁUREO permite criar e administrar leilões, importar produtos de um catálogo externo, realizar lances em tempo real, reservar valores em carteiras simuladas, liquidar arrematações e consultar históricos auditáveis.

> **Estado do projeto — 29/10/2026:** frontend e backend publicados, integração DummyJSON validada, 127 testes automatizados de backend aprovados em 17 arquivos, build e ESLint do frontend aprovados. Todas as operações financeiras são simuladas.

## Demonstração pública

| Recurso | Endereço |
|---|---|
| Aplicação web — Vercel | `https://elite-leilao.vercel.app/` |
| API — Render | `https://aureo-api.onrender.com` |
| Repositório | https://github.com/JhonYuusha/elite-leilao |

O frontend está hospedado na Vercel, a API no Render e o banco PostgreSQL no Render.

### Contas de demonstração em produção

As contas abaixo já estão cadastradas no ambiente publicado e possuem credenciais próprias.

| Perfil | E-mail | Senha |
|---|---|---|
| Leiloeiro | `leiloeiro@demo.local` | `leiloeirorender` |
| Participante 1 | `participante1@demo.local` | `participante01render` |
| Participante 2 | `participante2@demo.local` | `participante02render` |

**Importante:** as senhas de produção são independentes das senhas criadas pelo seed local. A senha `Demo@123456` é exclusiva do ambiente de desenvolvimento e **não funciona na aplicação publicada na Vercel**.

As contas de demonstração utilizam saldos fictícios e não concedem acesso administrativo à infraestrutura.

Existe um lote de demonstração importado da DummyJSON, com encerramento programado para **07/11/2026**. A possibilidade de registrar lances depende do horário de início, do encerramento e do estado atual do lote.

## Funcionalidades

### Leiloeiro

- Criar lotes manualmente.
- Pesquisar visualmente produtos da API DummyJSON.
- Selecionar e importar produtos externos para novos lotes.
- Definir lance inicial, incremento mínimo, início e encerramento.
- Consultar e filtrar os próprios leilões.
- Cancelar lotes elegíveis antes da existência de lances.
- Consultar resultados individuais de arrematação.
- Acompanhar a quantidade de lotes ativos e arrematados.
- Visualizar o total efetivamente recebido em liquidações.
- Liquidar manualmente leilões encerrados.

### Participante

- Consultar o catálogo público.
- Navegar por leilões ao vivo, agendados e encerrados.
- Pesquisar e filtrar lotes.
- Visualizar a sala de um lote e sua contagem regressiva.
- Consultar o lance atual, o incremento mínimo e o histórico.
- Acompanhar sua posição na disputa.
- Realizar depósitos fictícios.
- Consultar saldo total, reservado e disponível.
- Registrar lances com validação financeira e temporal.
- Receber atualizações em tempo real.
- Consultar movimentações financeiras.
- Acessar **Meus arremates**, com participações, resultados e comprovantes disponíveis.

### Regras de negócio

- Autenticação e autorização por papel.
- Leiloeiros não podem registrar lances.
- Lances são processados em transações PostgreSQL.
- Bloqueios de linha protegem contra conflitos de concorrência.
- O maior lance reserva saldo do participante líder.
- Quando um lance é superado, a reserva anterior é liberada.
- Lances inválidos são rejeitados com mensagens de erro.
- O participante líder não pode aumentar seu próprio lance enquanto permanece na liderança.
- Lances aceitos nos últimos dois minutos prorrogam o encerramento para dois minutos após a aceitação.
- Lotes cancelados não aparecem no catálogo público.
- Liquidações são idempotentes.
- Lotes sem lances podem encerrar sem vencedor e sem transferência financeira.
- Comprovantes são disponibilizados por links públicos.
- O histórico de lances utiliza encadeamento SHA-256.

## Tecnologias

| Camada | Tecnologias |
|---|---|
| Frontend | React 19, TypeScript, Vite 8 |
| Navegação | React Router |
| Requisições | Axios |
| Estado remoto | TanStack React Query |
| Tempo real | Socket.IO |
| Backend | Node.js, Express 5, TypeScript |
| Validação | Zod |
| Banco de dados | PostgreSQL 17 |
| ORM | Prisma 7 |
| Autenticação | JWT, bcryptjs, cookies HttpOnly |
| Testes | Vitest, Supertest |
| Ambiente local | Docker Compose |
| Deploy | Vercel, Render |
| Automação | GitHub Actions |

## Arquitetura

A aplicação utiliza separação de responsabilidades entre interface, transporte HTTP, regras de negócio e persistência.

```text
                 FRONTEND
             React + TypeScript
                     |
               Axios / HTTP
                     |
                     v
                  BACKEND
             Express + TypeScript
                     |
             Middlewares / Zod
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


                TEMPO REAL

                 Socket.IO
                     |
          +----------+----------+
          |                     |
     Salas públicas        Salas privadas
       dos lotes            por usuário
          |                     |
     lot:updated          wallet:updated
     lots:updated
```

O PostgreSQL é a fonte de verdade para lances, reservas, carteiras e liquidações.

Os eventos Socket.IO notificam alterações confirmadas, mas não substituem as consultas à API. O frontend invalida as consultas correspondentes e recupera o estado persistido.

A arquitetura completa está documentada em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

As decisões e limitações técnicas estão registradas em [docs/DECISIONS.md](docs/DECISIONS.md).

## Estrutura do repositório

```text
elite-leilao/
├── .github/
│   └── workflows/
│       └── liquidacao-automatica.yml
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── scripts/
│   │   └── settle-expired.ts
│   └── src/
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
│       ├── components/
│       ├── constants/
│       ├── contexts/
│       ├── hooks/
│       ├── lib/
│       ├── pages/
│       ├── services/
│       ├── styles/
│       ├── types/
│       └── utils/
├── docs/
│   ├── ARCHITECTURE.md
│   └── DECISIONS.md
├── docker-compose.yml
└── README.md
```

## Execução local

### Pré-requisitos

- Node.js 22.18.0.
- npm.
- Docker e Docker Compose.
- Git.

### 1. Clonar o repositório

```bash
git clone https://github.com/JhonYuusha/elite-leilao.git
cd elite-leilao
```

### 2. Iniciar o PostgreSQL

```bash
docker compose up -d
```

O Docker Compose utiliza PostgreSQL 17 e publica a porta `5433` exclusivamente no endereço local `127.0.0.1`.

### 3. Configurar o backend

```bash
cd backend
npm ci
cp .env.example .env
```

Configure as variáveis locais no arquivo `backend/.env`:

```dotenv
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/elite_auctions?schema=public"
PORT=3333
JWT_SECRET="substitua-por-um-segredo-forte"
FRONTEND_URL="http://localhost:5173"
```

O segredo JWT acima é apenas um exemplo. Utilize um valor aleatório e seguro.

Prepare o banco:

```bash
npx prisma generate
npx prisma migrate deploy
npm run seed
```

Inicie a API:

```bash
npm run dev
```

A API ficará disponível em `http://localhost:3333`.

### 4. Configurar o frontend

Em outro terminal, a partir da raiz do repositório:

```bash
cd frontend
npm ci
```

Crie `frontend/.env.local`:

```dotenv
VITE_API_URL=http://localhost:3333
```

Inicie o frontend:

```bash
npm run dev
```

Acesse `http://localhost:5173`.

### Credenciais locais

O seed local cria as seguintes contas:

| Perfil | E-mail | Senha local |
|---|---|---|
| Leiloeiro | `leiloeiro@demo.local` | `Demo@123456` |
| Participante 1 | `participante1@demo.local` | `Demo@123456` |
| Participante 2 | `participante2@demo.local` | `Demo@123456` |

**Essas credenciais pertencem exclusivamente ao ambiente local.** Na aplicação publicada, utilize as senhas específicas informadas na seção **Contas de demonstração em produção**.

O seed também cria carteiras e um lote demonstrativo. Ele é bloqueado quando `NODE_ENV=production`, não cria lances iniciais e não renova automaticamente o prazo de lotes já existentes.

## Endpoints principais

| Método | Endpoint | Finalidade |
|---|---|---|
| GET | `/health` | Saúde da API |
| GET | `/health/db` | Conexão com PostgreSQL |
| POST | `/auth/login` | Login |
| POST | `/auth/refresh` | Renovação de sessão |
| POST | `/auth/logout` | Logout |
| GET | `/auth/me` | Usuário autenticado |
| GET | `/lots` | Catálogo público |
| GET | `/lots/mine` | Lotes do leiloeiro |
| GET | `/lots/:id` | Detalhes de um lote |
| POST | `/lots` | Criação de lote |
| PATCH | `/lots/:id/cancel` | Cancelamento |
| GET | `/lots/:id/bids` | Histórico de lances |
| GET | `/lots/:id/audit` | Auditoria pública |
| POST | `/lots/:id/bids` | Registro de lance |
| POST | `/lots/:id/settle` | Liquidação |
| GET | `/bids/mine` | Participações do usuário |
| GET | `/wallet` | Consulta de carteira |
| POST | `/wallet/deposits` | Depósito simulado |
| GET | `/wallet/transactions` | Histórico financeiro |
| GET | `/receipts/:token` | Comprovante público |

As rotas protegidas exigem autenticação e autorização conforme o papel do usuário.

## Concorrência e consistência financeira

Os valores monetários são armazenados em centavos, utilizando `BIGINT` no PostgreSQL.

Para evitar perda de precisão em JavaScript, os valores são serializados nas respostas HTTP como strings decimais.

Exemplo:

```json
{
  "amountCents": "150000"
}
```

O valor representa R$ 1.500,00.

### Processamento de lances

A operação de lance utiliza transação PostgreSQL com bloqueios de linha.

O fluxo inclui:

1. Bloquear o lote.
2. Consultar seu estado atualizado.
3. Identificar o lance anterior.
4. Bloquear as carteiras envolvidas.
5. Validar horário, incremento e saldo.
6. Liberar a reserva anterior.
7. Reservar o valor do novo lance.
8. Registrar movimentações financeiras.
9. Persistir o lance e seu hash.
10. Atualizar o maior lance e, quando necessário, o encerramento.

Essa estratégia evita que lances concorrentes sejam aceitos com base em estados desatualizados.

### Anti-sniping

Quando um lance válido é aceito faltando dois minutos ou menos para o encerramento:

```text
novoEncerramento = horarioAceitacao + 2 minutos
```

O horário é obtido do PostgreSQL e a alteração é persistida na mesma transação do lance.

## Liquidação automática

Além da liquidação manual, o projeto possui um workflow do GitHub Actions:

```text
.github/workflows/liquidacao-automatica.yml
```

O workflow executa o comando:

```bash
npm run settle:expired
```

O agendamento utiliza os minutos `7`, `22`, `37` e `52` de cada hora, em UTC, e também permite execução manual pelo GitHub Actions.

O processo utiliza uma conexão de banco configurada por segredo do repositório e procura leilões elegíveis para liquidação.

A execução do workflow foi validada com sucesso no GitHub Actions. A confirmação de uma execução bem-sucedida do workflow não deve ser confundida com evidência de que um lote expirado específico foi efetivamente liquidado.

A liquidação é idempotente: chamadas repetidas não devem duplicar débitos, créditos ou comprovantes.

## Histórico e auditoria pública

Cada lance é persistido com:

- Identificador do lote.
- Identificador do participante.
- Valor.
- Horário.
- Hash anterior.
- Hash SHA-256 do registro.

O endpoint público `/lots/:id/audit` permite consultar o histórico auditável e o resultado da verificação de integridade.

A verificação percorre a cadeia de referências e procura inconsistências como:

- Hash inválido.
- Referência anterior ausente.
- Ramificações inesperadas.
- Ciclos na cadeia.
- Divergência entre o histórico e o lance atual.

A interface apresenta a auditoria ao lado das informações do leilão.

**Limitação:** hashes encadeados armazenados exclusivamente no mesmo banco não constituem prova independente de imutabilidade. Um agente com controle completo sobre os dados poderia reescrever o histórico e recalcular os hashes. Ancoragem externa ou assinaturas digitais são evoluções futuras.

## Comprovantes e meus arremates

O participante pode acessar a página **Meus arremates** para consultar os lotes em que participou.

A interface diferencia situações como liderança, lance superado, vitória e derrota.

Quando há liquidação com vencedor, é emitido um comprovante público identificado por token aleatório.

O comprovante pode ser compartilhado por URL, sem exigir autenticação do visitante.

O comprovante apresenta dados da arrematação e um identificador público do vencedor, evitando divulgar informações pessoais desnecessárias.

## Integração com DummyJSON

O leiloeiro pode criar lotes manualmente ou importar produtos externos.

Na importação visual, o frontend consulta:

```text
https://dummyjson.com/products/search
```

A interface oferece:

- Campo de busca.
- Resultados com imagem, título e categoria.
- Seleção visual de um produto.
- Prévia antes da criação.
- Tratamento de carregamento e erros.

Ao confirmar a criação, o frontend envia o identificador do produto ao backend.

O backend consulta novamente a API externa, valida os dados com Zod e persiste um snapshot do produto associado ao lote.

Essa abordagem evita confiar exclusivamente nos dados enviados pelo navegador.

Se a DummyJSON estiver indisponível, o cadastro manual permanece disponível.

## Comunicação em tempo real

O Socket.IO distribui notificações públicas e privadas.

| Evento | Finalidade |
|---|---|
| `lot:join` | Entrada na sala de um lote |
| `lot:leave` | Saída da sala |
| `lot:updated` | Atualização do lote |
| `lots:updated` | Atualização do catálogo |
| `wallet:updated` | Atualização privada de carteira |

Os eventos financeiros privados não transportam o saldo diretamente. O frontend consulta novamente a API autenticada.

## Autenticação e segurança

O sistema utiliza:

- Senhas protegidas com bcryptjs.
- JWT de curta duração para acesso.
- Refresh tokens rotativos.
- Refresh tokens armazenados em cookies HttpOnly.
- Persistência e revogação de sessões.
- Detecção de reutilização de refresh tokens.
- Validação de origem em operações sensíveis de sessão.
- Autorização por papel no backend.
- Salas privadas Socket.IO derivadas da identidade autenticada.
- Expiração de conexões autenticadas conforme o JWT.

O access token permanece em memória no frontend.

As credenciais de banco, segredos JWT e demais configurações sensíveis não devem ser incluídos no repositório.

## Testes e qualidade

### Backend

A suíte automatizada utiliza Vitest e Supertest.

Resultado registrado em **28/10/2026**:

**127 testes aprovados em 17 arquivos de teste.**

Os testes abrangem:

- Autenticação e autorização.
- Refresh tokens e sessões.
- Saúde da API.
- Conexão com PostgreSQL.
- Criação e gerenciamento de lotes.
- Carteiras e depósitos.
- Lances e concorrência.
- Anti-sniping.
- Liquidação e idempotência.
- Comprovantes públicos.
- Socket.IO e isolamento de sessões.
- Histórico e ordenação da cadeia de lances.
- Verificação de integridade SHA-256.
- Auditoria pública.

Executar:

```bash
cd backend
npm run build
npm test
```

**Importante:** os testes devem ser executados em ambiente de teste ou desenvolvimento, nunca apontando para o banco de produção.

### Frontend

Executar:

```bash
cd frontend
npm run build
npm run lint
```

Ambos foram executados com sucesso em 29/10/2026, após a implementação da busca visual de produtos.

O Vite apresenta um aviso não bloqueante sobre o tamanho do bundle JavaScript. O build é concluído normalmente. Uma evolução futura poderá utilizar divisão de código por rotas e carregamento sob demanda para reduzir o tamanho inicial.

## Implantação

A aplicação utiliza:

| Serviço | Responsabilidade |
|---|---|
| Vercel | Hospedagem do frontend |
| Render | Hospedagem da API |
| Render PostgreSQL | Persistência |
| GitHub Actions | Liquidação automática periódica |

As variáveis de ambiente e credenciais de infraestrutura são configuradas nos respectivos provedores.

A implantação foi utilizada para validar autenticação, lances entre dois participantes, atualização em tempo real e movimentações de carteira.

A demonstração pública deve ser testada novamente após alterações de configuração, credenciais ou deploy.

## Limitações conhecidas

- As operações financeiras são simuladas e não envolvem dinheiro real.
- A cadeia de hashes não possui ancoragem criptográfica externa.
- A execução agendada pode sofrer atrasos conforme a disponibilidade do GitHub Actions.
- O seed local não cria lances iniciais.
- O seed local não renova automaticamente leilões já existentes.
- A cobertura automatizada do frontend pode ser ampliada.
- O bundle JavaScript inicial pode ser otimizado por divisão de código.
- O mecanismo de liquidação automática depende da disponibilidade do banco e da execução do workflow.
- As contas e os lotes de demonstração devem ser mantidos válidos durante a avaliação.

## Uso de inteligência artificial

Ferramentas de inteligência artificial foram utilizadas como apoio durante o desenvolvimento do projeto, especialmente para:

- Discussão de arquitetura e regras de negócio.
- Análise de cenários de concorrência e consistência financeira.
- Apoio na implementação e refatoração.
- Sugestão de testes automatizados.
- Investigação de erros de compilação e integração.
- Organização e revisão da documentação técnica.

As sugestões foram integradas ao projeto por meio de revisão humana, execução de builds, verificações estáticas, testes automatizados e testes funcionais manuais.

A inteligência artificial foi utilizada como ferramenta de apoio, não como substituta da validação técnica. As decisões de arquitetura, a revisão das implementações, a execução dos testes e a responsabilidade pela entrega permanecem com **João Victor**, responsável pelo desenvolvimento do projeto.

## Documentação adicional

- [Arquitetura técnica](docs/ARCHITECTURE.md)
- [Registro de decisões técnicas](docs/DECISIONS.md)

## Autor

**João Victor**

Responsável pelo desenvolvimento, arquitetura, implementação, testes, implantação e documentação do ÁUREO.

- **GitHub:** [JhonYuusha](https://github.com/JhonYuusha)
- **Repositório:** [elite-leilao](https://github.com/JhonYuusha/elite-leilao)

---

**ÁUREO — Plataforma de Leilões Online**

Projeto desenvolvido para o desafio técnico **Elite Dev 2026 — Verzel**, com dados e operações financeiras simulados.