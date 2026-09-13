# MEMORY.md

Resumo vivo do estado do projeto. Detalhe maior vai em `docs/topics/`
(ainda não existe nenhum tópico — criar quando este arquivo passar de
~200 linhas).

## Estado atual (2026-09-12)

- Projeto criado do zero: DDD modelado, monorepo pnpm scaffolded,
  domínio + aplicação + infraestrutura + web (Next.js) + worker
  implementados end-to-end.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` — todos
  passando limpos.
- **Rodado localmente de ponta a ponta** (Postgres em Docker, web/worker
  nativos): criar lembrete pela API funciona, scheduler pega o vencido,
  chama a Evolution API, registra `Envio`, atualiza status. Dois bugs
  reais encontrados e corrigidos nesse teste (ver abaixo).
- **Envio real de WhatsApp CONFIRMADO funcionando** (2026-09-12,
  23:38 -03). A instância original "Sophia" nunca aceitou enviar (500
  "Connection Closed" mesmo com `state: "open"" — instância com problema
  de conexão real, não corrigível pelo código). O usuário trocou para
  uma instância nova chamada **"advice"**, autenticando com **API key
  global** (não mais apikey por instância). Com isso, o envio funcionou
  de primeira: `mensagem_provider_id: 3EB004C90AB14319A3826E`, lembrete
  foi para `ENVIADO`. **Config atual que funciona**:
  `EVOLUTION_INSTANCE_NAME=advice`, `EVOLUTION_API_KEY=<api key global>`.
- **Não deployado no VPS ainda.**

## Bugs encontrados e corrigidos rodando de verdade

- `EvolutionApiNotificador` mandava `textMessage: { text }` (formato de
  doc genérica que eu tinha usado); a instância real da Evolution API
  rejeitava com `400: instance requires property "text"`. Corrigido pra
  `text` direto no corpo — ver `packages/infrastructure/src/whatsapp/EvolutionApiNotificador.ts`.
- Numeração de `tentativa` em `Envio` não é atômica (`contarTentativas` +
  `salvar` em dois passos) — sob dois processos do worker rodando ao
  mesmo tempo (aconteceu aqui por um erro meu de restart local, matando
  o processo errado), gera `tentativa` duplicada/pulada. Em produção
  isso está coberto pela restrição de 1 réplica do worker
  (`docker-stack.yml`), mas é uma fragilidade real se algum dia dois
  processos rodarem simultâneos (ex: deploy mal coordenado). Não
  corrigido ainda — anotado como dívida técnica.

## Decisões de produto confirmadas com o fundador

- Destinatário único e fixo: `5522999491428`.
- Sem recorrência na v1 — só lembretes pontuais (dia + hora específicos).
- Deploy no mesmo VPS onde a Evolution API (`evolution.autozapx.com`) já
  roda — Docker Swarm + Traefik, VPS `167.88.42.134`. Domínio confirmado:
  `advice.autozapx.com`. Deploy é "no futuro" (não imediato) — ver
  `docker-stack.yml`.
- Instância da Evolution API usada de fato: **"advice"** (não mais
  "Sophia" — trocada em 2026-09-12 porque a Sophia não enviava, ver
  acima), com **API key global**, não apikey por instância.

## Decisões técnicas com "por quê" não óbvio

Ver `ARCHITECTURE.md` (seção "Stack e por quê") para a tabela completa.
As que mais provavelmente geram confusão numa sessão futura:
- ESLint pinado em 9.x (não a versão mais nova) — 10.x quebra
  `eslint-plugin-react` de verdade, testado nesta máquina.
- Zod pinado em 4.5.4 (não 4.6.4) — 4.6.4 foi publicada horas antes do
  setup; pnpm bloqueou por política de idade mínima de release.
- `getEnv()`/`getDb()` são lazy de propósito — não é um resquício,
  quebra `next build` se voltar a ser eager.

## Próximo passo natural

Envio real confirmado — falta só o deploy no VPS (`docker-stack.yml`).
Nesse ponto, considerar rodar `/hm-security` L1 (recomendado pelo
próprio `/hm-init`) antes de expor `advice.autozapx.com` publicamente.
Lembrar de preencher `.env` no VPS com `EVOLUTION_INSTANCE_NAME=advice`
e a API key global (não a antiga apikey da Sophia).
