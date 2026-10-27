# ÁUREO — Registro de Decisões Técnicas

**Projeto:** ÁUREO — Plataforma de Leilões Online
**Última revisão:** 26/10/2026
**Responsável pelo desenvolvimento:** João Victor
**Apoio na análise técnica:** Kauã

Este documento registra as principais decisões de arquitetura, suas justificativas, o estado atual de implementação e os aprimoramentos previstos.

---

## ADR-001 — Arquitetura

**Status:** Adotada e implementada

### Tecnologias

- **Backend:** Node.js, Express e TypeScript.
- **Frontend:** React, Vite e TypeScript.
- **Banco de dados:** PostgreSQL.
- **ORM:** Prisma.
- **Autenticação:** JWT.
- **Comunicação em tempo real:** Socket.IO.
- **Validação de dados:** Zod.
- **Gerenciamento de estado remoto:** TanStack React Query.
- **Testes:** Vitest e Supertest.
- **Infraestrutura local:** Docker Compose.

### Decisão

O backend concentra as regras de negócio, enquanto o frontend consome a API HTTP e recebe notificações de atualização via Socket.IO.

O PostgreSQL permanece como fonte de verdade para saldos, lances, reservas financeiras e encerramentos.

Eventos em tempo real não substituem a persistência nem a validação no servidor.

---

## ADR-002 — Representação monetária

**Status:** Implementada

Todos os valores monetários são armazenados em centavos, utilizando `BIGINT`.

Na API, valores monetários são representados como strings decimais, evitando perda de precisão decorrente do tipo `number` do JavaScript.

**Exemplo:**

`"150000"` representa R$ 1.500,00.

As operações financeiras utilizam valores inteiros, sem depender de cálculos monetários com ponto flutuante.

---

## ADR-003 — Carteira financeira

**Status:** Implementada

Cada participante possui uma carteira com:

- `totalCents`: saldo total.
- `committedCents`: saldo reservado em lances líderes.
- `availableCents`: saldo disponível, calculado pela diferença entre total e reservado.

### Regras

- Depósitos de demonstração são registrados no histórico financeiro.
- Lances aceitos reservam saldo.
- Quando um lance é superado, sua reserva é liberada.
- A carteira do novo líder recebe a reserva correspondente.
- Operações financeiras utilizam transações PostgreSQL.
- Bloqueios de linha protegem operações concorrentes.

### Aprimoramento pendente

Sincronizar as carteiras em tempo real quando um participante for superado, utilizando eventos privados autenticados.

---

## ADR-004 — Lances e concorrência

**Status:** Implementada e testada

Um lance somente é aceito quando:

1. O usuário está autenticado como participante.
2. O lote está dentro do período válido de leilão.
3. O valor respeita o lance mínimo e o incremento.
4. Existe saldo disponível suficiente.
5. O participante não é o líder atual do mesmo lote.

### Processamento transacional

A aceitação ocorre em uma única transação PostgreSQL:

1. Bloqueio do lote com `SELECT ... FOR UPDATE`.
2. Consulta e validação do estado atualizado.
3. Bloqueio das carteiras envolvidas em ordem determinística.
4. Validação do horário utilizando o relógio do PostgreSQL.
5. Liberação da reserva do líder anterior.
6. Reserva do valor do novo líder.
7. Registro das movimentações financeiras.
8. Registro do lance.
9. Atualização do lote e de seu horário de encerramento, quando necessário.

A transação utiliza isolamento `READ COMMITTED`.

### Decisão de consistência

Eventos Socket.IO são publicados somente depois da confirmação da transação.

Uma falha na publicação do evento não desfaz um lance já confirmado no banco.

---

## ADR-005 — Histórico auditável

**Status:** Implementação inicial concluída

Os lances formam uma cadeia de hashes SHA-256.

Cada registro contém:

- Identificador do lote.
- Identificador do participante.
- Valor do lance.
- Data e hora de aceitação.
- Hash anterior.
- Hash do lance atual.

O hash é calculado a partir dos dados do lance e da referência ao registro anterior.

### Objetivo

Permitir a detecção de alterações posteriores nos dados encadeados, mediante verificação da cadeia.

### Limitação conhecida

Uma cadeia de hashes armazenada no mesmo banco não constitui, isoladamente, uma prova externa e imutável.

Uma âncora externa ou mecanismo independente de verificação poderá fortalecer a auditoria futuramente.

---

## ADR-006 — Anti-sniping

**Status:** Implementada

Um lance válido recebido nos últimos dois minutos do leilão prorroga o encerramento para dois minutos após sua aceitação.

### Decisões

- O horário de aceitação é obtido do PostgreSQL.
- A prorrogação é calculada no backend.
- O novo encerramento é persistido na mesma transação do lance.
- O frontend recebe a atualização do horário por meio da API e dos eventos de tempo real.

O objetivo é reduzir a vantagem de lances feitos nos instantes finais sem possibilidade de reação dos demais participantes.

---

## ADR-007 — Liquidação

**Status:** Implementada e testada

Ao liquidar um lote encerrado:

- O valor reservado do vencedor é utilizado na liquidação.
- O leiloeiro recebe o crédito correspondente.
- As movimentações financeiras são registradas.
- A liquidação é idempotente.
- Existe funcionalidade de comprovante de liquidação.

### Decisões

A liquidação deve preservar a consistência financeira, inclusive diante de chamadas repetidas e operações concorrentes.

A suíte automatizada cobre transferência de valores, idempotência e preservação de créditos em liquidações simultâneas.

