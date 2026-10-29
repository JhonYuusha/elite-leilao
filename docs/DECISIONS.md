# ÁUREO — Registro de Decisões Técnicas

**Projeto:** ÁUREO — Plataforma de Leilões Online
**Última revisão:** 29/10/2026
**Desenvolvimento:** João Victor
**Status geral:** Implementação publicada; revisão final de entrega em andamento.

Este documento registra as decisões arquiteturais adotadas no ÁUREO, suas justificativas, garantias, limitações e oportunidades de evolução.

Os status refletem as implementações e validações registradas até 29/10/2026.

---

## ADR-001 — Arquitetura e separação de responsabilidades

**Status:** Implementada.

### Decisão

Adotar uma arquitetura full-stack com responsabilidades distribuídas entre:

- Frontend React, Vite e TypeScript.
- Backend Node.js, Express e TypeScript.
- PostgreSQL como fonte de verdade.
- Prisma para acesso ao banco.
- Zod para validação de dados.
- Socket.IO para notificações em tempo real.
- TanStack React Query para gerenciamento de estado remoto.

O backend organiza a implementação em rotas HTTP, serviços, middlewares e schemas.

### Justificativa

As regras de negócio devem permanecer independentes da camada de transporte HTTP.

Rotas recebem requisições, validam entradas, chamam serviços e constroem respostas.

Serviços implementam regras de negócio, consultas e transações.

### Decisão adicional

Não introduzir camadas independentes de controllers e repositories sem necessidade concreta.

A separação atual evita abstrações redundantes e facilita a navegação pelo código.

---

## ADR-002 — Representação monetária

**Status:** Implementada.

### Decisão

Armazenar valores financeiros em centavos utilizando `BIGINT`.

Representar valores monetários nas respostas HTTP como strings decimais.

Exemplo:

```json
{
  "amountCents": "150000"
}
```

O valor corresponde a R$ 1.500,00.

### Justificativa

Evitar erros de precisão decorrentes de cálculos financeiros utilizando números de ponto flutuante.

### Garantias

- Operações financeiras com valores inteiros.
- Conversão explícita para strings na API.
- Validação de limites antes de operações críticas.

---

## ADR-003 — Carteiras financeiras simuladas

**Status:** Implementada e testada.

### Decisão

Cada participante possui uma carteira financeira com:

- `totalCents`: saldo total.
- `committedCents`: saldo reservado.
- `availableCents`: saldo disponível calculado.

```text
availableCents = totalCents - committedCents
```

### Regras

- Depósitos simulados aumentam o saldo.
- Depósitos geram movimentações financeiras.
- Lances líderes comprometem saldo.
- Lances superados liberam reservas anteriores.
- A liquidação converte a reserva vencedora em débito definitivo.
- Operações críticas utilizam transações PostgreSQL.

### Atualização em tempo real

O evento privado `wallet:updated` informa alterações aos usuários envolvidos.

O evento não transporta valores financeiros.

O frontend consulta novamente a API autenticada para atualizar a carteira.

---

## ADR-004 — Concorrência de lances

**Status:** Implementada e testada.

### Decisão

Serializar lances conflitantes utilizando bloqueios transacionais no PostgreSQL.

### Processamento

1. Bloquear o lote com `SELECT ... FOR UPDATE`.
2. Consultar o estado atualizado.
3. Identificar o lance anterior.
4. Bloquear carteiras em ordem determinística.
5. Consultar o horário atual do PostgreSQL.
6. Validar período, incremento e saldo.
7. Liberar a reserva anterior.
8. Reservar o novo valor.
9. Registrar movimentações financeiras.
10. Registrar o lance.
11. Atualizar o lote.

### Isolamento

Utilizar `READ COMMITTED`.

### Justificativa

Impedir que requisições concorrentes confirmem operações com base em estados desatualizados.

### Consistência dos eventos

Notificações Socket.IO são publicadas somente após a confirmação da transação.

Falhas na publicação não desfazem alterações já persistidas.

---

## ADR-005 — Histórico auditável de lances

**Status:** Implementada e testada, com limitação criptográfica documentada.

### Decisão

Encadear os lances utilizando hashes SHA-256.

Cada lance registra:

