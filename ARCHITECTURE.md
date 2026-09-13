# Arquitetura

Ver [`docs/DOMAIN.md`](docs/DOMAIN.md) para a modelagem DDD (bounded
contexts, aggregates, linguagem ubíqua). Este documento cobre stack,
infraestrutura e decisões de segurança.

## Stack e por quê

| Escolha | Alternativas consideradas | Por que essa |
|---|---|---|
| **TypeScript 5.9** (não TS 7) | TS 7 (novo compilador nativo) | TS 7 é recém-lançado; `typescript-eslint` ainda trava em `<6.1.0` como peer dependency — confirmado instalando e testando. Adotar TS 7 agora quebraria o linting. Reavaliar quando o ecossistema (typescript-eslint, ts-node/tsx) alcançar. |
| **Next.js 16 (App Router)** | Remix, SvelteKit | Já é a escolha natural para um app fullstack pequeno em TS: API routes + UI no mesmo projeto, deploy standalone leve em Docker, sem servidor separado para a API. |
| **pnpm workspaces** (sem Turborepo) | npm/yarn workspaces, Turborepo | pnpm é o mais rápido e mais seguro em disco (content-addressable store, non-hoisting evita "phantom dependencies"). Turborepo adicionaria cache de build distribuído que não faz diferença nesta escala (5 packages, build local). |
| **Drizzle ORM + `postgres`** | Prisma | Drizzle gera SQL explícito, sem binário de engine separado (Prisma baixa um binário nativo por plataforma — mais superfície e mais peso na imagem Docker), migrations como SQL puro e legível. |
| **PostgreSQL** | SQLite | Evita os limites de concorrência de escrita do SQLite e é o denominador comum de qualquer Postgres gerenciado — trocar de provedor não toca em uma linha de código. |
| **Supabase** (Postgres gerenciado) como banco de produção | Postgres em container no próprio VPS | O container era o caminho mais barato, mas deixava o dado num volume de nó único, sem backup, sem PITR e sem plano de restauração — um disco perdido levava junto todos os Lembretes. O Supabase é Postgres puro (17.6), então o custo da troca foi só a `DATABASE_URL`: Drizzle, repositórios e domínio ficaram intactos. Não usamos `supabase-js`: web e worker são processos de servidor, falam Postgres direto, e passar por PostgREST seria um salto de rede a mais sem ganho nenhum. |
| **`node-cron`** (polling a cada minuto) | BullMQ + Redis | Granularidade de "dia e hora" não precisa de precisão de segundo — polling de 1 min é suficiente e não exige Redis. Adicionar uma fila com broker seria complexidade sem propósito real neste volume (uso pessoal). |
| **ESLint 9.39.5** (não 10.x) | ESLint 10 (atual) | Testado nesta máquina: ESLint 10 quebra `eslint-plugin-react` (usa `context.getFilename()`, removido no ESLint 10) — `eslint-config-next` 16.3.5 ainda depende de uma versão do plugin sem esse fix. ESLint 9 está fora de suporte oficial, mas é a única combinação que funciona hoje com o lint do Next. Reavaliar quando `eslint-config-next` atualizar. |
| **Zod 4.5.4** (não 4.6.4, a mais recente) | Zod 4.6.4 | 4.6.4 foi publicada horas antes deste setup — o próprio pnpm bloqueou por política de idade mínima de release (proteção contra supply-chain: dá tempo da comunidade flagar uma versão comprometida antes de instalar). Pinado em 4.5.4 (~2 semanas de idade) em vez de simplesmente contornar a política. |
| **CommonJS** nos packages de backend (não ESM/`NodeNext`) | ESM puro | Evita a exigência do Node ESM de extensão `.js` explícita em todo import relativo — fricção real sem benefício num monorepo privado que não é publicado como lib. `postgres`, `drizzle-orm` e `node-cron` têm build CJS oficial, então não há perda de compatibilidade. |

Todas as versões acima foram checadas contra o registro do npm no momento
do setup (não “de memória”) e o build, o typecheck, o lint e os testes
foram executados de verdade nesta máquina antes deste documento ser
escrito — ver seção "O que foi validado" no fim.

## Estrutura do monorepo

```
advice/
├── packages/
│   ├── domain/          → regras de negócio puras, zero dependência de framework
│   ├── application/     → casos de uso, orquestra domain + ports
│   └── infrastructure/  → Drizzle (Postgres), adapter da Evolution API, env
├── apps/
│   ├── web/              → Next.js: UI + API routes (composition root em src/lib/container.ts)
│   └── worker/            → scheduler (node-cron), roda o caso de uso a cada minuto
├── docker-compose.yml           → produção (VPS)
├── docker-compose.override.yml  → dev local (só sobe o Postgres de dev)
└── docs/DOMAIN.md
```

`domain` não importa nada de `application`, `infrastructure` ou dos apps.
`application` só conhece as interfaces (`ports`) exportadas por `domain`,
nunca uma implementação concreta. `infrastructure` é o único lugar que
conhece Drizzle, Postgres e a Evolution API. Um engenheiro sênior lendo
essa árvore sabe, sem abrir um arquivo, onde cada tipo de mudança deveria
acontecer.

