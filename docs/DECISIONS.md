
# ÁUREO — Registro de Decisões Técnicas

## ADR-001 — Arquitetura

**Status:** Adotada

- Backend: Node.js, Express e TypeScript.
- Frontend: React, Vite e TypeScript.
- Banco de dados: PostgreSQL.
- ORM: Prisma.
- Autenticação: JWT.
- Comunicação em tempo real: Socket.IO.

O PostgreSQL será a fonte de verdade para saldos, lances e encerramentos.

## ADR-002 — Representação monetária

**Status:** Adotada

Todos os valores monetários serão armazenados em centavos, usando `BIGINT`.

Na API, valores monetários serão representados como strings decimais para evitar perda de precisão no JavaScript.

Exemplo:

`"150000"` representa R$ 1.500,00.

## ADR-003 — Carteira

**Status:** Implementada inicialmente

Cada participante possui uma carteira com:

- `totalCents`: saldo total.
- `committedCents`: saldo reservado em lances líderes.
- Saldo disponível = total - reservado.

Depósitos de demonstração serão registrados no histórico financeiro.

A carteira utiliza transações PostgreSQL e bloqueio de linha para operações de depósito.

## ADR-004 — Lances e concorrência

**Status:** Planejada

Um lance somente será aceito quando:

- O usuário estiver autenticado como participante.
- O lote estiver dentro do período válido de leilão.
- O valor respeitar o lance mínimo e o incremento.
- O participante possuir saldo disponível suficiente.
- O participante não for o líder atual do mesmo lote.

A aceitação do lance deverá ocorrer em uma única transação PostgreSQL.

A transação deverá:

1. Bloquear o lote.
2. Validar o lance contra o estado atualizado.
3. Bloquear as carteiras envolvidas em ordem determinística.
4. Liberar a reserva do líder anterior.
5. Reservar o valor do novo líder.
6. Registrar as movimentações financeiras.
7. Registrar o lance e atualizar o lote.

Nenhum evento de tempo real deverá ser emitido antes do commit.

## ADR-005 — Histórico auditável

**Status:** Planejada

Os lances formarão uma cadeia de hashes.

Cada registro conterá:

- Valor do lance.
- Identificador do lote.
- Identificador do participante.
- Data e hora.
- Hash anterior.
- Hash do lance atual.

A cadeia permitirá detectar alterações posteriores no histórico.

Uma âncora externa poderá complementar a auditoria.

## ADR-006 — Anti-sniping

**Status:** Planejada

Um lance válido recebido nos últimos dois minutos do leilão prorrogará o encerramento para dois minutos após o lance.

A extensão deverá ser persistida na mesma transação do lance.

## ADR-007 — Liquidação

**Status:** Planejada

Ao encerrar o leilão:

- O vencedor terá o valor reservado debitado.
- O leiloeiro receberá o crédito correspondente.
- A liquidação será idempotente.
- Será gerado um comprovante público verificável.

## ADR-008 — Estratégia de testes

**Status:** Em execução

Os testes automatizados utilizam Vitest e Supertest.

A suíte atual possui 31 testes aprovados, cobrindo:

- Autenticação e autorização.
- Saúde da API e banco de dados.
- Catálogo e criação de lotes.
- Depósitos e consultas de carteira.
- Validação monetária.
- Concorrência básica entre depósitos.

Próximos testes prioritários:

- Lances simultâneos.
- Saldo insuficiente.
- Liberação de reservas.
- Anti-sniping.
- Liquidação idempotente.