- Identificador do lote.
- Identificador do participante.
- Valor.
- Horário.
- Hash anterior.
- Hash atual.

O hash atual depende dos dados do lance e do hash anterior.

### Objetivo

Facilitar a detecção de alterações posteriores no histórico, quando comparado com uma referência íntegra.

### Limitação conhecida

Uma cadeia de hashes armazenada exclusivamente no próprio banco não oferece prova independente de imutabilidade.

Um agente com controle completo sobre o banco pode reescrever registros e recalcular a cadeia.

### Evolução futura

- Ancoragem externa independente da cadeia.
- Assinaturas digitais.
- Ancoragem externa.
- Publicação de referências criptográficas confiáveis.

A verificação pública está disponível em `GET /lots/:id/audit`, com detecção de alterações, links ausentes, bifurcações e ciclos. Não apresentar a implementação como prova independente de imutabilidade.

---

## ADR-006 — Anti-sniping

**Status:** Implementada e testada.

### Decisão

Prorrogar o encerramento quando um lance válido for aceito nos últimos dois minutos do leilão.

### Regra

```text
novoEncerramento = horarioAceitacao + 2 minutos
```

### Implementação

- Horário obtido com `clock_timestamp()` do PostgreSQL.
- Validação executada no backend.
- Atualização persistida na transação do lance.
- Novo encerramento informado ao frontend.

### Justificativa

Reduzir a vantagem de lances realizados nos instantes finais, oferecendo tempo adicional para reação.

---

## ADR-007 — Liquidação financeira idempotente

**Status:** Implementada e testada.

### Decisão

A liquidação deve preservar a consistência financeira mesmo diante de requisições repetidas ou concorrentes.

### Regras

- Apenas o leiloeiro responsável pode liquidar o lote.
- A titularidade é verificada dentro da transação.
- O lote é bloqueado antes da verificação.
- O encerramento deve ter ocorrido.
- Liquidações já registradas não geram novas transferências.
- Lotes sem lances podem ser encerrados sem movimentação financeira.

### Liquidação com vencedor

1. Validar o lance vencedor.
2. Bloquear as carteiras envolvidas.
3. Debitar o valor reservado do vencedor.
4. Liberar o compromisso financeiro.
5. Creditar o leiloeiro.
6. Registrar movimentações.
7. Registrar a liquidação.
8. Criar o comprovante.
9. Encerrar o lote.

### Limitação

A recuperação periódica de lotes expirados é executada por GitHub Actions via `npm run settle:expired`, além da liquidação manual. O workflow executou com sucesso; a ocorrência de uma liquidação efetiva disparada por ele ainda deve ser conferida nos registros.

---

## ADR-008 — Estratégia de testes

**Status:** Implementada e em evolução.

### Ferramentas

- Vitest.
- Supertest.
- TypeScript.
- ESLint.

### Resultado registrado em 28/10/2026

**127 testes aprovados em 17 arquivos de teste do backend**, conforme última execução registrada.

### Funcionalidades cobertas

- Autenticação.
- Autorização.
- Refresh tokens.
- Revogação de sessões.
- Saúde da API.
- Conexão com PostgreSQL.
- Catálogo público.
- Criação de lotes.
- Gerenciamento e cancelamento.
- Carteiras.
- Depósitos simulados.
- Lances.
- Concorrência.
- Liquidação.
- Idempotência.
- Comprovantes.
- Socket.IO.
- Isolamento de eventos privados.
- Auditoria e ordenação da cadeia de hashes.
- Histórico de lances e arremates.

### Validações adicionais

- Build do backend aprovado.
- Build do frontend aprovado.
- ESLint do frontend aprovado.
- Sincronização bidirecional de lances validada manualmente.

### Evolução futura

Ampliar testes automatizados da interface e executar homologação ponta a ponta no ambiente publicado.

---

## ADR-009 — Comunicação em tempo real

**Status:** Implementada e testada.

### Decisão

Utilizar Socket.IO para notificar alterações sem substituir o banco de dados como fonte de verdade.

### Eventos públicos

- `lot:join`.
- `lot:leave`.
- `lot:updated`.
- `lots:updated`.

### Evento privado

- `wallet:updated`.

### Segurança