## Fluxo de agendamento e envio

1. UI (`apps/web`) envia `POST /api/lembretes` com título, dia e hora.
2. A rota valida com Zod, converte para `Date` e chama o caso de uso
   `criarLembrete` (camada de aplicação), que aciona o aggregate
   `Lembrete.criar` (domínio) e persiste via `LembreteRepository`.
3. O worker (`apps/worker`) roda `node-cron` a cada minuto, chamando
   `processarLembretesPendentes`: busca vencidos, chama
   `NotificadorWhatsApp.enviar` (implementado por `EvolutionApiNotificador`,
   que fala HTTP com a Evolution API), registra o `Envio` e atualiza o
   status do `Lembrete`.
4. A UI reflete o status (`PENDENTE` / `ENVIADO` / `FALHOU` / `CANCELADO`)
   na próxima vez que busca a lista.

## Timezone

Os containers `web` e `worker` rodam com `TZ=America/Sao_Paulo` fixo
(`docker-compose.yml`). O input `datetime-local` do formulário (sem
timezone) é interpretado pelo `new Date(...)` do runtime Node como hora
local do processo — por isso o `TZ` do container precisa bater com o
timezone de quem está preenchendo o formulário. Isso é intencional e
suficiente para uso pessoal de uma única pessoa; não é uma solução geral
de multi-timezone.

## Segurança

- **Nenhum secret hardcoded.** `EVOLUTION_API_KEY`, `WHATSAPP_DESTINO`,
  credenciais do Postgres — tudo via `.env` (nunca commitado;
  `.env.example` tem placeholders `change-me-*`). O `docker-compose.yml`
  só referencia `${VAR}` / `env_file`, nunca um valor literal.
- **`.dockerignore` na raiz** (contexto de build é a raiz do monorepo,
  não cada app — ver nota abaixo) exclui `.env`, `node_modules`, `.git`.
- **Dockerfiles multi-stage, non-root.** `web` e `worker` rodam como
  usuário `app` (não root); o stage final não carrega toolchain de build,
  só os artefatos compilados + `node_modules` de produção.
- **Validação de env com Zod** (`packages/infrastructure/src/config/env.ts`)
  falha rápido e explicitamente se uma variável obrigatória faltar —
  nunca um `undefined` silencioso vazando pro runtime.
- **Anti-corruption layer isola a credencial da Evolution API**
  (`EvolutionApiNotificador`) — a `apikey` nunca aparece fora desse
  arquivo, nunca é logada.
- **Validação lazy (não no import do módulo).** `getEnv()` e `getDb()`
  só resolvem na primeira chamada real, não no carregamento do módulo —
  necessário porque o `next build` avalia o grafo de módulos das rotas em
  build-time, antes das env vars de runtime existirem; validar no import
  quebraria o build. Isso também evita que o worker ou o script de
  migration falhem por env vars que não usam.

### Nota sobre `.dockerignore` "por serviço"

O padrão Higher Mind pede um `.dockerignore` no root de cada serviço.
Num monorepo pnpm, porém, o build context de `web` e `worker` **precisa**
ser a raiz do repositório (para o Dockerfile enxergar
`pnpm-workspace.yaml`, o lockfile raiz e os `packages/*` dos quais
depende) — e o Docker só lê o `.dockerignore` que está na raiz do
contexto de build, nunca um `.dockerignore` dentro de um subdiretório.
Por isso há um único `.dockerignore` na raiz do monorepo, não um por
`apps/*`. É a exceção correta para essa restrição, documentada aqui para
não parecer um item esquecido.

## Como rodar

O ambiente é separado em **dois arquivos de env**, e a separação é
deliberada:

| Arquivo | Banco | Quem lê |
|---|---|---|
| `.env` | Postgres local (Docker) | `pnpm dev:web` (via `next.config.ts`) e `pnpm dev:worker` (via `dotenv`) |
| `.env.production` | Supabase (pooler, 6543) | ninguém em dev — é o artefato enviado ao VPS, onde vira `.env` |

Um arquivo só não serve. Apontar a `DATABASE_URL` do dev para produção
"só pra testar" transforma o worker local num **segundo scheduler** na
mesma tabela: os dois processam o mesmo lembrete vencido e o
destinatário recebe o WhatsApp duas vezes. O `docker-stack.yml` fixa o
worker em 1 réplica, mas isso só governa o que roda dentro do Swarm.
Por isso o worker também se recusa a iniciar contra um host remoto sem
`WORKER_PRIMARY=true`, flag que existe apenas em `.env.production`
(`apps/worker/src/index.ts`).

**Dev local** (infra em Docker, código rodando nativo para hot-reload):
```
cp .env.example .env   # edite EVOLUTION_API_KEY e WHATSAPP_DESTINO
./scripts/setup.sh
# Terminal 1:
pnpm dev:web
# Terminal 2:
pnpm dev:worker
```
Web sobe em `http://localhost:3000`.

