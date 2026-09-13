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
- **Código no GitHub**: `https://github.com/venturafvx/advice` (público),
  branch `main`. Push feito via `gh` (autenticado como `venturafvx`).
  `.env` real e o arquivo `VPS_SUBIR_PASSO_A_PASSO*.md` (não é deste
  projeto, tem IP/acesso do VPS) ficaram de fora de propósito — ver
  `.gitignore`.
- **Deploy no VPS em andamento** — ver seção "VPS de produção" abaixo.

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

## VPS de produção (Monadaserver, 167.88.42.134) — estrutura real confirmada

- Docker Swarm com dezenas de stacks já rodando: `vidanovaguarus_web`,
  `torredeoracao_web`, `evolution_evolution_api` (+ redis própria),
  `postgres_postgres` (compartilhado, Postgres 14), `n8n_*`, `mongodb_*`
  (exposto publicamente na porta 27017 — não é nosso problema, mas
  notar), `traefik_traefik` (Traefik v3.5.3), entre outros.
- **Rede compartilhada real: `Monadanet`** (overlay). Não existe rede
  chamada "traefik-public" — confirmado com `docker network ls` e
  inspecionando `vidanovaguarus_web`.
- Traefik: routers usam `tls: true` **sem** `certresolver` explícito no
  label (confirmado no `vidanovaguarus_web`, que funciona em produção).
  Dois routers por app — um em `entrypoints=web` (HTTP), outro em
  `entrypoints=websecure` com `tls=true`.
- `docker stack deploy` **não suporta `env_file:`** — só `docker compose
  up` suporta. `docker-stack.yml` usa `${VAR}` (Docker resolve lendo o
  `.env` no mesmo diretório no momento do deploy).
- Convenção de projeto: cada app fica em `/var/www/<nome>`, com um
  `docker-compose.yml` (mesmo rodando via `docker stack deploy`, não
  `docker compose up` — nome do arquivo é só convenção deles) e um
  `deploy-<nome>.sh` na raiz de `/var/www`. `advice` usa nomes de
  arquivo diferentes (`docker-compose.yml` = dev local real,
  `docker-stack.yml` = produção Swarm) porque, ao contrário dos outros
  projetos, este tem workflow de dev local de verdade.
- `git` 2.30.2 já instalado no VPS. 131GB livres em `/`. Decisão: clonar
  `https://github.com/venturafvx/advice.git` em `/var/www/advice`.
- Evolution API não tem porta publicada no Swarm (`Endpoint.Ports: null`)
  e não tem pasta em `/var/www` — rodando só via `docker stack deploy`
  direto, imagem `evoapicloud/evolution-api:latest`. Daria pra falar com
  ela via rede interna (`http://evolution_api:8080` provavelmente,
  alias confirmado é `evolution_api`), mas não confirmei a porta —
  ficamos com a URL pública (`https://evolution.autozapx.com`), que já
  está comprovadamente funcionando. Otimização de rede interna fica como
  ideia futura, não prioridade.
- Postgres: decisão explícita do fundador foi **dedicado** para o
  advice (não usar o `postgres_postgres` compartilhado) — isolamento e
  simplicidade de backup.

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

## Bugs encontrados durante o deploy real no VPS

- `docker stack deploy` **não substitui `${VAR}` lendo `.env`** (ao
  contrário de `docker compose up`) — `POSTGRES_PASSWORD` chegou vazio
  no container, Postgres recusou subir. Fix: exportar as variáveis no
  shell (`set -a && source .env && set +a`) antes de
  `docker stack deploy`.
- `apps/worker/Dockerfile` copiava só o `node_modules` da raiz —
  faltava `apps/worker/node_modules` (symlinks pnpm das dependências
  diretas: `dotenv`, `node-cron`) e o mesmo valeria pra
  `packages/infrastructure` (`drizzle-orm`, `postgres`, `zod`) assim
  que passasse do primeiro `require`. Corrigido usando `pnpm deploy
  --prod` (materializa um `node_modules` completo e autocontido para o
  worker, incluindo os workspace packages) em vez de copiar pastas na
  mão. Precisou adicionar `"files": ["dist"]` (e `"drizzle"` na
  infrastructure) nos `package.json` dos packages pra `pnpm deploy`
  saber o que empacotar. `apps/web` nunca teve esse problema — o
  `.next/standalone` do Next já resolve isso sozinho.

## Próximo passo natural

Deploy no VPS em andamento, guiado comando a comando (sem acesso SSH
direto desta máquina — só a deploy key do `sitevidanova` existe aqui, e
é scoped só àquele repo). Falta: clonar o repo em `/var/www/advice`,
criar `.env` real lá (`EVOLUTION_INSTANCE_NAME=advice`, API key global),
buildar as duas imagens e rodar `docker stack deploy -c docker-stack.yml
advice`. Depois, considerar `/hm-security` L1 antes de considerar o
domínio realmente "em produção" pra valer.
