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
| **`jose` 6.2.11** + `scrypt` do `node:crypto` para autenticação | NextAuth/Auth.js, Lucia, Supabase Auth, `argon2`/`@node-rs/argon2` | O app tem **um** operador, sem cadastro, sem OAuth, sem recuperação de senha. NextAuth traz providers, adapters e tabelas para resolver problemas que não existem aqui, e Supabase Auth acrescentaria um serviço externo no caminho crítico de um login que é local por natureza. O que de fato é preciso: derivar uma chave de senha e assinar um token. Para a segunda parte, `jose` é a implementação JOSE de referência em JS — zero dependências, auditada, roda em qualquer runtime; escrever à mão a verificação de um token assinado seria a definição de escolher a opção arriscada. Para a primeira, `scrypt` do core do Node: Argon2id é marginalmente melhor no papel, mas toda implementação em Node é módulo nativo (node-gyp/napi) — mais supply chain e risco real de build quebrado no Alpine. scrypt é memory-hard, recomendado pela OWASP e custa zero dependência. |
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

Dentro de `domain` há dois bounded contexts independentes —
`lembrete/`+`envio/` (avisos por WhatsApp) e `operacao/` (compras,
custos e margem dos dois negócios do fundador — Fabio Junior Decor e
Venturax, separados pelo value object `Negocio`). Não compartilham
aggregate, tabela nem regra; ver [`docs/DOMAIN.md`](docs/DOMAIN.md).

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

## Dinheiro, e por que não existe um `float` neste repositório

Todo valor monetário do contexto de Operação é **centavo inteiro**, e
todo percentual é **ponto-base inteiro** (15% = `1500`), do formulário
ao banco:

| Camada | Como |
|---|---|
| Campo do formulário | Só dígitos, entrando pela direita (como maquininha de cartão). Não existe estado intermediário inválido nem vírgula ambígua. |
| Domínio | `Dinheiro` rejeita não-inteiro, negativo e acima do teto; `Percentual` rejeita fora de 0–100%. |
| Cálculo | `calcularResultado()` opera em inteiros; só as *margens* são frações, e nunca voltam a virar dinheiro. |
| Banco | `bigint` de centavos/pontos-base, com CHECK de não-negatividade. Nenhuma coluna `numeric` ou `double` de dinheiro. |

`0.1 + 0.2 !== 0.3` em ponto flutuante. Num sistema cuja única razão de
existir é dizer quanto sobra, um centavo errado se propaga para toda a
conta — e o erro aparece meses depois, num relatório, sem rastro.

### O cálculo de margem é isomórfico

`calcularResultado()` vive em `packages/domain` e é uma função pura sobre
números planos (sem classes, sem `Date`). Isso é deliberado: o **mesmo
código** roda no servidor (ao persistir e ao listar) e no browser (o
simulador ao vivo do formulário, via `useMemo`). O número que aparece
enquanto o fundador digita é literalmente o que vai para o banco — não
uma aproximação de UI que pode divergir.

É também por isso que a entrada e a saída são dados planos: um resultado
de classe não atravessa a fronteira Server Component → Client Component
do Next sem serialização manual. Os value objects (`Dinheiro`,
`Percentual`) continuam guardando a fronteira de *escrita* nos
aggregates.

### Integridade replicada no banco

Os CHECKs de `compras`, `servicos`, `custos_*` e `categorias_custo`
repetem invariantes que o domínio já garante. A redundância é
intencional: o domínio protege a aplicação, o banco protege o dado de
qualquer caminho que não passe por ela (psql, um script de importação,
uma migration futura). Dado financeiro não tem "depois eu conserto".

`categorias_custo` tem índice único sobre `lower(nome)` — "Frete" e
"frete" como duas categorias quebrariam todo relatório por tipo de
custo, que é a razão de a categoria ser entidade. E o FK das linhas de
custo é `ON DELETE RESTRICT`: categoria com histórico se arquiva, nunca
se apaga.

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

### Autenticação