Conexões anônimas podem acompanhar eventos públicos.

Conexões autenticadas apresentam JWT validado no handshake.

A identidade é derivada exclusivamente do token validado.

Salas privadas são definidas pelo servidor utilizando o identificador do usuário.

O cliente não pode selecionar a sala privada de outro participante.

### Expiração

A conexão autenticada é encerrada quando o JWT expira.

O frontend sincroniza a conexão quando o access token muda.

### Privacidade

Notificações privadas não transportam o saldo da carteira.

---

## ADR-010 — Experiência de carregamento

**Status:** Implementada.

### Decisão

Padronizar os estados de carregamento com identidade visual própria.

### Componentes

- `AureoLoader`.
- `SplashScreen`.
- `useMinimumLoading`.

### Comportamento

- Exibir carregamento durante a inicialização.
- Informar o processamento de autenticação.
- Desabilitar controles durante operações pendentes.
- Restaurar a interação após falhas.
- Considerar preferências de movimento reduzido.

### Observação

A duração mínima de carregamento é uma escolha visual e não uma exigência de segurança.

Seu impacto no desempenho percebido deve ser avaliado em produção.

---

## ADR-011 — Organização dos estilos

**Status:** Implementada.

### Decisão

Centralizar os arquivos CSS em `frontend/src/styles`.

### Estrutura

```text
styles/
├── components/
├── global/
└── pages/
```

### Objetivos

- Facilitar a manutenção.
- Melhorar a navegação pelo projeto.
- Separar estilos globais, componentes e páginas.
- Reduzir dispersão de arquivos.

### Validação

Build e ESLint do frontend aprovados após a reorganização.

---

## ADR-012 — Autenticação e sessões persistentes

**Status:** Implementada e testada.

### Decisão

Utilizar JWT para acesso à API e refresh tokens rotativos para renovação das sessões.

### Implementação

- Senhas protegidas com bcryptjs.
- Access token JWT de curta duração.
- Refresh token armazenado em cookie HttpOnly.
- Hash do refresh token persistido no PostgreSQL.
- Rotação durante a renovação.
- Revogação de sessões.
- Detecção de reutilização de refresh tokens.
- Access token mantido em memória no frontend.

### Proteções

As rotas de renovação e logout exigem origem confiável.

O backend valida a autenticação e autorização independentemente do frontend.

### Limitação de implantação

A configuração atual do refresh cookie utiliza `SameSite=Lax`.

Se frontend e backend forem hospedados em sites distintos, será necessário revisar cookies, CORS e proteção CSRF antes da homologação.

---

## ADR-013 — Integração com API externa

**Status:** Implementada.

### Decisão

Permitir a importação de metadados de produtos do DummyJSON.

### Estratégia

- Requisições HTTP ao catálogo externo.
- Timeout de cinco segundos.
- Validação da resposta com Zod.
- Tratamento de respostas inválidas.
- Tratamento de indisponibilidade.
- Armazenamento de snapshot dos dados relevantes.

### Resiliência

O cadastro manual de lotes não depende da disponibilidade da API externa.

### Interface de seleção

A busca por nome na DummyJSON é realizada pelo frontend, com seleção visual e prévia. Na criação do lote, o backend consulta novamente o item e valida os metadados, evitando confiar no conteúdo apresentado pelo navegador.

### Limitação

Não há mecanismo avançado de cache, fila ou circuit breaker confirmado.

---

## ADR-014 — Comprovantes públicos

**Status:** Implementada e testada.

### Decisão

Criar comprovantes de liquidação consultáveis por token público aleatório.

### Informações

- Identificação do lote.
- Título do item.
- Alias do vencedor.
- Valor da liquidação.
- Data da operação.

### Privacidade

O comprovante evita divulgar informações pessoais desnecessárias do vencedor.

### Limitação

A existência de um comprovante público não equivale a uma assinatura digital ou certificação externa da operação.

---

## ADR-015 — Documentação e implantação

**Status:** Implantação realizada; documentação em atualização.

### Decisão

Manter a documentação alinhada à implementação real.

### Documentos

- `README.md`: apresentação, instalação e funcionalidades.
- `docs/ARCHITECTURE.md`: arquitetura e fluxos técnicos.
- `docs/DECISIONS.md`: decisões, justificativas e limitações.