A verificabilidade pública do comprovante deve continuar sendo avaliada separadamente da simples existência do documento.

---

## ADR-008 — Estratégia de testes

**Status:** Implementada e em evolução

O backend utiliza Vitest e Supertest para testes automatizados.

### Estado atual

**85 testes aprovados, distribuídos em 10 arquivos de teste.**

### Cobertura funcional existente

- Autenticação e autorização.
- Saúde da API e conexão com PostgreSQL.
- Catálogo público.
- Criação e gerenciamento de lotes.
- Cancelamento de lotes.
- Validação de valores monetários.
- Depósitos e consultas de carteira.
- Registro de lances e reservas financeiras.
- Cenários de concorrência.
- Liquidação e idempotência.
- Comprovantes.

### Validações adicionais

- Compilação TypeScript do backend.
- Build de produção do frontend.
- ESLint do frontend.
- Teste manual da sincronização bidirecional de lances.

### Próximas prioridades

- Testes automatizados de conexão e eventos Socket.IO.
- Testes de autenticação e isolamento de salas privadas.
- Testes de reconexão e troca de sessão.
- Ampliação dos testes de integração do frontend.

---

## ADR-009 — Comunicação em tempo real

**Status:** Implementação inicial concluída

### Decisão

Utilizar Socket.IO para notificar clientes sobre alterações de lances e lotes.

### Eventos existentes

- `lot:join`: entrada na sala de um lote.
- `lot:leave`: saída da sala.
- `lot:updated`: atualização de um lote específico.
- `lots:updated`: sinalização de alteração no catálogo.

### Funcionamento

Após a confirmação de um lance, o backend publica os eventos correspondentes.

No frontend, os eventos invalidam consultas do TanStack React Query, que recupera os dados atualizados da API.

### Validação realizada

A atualização automática de lances foi testada manualmente entre duas sessões independentes, funcionando nos dois sentidos.

### Limitações e próximos passos

- Autenticar conexões Socket.IO com JWT.
- Criar salas privadas associadas à identidade validada pelo servidor.
- Implementar o evento privado `wallet:updated`.
- Sincronizar reservas e liberações financeiras sem transmitir saldos em canais públicos.
- Adicionar testes automatizados de segurança e reconexão.

As salas de lotes existentes são utilizadas para atualização de informações públicas. Não devem transportar dados financeiros privados.

---

## ADR-010 — Experiência de carregamento

**Status:** Implementada

### Decisão

Adotar uma identidade visual de carregamento consistente com a proposta do ÁUREO.

### Componentes

- `AureoLoader`: balança animada reutilizável.
- `SplashScreen`: tela de abertura.
- `useMinimumLoading`: controle de duração mínima de apresentação.

### Comportamento

- A tela de abertura aparece durante a inicialização e restauração da sessão.
- O loading de login aparece enquanto a autenticação é processada.
- Campos e controles de envio ficam desabilitados durante a requisição.
- Falhas de autenticação devolvem o controle ao usuário.
- As animações respeitam a preferência por movimento reduzido.

### Observação

A duração mínima de apresentação é uma decisão de experiência visual, não uma exigência da autenticação.

Seu impacto na velocidade percebida deverá ser reavaliado antes de uma implantação em produção.

---

## ADR-011 — Organização dos estilos

**Status:** Planejada

### Decisão proposta

Centralizar os arquivos CSS em `frontend/src/styles`, mantendo a separação por responsabilidade.

Estrutura prevista:

```text
styles/
├── global/
├── components/
└── pages/
```

### Objetivos

- Padronizar a localização dos estilos.
- Facilitar a navegação e a revisão do código.
- Preservar a separação entre estilos globais, componentes e páginas.
- Evitar alterações visuais durante a reorganização.

### Estratégia

Realizar a migração em um commit exclusivamente de refatoração, ajustando os imports e validando build, lint e interface após a mudança.

---

## ADR-012 — Autenticação e isolamento de eventos privados

**Status:** Planejada

### Decisão

Reutilizar a validação JWT existente do backend na autenticação de conexões Socket.IO.

### Regras previstas

- Validar o token durante a conexão.
- Derivar a identidade do usuário exclusivamente do JWT validado.
- Impedir que o cliente escolha a sala privada de outro participante.
- Notificar alterações financeiras somente aos usuários envolvidos.
- Desconectar ou reautenticar o socket após login, logout ou troca de conta.
- Não enviar valores de carteira em eventos públicos.

### Objetivo

Garantir que a atualização em tempo real preserve as mesmas fronteiras de autenticação e privacidade aplicadas às rotas HTTP.

---

## Próximas atividades

### Prioridade imediata

1. Reorganizar os arquivos CSS em `frontend/src/styles`.
2. Implementar autenticação JWT no Socket.IO.
3. Sincronizar carteiras por eventos privados.
4. Criar testes de isolamento, reconexão e autorização dos eventos.

### Melhorias posteriores

- Ampliar testes automatizados do frontend.
- Revisar acessibilidade e desempenho das animações.
- Fortalecer a verificabilidade externa do histórico auditável.
- Revisar a documentação de execução e demonstração.

---

## Estado de validação da revisão

Na última execução registrada:

- Backend: build aprovado.
- Backend: 85/85 testes aprovados.
- Frontend: build de produção aprovado.
- Frontend: ESLint aprovado.
- Socket.IO: sincronização bidirecional de lances validada manualmente.
- Git: alterações de tempo real e carregamento enviadas à branch `main`.

**Observação:** as funcionalidades planejadas neste documento não devem ser consideradas implementadas até que sejam desenvolvidas e validadas.