Atenção: não existe sandbox da Evolution API — dev e produção falam com
a mesma instância. Um lembrete que vencer em dev manda WhatsApp de
verdade para `WHATSAPP_DESTINO`.

**Produção — VPS real (167.88.42.134), Docker Swarm + Traefik:**

Esse VPS ("Monadaserver") já roda vários outros projetos
(`vidanovaguarus`, `torredeoracao`, `evolution` — a própria Evolution
API — e outros) como serviços Swarm atrás de um Traefik que roteia por
domínio. Este projeto sobe do mesmo jeito, como stack `advice`, exposto
em `advice.autozapx.com`. Use `docker-stack.yml` (não
`docker-compose.yml` — Swarm não builda imagem nem entende `depends_on`
com `condition:`, nem `env_file:`; por isso os dois arquivos são
diferentes, as env vars usam `${VAR}` e o worker aplica as próprias
migrations no boot em vez de depender de um serviço `migrate` separado).

Rede e labels do Traefik em `docker-stack.yml` **não são placeholder** —
foram confirmados direto no VPS, inspecionando o `vidanovaguarus_web`
que já funciona: a rede compartilhada é `Monadanet` (não existe uma
rede chamada "traefik-public"), e os routers usam `tls: true` sem
`certresolver` explícito (o Traefik desse VPS não exige um nome de
resolver por router).

Da máquina de dev, envie o env de produção (ele aterrissa no VPS como
`.env`, porque `docker stack deploy` não tem `--env-file` e
`deploy-vps.sh` faz `source .env`):
```
./scripts/enviar-env-producao.sh root@167.88.42.134
```

Depois, no VPS:
```
cd /var/www/advice
./scripts/deploy-vps.sh                # builda, valida o .env e sobe a stack
docker service ls | grep advice_       # confirmar 1/1 em todos
```
`deploy-vps.sh` aborta antes de subir se a `DATABASE_URL` for local, se
não for o pooler do Supabase na 6543, ou se faltar `WORKER_PRIMARY`.

**Produção alternativa — Compose simples, sem Swarm (outro servidor):**
```
cp .env.production .env   # o Compose lê `.env` via env_file:
docker compose -f docker-compose.yml up -d --build
```
Aqui o `env_file:` repassa o arquivo inteiro, então `WORKER_PRIMARY`
chega ao worker sem precisar ser declarado serviço a serviço — ao
contrário do `docker-stack.yml`, onde cada variável é explícita.
Web fica exposto em `:3010` (ajuste a porta em `docker-compose.yml` se já
houver algo nela no host).

## Custo

- Worker e web rodam no VPS que já existe (mesmo host da Evolution
  API) — custo marginal de infraestrutura é zero.
- O banco é o Supabase (projeto `advice`, ca-central-1). No volume deste
  projeto — dezenas de linhas, ~1 query leve por minuto — o free tier
  cobre com folga, e ele traz backup diário e restauração gerenciada,
  que o container no VPS não tinha.
- Único custo de operação: 1 chamada HTTP à Evolution API por Lembrete
  enviado (mensagem de texto simples, sem custo de tokens de LLM
  envolvido). O scheduler faz 1 query leve ao Postgres por minuto
  (`SELECT ... WHERE status = 'PENDENTE' AND agendado_para <= now()`,
  índice natural pela baixa cardinalidade de linhas esperada).

## O que foi validado nesta máquina

- `pnpm install` — sem vulnerabilidades de build script não revisadas
  (`allowBuilds` explícito em `pnpm-workspace.yaml` para `esbuild` e
  `unrs-resolver`, os únicos dois pacotes com postinstall).
- `pnpm -r run build` — os 5 packages/apps compilam limpos, incluindo
  `next build` (standalone).
- `pnpm -r run typecheck` — zero erros de tipo em todo o monorepo.
- `pnpm test` — 9 testes de domínio (aggregate `Lembrete` e value object
  `AgendamentoInfo`) passando.
- `pnpm lint` — zero erros/warnings no monorepo inteiro (incluindo as
  regras React/Next escopadas a `apps/web`).
- `drizzle-kit generate` — migration inicial gerada e commitada em
  `packages/infrastructure/drizzle/`.

**Não validado aqui** (sandbox sem Docker): o `docker build` das duas
imagens, o boot dos containers contra um Postgres real, e o deploy Swarm
+ Traefik em si (não há como testar isso fora do VPS real). Antes do
primeiro deploy, rode o build local (`docker compose -f
docker-compose.yml up -d --build` é o jeito mais rápido de testar as
imagens antes de ir pro Swarm) e confira os logs de `worker` (deve
logar `[worker] migrações aplicadas` logo no boot) e `web` — se o path do
`.next/standalone` não bater exatamente (build monorepo do Next.js às
vezes exige um ajuste fino de `outputFileTracingRoot`), o log de build do
`web` vai apontar exatamente o quê.