### Requisitos para implantação

1. Hospedagem pública do backend.
2. Banco PostgreSQL configurado.
3. Aplicação das migrations.
4. Variáveis de ambiente seguras.
5. Hospedagem pública do frontend.
6. Configuração de CORS.
7. Revisão da estratégia de cookies.
8. Comunicação Socket.IO sobre HTTPS.
9. Testes ponta a ponta.
10. Atualização dos links de demonstração.

### Observação

Frontend na Vercel, API e PostgreSQL no Render, com validação manual de lances em tempo real, reservas e liquidação. A revisão final de credenciais e lote ao vivo permanece necessária.

---


---

## ADR-016 — Catálogo público e estados temporais

**Status:** Implementada.

O catálogo separa lotes ao vivo, agendados e encerrados, com busca textual e contagem por categoria. A interface calcula o estado efetivo considerando `startsAt` e `endsAt`; lotes cancelados são omitidos do catálogo público. A decisão de aceitar lances permanece exclusivamente no backend.

---

## ADR-017 — Arremates e comprovantes compartilháveis

**Status:** Implementada.

O endpoint `GET /bids/mine` agrega participações por lote e informa situação, maior lance do usuário e comprovante quando existente. O comprovante pode ser consultado publicamente por token aleatório em `GET /receipts/:token`, sem expor identidade privada do vencedor.

---

## ADR-018 — Liquidação automática por agendamento externo

**Status:** Workflow executado com sucesso; efeito em lote expirado ainda sujeito a verificação.

Um workflow do GitHub Actions roda periodicamente e sob acionamento manual, usando `SETTLEMENT_DATABASE_URL` em GitHub Secrets e `EXTERNAL_SETTLEMENT=true` para a conexão PostgreSQL externa. O job executa `npm run settle:expired` e depende da idempotência do serviço de liquidação para evitar dupla movimentação. Testes não devem apontar para o banco de produção.

---

## ADR-019 — Busca visual DummyJSON com revalidação no servidor

**Status:** Implementada e verificada manualmente.

O leiloeiro pesquisa e seleciona produtos com miniatura no frontend. O backend reconsulta o produto selecionado por ID e armazena um snapshot validado; título, imagem e descrição exibidos no cliente não são aceitos como fonte de verdade. O cadastro manual permanece disponível.

---

## ADR-020 — Otimização de bundle como melhoria posterior

**Status:** Decisão de priorização.

O build de produção e o ESLint do frontend passaram. O Vite emitiu aviso não bloqueante porque o bundle principal minificado ultrapassou 500 kB (547,76 kB; 167,65 kB gzip na execução registrada). Optou-se por não introduzir divisão de código às vésperas da entrega; avaliar lazy loading por rota posteriormente.

## Pendências priorizadas

### Prioridade imediata

1. Confirmar acesso às três contas demonstrativas e um lote efetivamente ao vivo.
2. Conferir resultado financeiro e comprovante em produção.
3. Finalizar README, arquitetura e registro de decisões.
4. Revisão humana final e submissão do desafio.

### Melhorias posteriores

- Confirmar por logs uma liquidação efetiva realizada pelo agendador.
- Otimizar o bundle do frontend com code splitting, se necessário.
- Fortalecer a auditoria com ancoragem externa.
- Ampliar testes automatizados do frontend.
- Avaliar desempenho e acessibilidade.
- Remover arquivos vazios não utilizados.
- Melhorar a observabilidade da aplicação.

---

## Estado de validação

**Revisão:** 29/10/2026.

| Verificação | Resultado |
|---|---|
| Backend — build | Aprovado |
| Backend — testes | 127/127 |
| Backend — suítes | 17 arquivos aprovados |
| Frontend — build | Aprovado |
| Frontend — ESLint | Aprovado |
| Git — último commit funcional | Consultar `git log -1 --oneline` antes da entrega |

Os testes automatizados demonstram o funcionamento dos cenários cobertos, mas não substituem uma auditoriaexterna de segurança.

A implantação pública foi realizada; a homologação final está em andamento.

---

**ÁUREO — Plataforma de Leilões Online**

Registro técnico das decisões adotadas durante o desenvolvimento.