# ÁUREO — Plataforma de Leilões Online

Plataforma full-stack de leilões online desenvolvida com React, TypeScript, Node.js, Express, PostgreSQL e Socket.IO.

O projeto foi desenvolvido para um desafio técnico, com foco em consistência financeira, concorrência, segurança, rastreabilidade e experiência do usuário.

> **Estado atual — 28/10/2026:** backend e frontend compilando, 110 testes automatizados aprovados em 13 suítes, ESLint aprovado. Implantação pública pendente.

## Funcionalidades

### Leiloeiro

- Criar lotes manualmente ou importar produtos de uma API externa.
- Definir valores iniciais, incrementos e períodos de leilão.
- Visualizar e gerenciar os próprios lotes.
- Cancelar lotes elegíveis.
- Liquidar leilões encerrados.
- Receber créditos simulados após a liquidação.

### Participante

- Explorar o catálogo público de lotes.
- Consultar informações e histórico dos leilões.
- Utilizar carteira financeira simulada.
- Realizar depósitos de demonstração.
- Registrar lances respeitando saldo disponível e incremento mínimo.
- Acompanhar atualizações em tempo real.
- Consultar movimentações financeiras.

### Regras de negócio

- Autenticação e autorização por papel.
- Reserva financeira ao assumir a liderança de um lote.
- Liberação automática da reserva quando um lance é superado.
- Bloqueios transacionais para evitar conflitos entre lances simultâneos.
- Anti-sniping: lances aceitos nos últimos dois minutos prorrogam o encerramento.
- Histórico de lances encadeado por hashes SHA-256.
- Liquidação financeira idempotente.
- Comprovantes públicos consultáveis por token.
- Notificações públicas de lotes e privadas de atualização de carteira.

**Importante:** todas as operações financeiras são simuladas. O projeto não movimenta dinheiro real.

## Tecnologias

| Camada | Tecnologias |
|---|---|
| Frontend | React, TypeScript, Vite |
| Navegação | React Router |
| Requisições HTTP | Axios |
| Cache e sincronização | TanStack React Query |
| Tempo real | Socket.IO |
| Backend | Node.js, Express, TypeScript |
| Validação | Zod |
| Banco de dados | PostgreSQL 17 |
| ORM | Prisma 7 |
| Autenticação | JWT, bcryptjs, cookies HttpOnly |
| Testes | Vitest, Supertest |
| Infraestrutura local | Docker Compose |

## Arquitetura

A aplicação separa as responsabilidades entre interface, API, serviços de negócio e persistência.

```text
React + TypeScript
        |
        | HTTP / JSON
        v
Express + Middlewares
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

Socket.IO
  |-- Eventos públicos de lotes
  |-- Notificações privadas de carteira
```

O PostgreSQL é a fonte de verdade para saldos, lances, reservas financeiras e liquidações.

As notificações Socket.IO são emitidas após a confirmação das transações. Elas informam o frontend sobre alterações, mas não substituem a consulta dos dados persistidos.