O painel inteiro é privado. A credencial é **configuração, não dado de
aplicação**: um e-mail (`AUTH_EMAIL`) e um hash de senha
(`AUTH_PASSWORD_HASH`), ambos em env var. Não existe tabela de usuários,
nem cadastro, nem recuperação de senha — modelar um `Usuario` para uma
linha só custaria migration, CRUD e superfície de ataque sem responder a
nenhuma necessidade real. O dia em que houver um segundo operador, essa
decisão se revisita; até lá ela é a resposta certa.

- **Senha com `scrypt`** (`node:crypto`), parâmetros OWASP N=2^17, r=8,
  p=1, sal de 16 bytes por hash. O formato guardado é
  `scrypt$N$r$p$sal$chave`: os parâmetros viajam com o hash, então subir
  o custo no futuro não invalida a senha configurada. Comparação com
  `timingSafeEqual`. O e-mail é comparado em tempo constante e a senha é
  verificada **mesmo quando o e-mail está errado** — curto-circuitar ali
  faria o tempo de resposta revelar qual e-mail existe.
- **Sessão em JWT HS256** assinado com `AUTH_SESSION_SECRET` (32 bytes),
  em cookie `httpOnly` + `SameSite=Lax` + `Secure` em produção, 30 dias,
  renovado de forma deslizante quando faltam menos de 15. `jwtVerify`
  fixa `algorithms: ["HS256"]`, `issuer` e `audience` — é o que fecha a
  porta da confusão de algoritmo (`alg: none`, HMAC-vs-RSA). Não há
  revogação individual: trocar `AUTH_SESSION_SECRET` derruba todas as
  sessões de uma vez, que é a única granularidade que um operador único
  precisa.
- **Duas camadas de verificação, e a de dentro basta sozinha.** O
  `proxy.ts` (nome do antigo `middleware.ts` no Next 16) redireciona
  para `/login` antes de renderizar, renova o cookie e barra requisição
  mutante de origem estranha. Mas quem **autoriza** é `exigirSessao()` /
  `sessaoAtual()` dentro de cada página e de cada handler de API — as
  próprias docs do Next avisam que um matcher mal editado remove a
  cobertura do proxy em silêncio. Uma trava de arquitetura
  (`lib/auth/rotas-protegidas.test.ts`) varre o diretório de rotas e
  falha o `pnpm test` se qualquer rota ou página nova nascer sem guarda.
- **CSRF por verificação de `Origin`** em todo método mutante, no
  `proxy.ts`. O cookie `SameSite=Lax` já barra POST cross-site vindo de
  navegador, mas isso é uma propriedade do cliente; a checagem de origem
  é a que o servidor faz por conta própria. Vale inclusive para o login,
  senão um site terceiro poderia autenticar a vítima numa conta que ele
  controla.
- **Rate limit em duas faixas** (`lib/auth/limitador.ts`): 5 tentativas
  por IP e 30 no total, a cada 15 minutos. Não é sobre adivinhação de
  senha — é sobre CPU: cada tentativa custa ~300ms de scrypt, e sem teto
  um laço de requisições derruba o app antes de acertar qualquer coisa.
  Em memória, porque `web` roda com 1 réplica fixa; Redis só passa a
  fazer sentido quando houver uma segunda, e aí o limitador não será a
  única coisa a mudar.
- **A senha nunca passa por linha de comando.** `pnpm auth:senha`
  (`scripts/definir-senha.ts`) pergunta no terminal sem eco, deriva o
  hash e escreve `.env` e `.env.production` — com um
  `AUTH_SESSION_SECRET` **diferente em cada um**, para que o segredo do
  laptop não assine sessão válida em `advice.autozapx.com`. Senha em
  `argv` ficaria no histórico do shell e visível em `ps`.
- **O hash é gravado entre aspas simples.** Ele contém `$`, e o
  `scripts/deploy-vps.sh` faz `source .env`: sem aspas o bash expandiria
  `$1`/`$8` como parâmetros posicionais e o login morreria em produção
  sem nenhum erro visível. Os dois scripts de deploy recusam subir sem
  as aspas.
- **O `worker` não recebe nenhuma `AUTH_*`.** Ele não publica porta e
  não atende ninguém; dar-lhe o segredo de sessão só ampliaria o raio de
  um comprometimento.

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
pnpm auth:senha        # define e-mail e senha de acesso ao painel
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