Mais detalhes em [ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Estrutura do repositório

```text
elite-leilao/
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma
│   │   └── seed.ts
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

## Executando localmente

### Pré-requisitos

- Node.js compatível com as versões utilizadas de Vite e Prisma.
- npm.
- Docker e Docker Compose.
- Git.

### 1. Clonar o projeto

```bash
git clone https://github.com/JhonYuusha/elite-leilao.git
cd elite-leilao
```

### 2. Iniciar o PostgreSQL

```bash
docker compose up -d
```

O PostgreSQL será disponibilizado localmente na porta `5433`.

### 3. Configurar o backend

```bash
cd backend
npm ci
cp .env.example .env
```

Variáveis de ambiente:

```dotenv
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/elite_auctions?schema=public"
PORT=3333
JWT_SECRET="substitua-por-um-segredo-forte"
FRONTEND_URL="http://localhost:5173"
```

Substitua `JWT_SECRET` por um valor seguro.

Prepare o banco:

```bash
npx prisma generate
npx prisma migrate deploy
npm run seed
```

Inicie o servidor:

```bash
npm run dev
```

A API estará disponível em:

`http://localhost:3333`

### 4. Configurar o frontend

Em outro terminal:

```bash
cd frontend
npm ci
```

Crie o arquivo `frontend/.env.local`:

```dotenv
VITE_API_URL=http://localhost:3333
```

Inicie:

```bash
npm run dev
```

Acesse:

`http://localhost:5173`

## Contas de demonstração

O seed local cria três usuários:

| Papel | E-mail |
|---|---|
| Leiloeiro | `leiloeiro@demo.local` |
| Participante 1 | `participante1@demo.local` |
| Participante 2 | `participante2@demo.local` |

Senha local de demonstração:

`Demo@123456`

Essas credenciais são exclusivas do ambiente de desenvolvimento.

O seed também cria carteiras simuladas e um lote de demonstração.

**Observações:** o seed é bloqueado quando `NODE_ENV=production`, não cria lances iniciais e não renova automaticamente o prazo de um lote já existente.

## Endpoints principais

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/health` | Saúde da API |
| GET | `/health/db` | Conexão com PostgreSQL |
| POST | `/auth/login` | Autenticação |
| POST | `/auth/refresh` | Renovação da sessão |
| POST | `/auth/logout` | Encerramento da sessão |
| GET | `/auth/me` | Usuário autenticado |
| GET | `/lots` | Catálogo público |
| GET | `/lots/:id` | Detalhes do lote |
| GET | `/lots/mine` | Lotes do leiloeiro |
| POST | `/lots` | Criação de lote |
| PATCH | `/lots/:id/cancel` | Cancelamento |
| POST | `/lots/:id/bids` | Registro de lance |
| POST | `/lots/:id/settle` | Liquidação |
| GET | `/wallet` | Consulta da carteira |
| POST | `/wallet/deposits` | Depósito simulado |
| GET | `/wallet/transactions` | Histórico financeiro |
| GET | `/receipts/:token` | Comprovante público |

## Autenticação e segurança

A autenticação utiliza JWT e sessões persistentes.

- Senhas protegidas com bcryptjs.
- Access tokens de curta duração.
- Refresh tokens rotativos.
- Refresh token armazenado em cookie HttpOnly.
- Revogação de sessões.
- Detecção de reutilização de refresh tokens.
- Validação de origem nas operações de renovação e logout.
- Autorização por papel no backend.
- Salas privadas Socket.IO derivadas da identidade autenticada.
- Desconexão de sockets autenticados quando o JWT expira.

O access token é mantido em memória no frontend.

## Concorrência e consistência financeira

Os lances utilizam transações PostgreSQL com bloqueios de linha.

O processamento inclui:

1. Bloqueio do lote.
2. Consulta do estado atualizado.
3. Bloqueio das carteiras envolvidas.
4. Validação do horário pelo PostgreSQL.
5. Verificação de incremento e saldo.
6. Liberação da reserva anterior.
7. Reserva do novo lance.
8. Registro do histórico financeiro.
9. Persistência do lance e atualização do lote.

A liquidação também utiliza transações e garante idempotência, impedindo créditos e débitos duplicados em chamadas concorrentes.

## Comunicação em tempo real

O Socket.IO distribui eventos como:

| Evento | Finalidade |
|---|---|
| `lot:join` | Entrar na sala de um lote |
| `lot:leave` | Sair da sala |
| `lot:updated` | Notificar atualização de um lote |
| `lots:updated` | Notificar atualização do catálogo |
| `wallet:updated` | Notificar atualização privada da carteira |

Os eventos privados não transportam valores financeiros. O frontend consulta novamente a API autenticada para obter os dados atualizados.

## Testes automatizados

O backend possui testes para:

- Autenticação e autorização.
- Refresh tokens e sessões persistentes.
- Criação, consulta e cancelamento de lotes.
- Carteiras e depósitos.
- Lances e concorrência.
- Socket.IO e isolamento de sessões.
- Liquidação e idempotência.
- Comprovantes públicos.
- Saúde da API e conexão com PostgreSQL.

Executar:

```bash
cd backend
npm run build
npm test
```

Resultado registrado em 28/10/2026:

**110 testes aprovados em 13 suítes.**

### Frontend

```bash
cd frontend
npm run build
npm run lint
```

Ambos os comandos foram executados com sucesso.

## Integração com API externa

O sistema utiliza o catálogo público DummyJSON para importar informações de produtos.

Os dados recebidos são validados com Zod, e as requisições possuem timeout.

O leiloeiro também pode cadastrar lotes manualmente, sem depender da disponibilidade do serviço externo.

## Limitações conhecidas

- O projeto utiliza saldos simulados.
- A auditoria utiliza hashes encadeados, mas ainda não possui ancoragem externa independente.
- Não há mecanismo automático de recuperação de liquidações pendentes confirmado.
- O seed não inclui lances iniciais.
- A implantação pública ainda precisa ser realizada e homologada.
- A estratégia de cookies, CORS e proteção CSRF deve ser revisada conforme os domínios utilizados em produção.

## Documentação técnica

- [Arquitetura técnica](docs/ARCHITECTURE.md)
- [Decisões técnicas](docs/DECISIONS.md)

## Uso de inteligência artificial

Ferramentas de inteligência artificial foram utilizadas como apoio à análise técnica, refatoração e documentação.

As implementações foram submetidas à revisão humana e às verificações disponíveis de compilação, lint e testes automatizados.

## Equipe


---

**ÁUREO — Plataforma de Leilões Online**

Projeto de demonstração técnica, sem transações financeiras reais.
