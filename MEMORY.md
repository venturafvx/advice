# MEMORY.md

Resumo vivo do estado do projeto. Detalhe maior vai em `docs/topics/`
(ainda não existe nenhum tópico — criar quando este arquivo passar de
~200 linhas).

## Operação Venturax — feature nova (2026-09-13)

Segundo bounded context do app, em `/operacao`. Registra compras de
mercadoria (quantidade, custo unitário, preço de venda) com custos
personalizáveis, e os serviços de papel de parede (valor recebido +
custos). Calcula margem bruta, margem líquida, lucro por unidade,
retorno sobre o custo, preço mínimo de equilíbrio e quantas unidades
cobrem os custos fixos.

- **O que foi validado**: `pnpm typecheck`, `pnpm lint`, `pnpm test`
  (94 testes, 26 novos no domínio de Operação) e `pnpm build` — todos
  limpos.
- **Migrations já rodaram para valer** (2026-09-13, depois da nota
  abaixo): aplicadas no Postgres local e no Supabase de produção. As 7
  tabelas existem nos dois, com RLS ligada e **zero policy** em todas —
  conferido por `pg_policy` no Supabase, não presumido. As 7 categorias
  do seed entraram. `lembretes` e `envios` ficaram intocadas.
- **O que CONTINUA sem validação de verdade**: nenhuma compra foi
  cadastrada de ponta a ponta ainda. O round-trip de `bigint` pelo
  Drizzle (`bigint({mode:"number"})` → `Number(value)` sobre o `int8`
  que o postgres-js devolve como string) foi conferido lendo o
  código-fonte do pacote, não exercitado. **Próximo passo real:
  cadastrar uma compra com os três modos de incidência e conferir que a
  margem persistida bate com a do simulador.**
- **Migrations novas**: `0002_operacao_venturax.sql` (5 tabelas + índices
  + CHECKs) e `0003_operacao_rls_e_categorias_padrao.sql` (RLS sem policy
  nas 5 tabelas, no mesmo regime da `0001`, + seed idempotente de 7
  categorias: Frete, Etiquetagem, Taxa Amazon 15%, Embalagem, Imposto,
  Material, Deslocamento). Rodam no boot do worker, como as outras.
- **Decisão de modelagem que sustenta tudo**: cada custo tem um *modo de
  incidência* (`VALOR_FIXO` / `POR_UNIDADE` / `PERCENTUAL_DA_VENDA`).
  É o que faz a margem sair certa e o que torna o ponto de equilíbrio
  calculável em forma fechada.
- **`calcularResultado()` roda no servidor e no browser** (função pura,
  dados planos). O simulador ao vivo do formulário e o valor persistido
  são o mesmo código — não há como divergirem.
- **Mercadoria = receita projetada; serviço = receita realizada.** O
  resumo separa e a UI avisa. Não somar em silêncio.
- Dinheiro é centavo inteiro, percentual é ponto-base inteiro, do campo
  ao `bigint` do banco. Nenhum float no caminho.
- **Mudança fora do escopo da feature**: o `BotaoSair` saiu do cabeçalho
  de `/` e foi para a barra de navegação global (`NavPrincipal`), que
  aparece em toda tela autenticada — senão `/operacao` ficaria sem saída
  e haveria dois "Sair" na tela de Lembretes.

## Deploy automático no ar — e a lição das portas (2026-09-13)

`advice.autozapx.com` roda o commit `52794e7`, com login, Operação
Venturax e Lembretes. Imagens tagueadas por SHA (`advice-web:52794e7b5de2`),
banco no Supabase, webhook de deploy instalado e testado ponta a ponta:
POST assinado → `202` → build → `docker stack deploy` → convergência
verificada → `OK em 172s`.

**O webhook do advice escuta na 9003, não na 9001.** O `docs/DEPLOY.md`
nasceu com a premissa de que "a 9000 é do torredeoracao, logo a 9001
está livre". Não estava: `webhook-vidanovaguarus.service` ocupa a 9001
desde julho/2026, e a 9002 também tem dono. O mapa real de portas em
escuta neste VPS é `22 80 443 2022 2377 7946 8000 8005 8006 9000 9001
9002 9010 9011 27017 43365`.

O erro custou quatro instalações fracassadas porque **três defeitos o
esconderam**, todos corrigidos em `52794e7`:

1. O health check do instalador era `curl -fsS /health` — aceitava
   qualquer `200`, e quem respondia era o webhook vizinho na mesma
   porta, com um `Webhook server OK` em texto puro. Agora exige
   `systemctl is-active` **e** que a resposta seja o JSON do advice.
2. Não havia checagem de porta. Agora o instalador recusa instalar
   sobre porta ocupada e diz quem a ocupa.
3. `/etc/default/webhook-advice` só era escrito na criação ou com
   `--rotar-segredo`. Trocar a porta no instalador não mudava nada — o
   serviço seguia lendo o `DEPLOY_PORT` velho. Agora o segredo é
   preservado e todo o resto é reescrito.

**A lição que vale além deste bug**: porta livre se confere com
`ss -ltnp`, não se deduz do vizinho que você conhece. E health check
que aceita qualquer `200` não é health check — tem que provar que quem
respondeu é o seu processo.

Bug irmão, mesmo commit anterior (`219918e`): `yes | ufw delete "$n"`
sob `set -o pipefail` derrubava o instalador na **segunda** execução em
diante (SIGPIPE = 141 no `yes`), depois de já ter rotacionado o segredo
e antes de imprimi-lo. Script idempotente precisa ser testado rodando
duas vezes, não uma.

### Pendências operacionais (não são bugs)

- **`advice_postgres` continua no Swarm**, órfão do tempo pré-Supabase;
  `deploy-vps.sh` roda sem `--prune`, então ele sobrevive aos deploys.
  `docker service rm advice_postgres` tira o serviço sem tocar no
  volume `advice_postgres_data`.
- **Regras de ufw órfãs na 9001**: o instalador chegou a liberar as 6
  faixas do GitHub naquela porta, que é do vidanovaguarus. Só o GitHub
  alcança e aquilo também é webhook do GitHub, mas foi mudança na
  exposição de um app que não é nosso.

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
- **EM PRODUÇÃO desde 2026-09-13**, em `https://advice.autozapx.com`
  (HTTPS com certificado Let's Encrypt válido, Docker Swarm + Traefik no
  VPS Monadaserver). Os três serviços (`advice_postgres`, `advice_web`,
  `advice_worker`) rodando 1/1. Lembrete criado em produção chegou no
  WhatsApp — fluxo completo validado no ambiente real, não só local.
- Deploy dali em diante: `cd /var/www/advice && git pull &&
  ./scripts/deploy-vps.sh`.

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

## Armadilha importante: colisão de nome de serviço na Monadanet

O `web` precisa estar na rede `Monadanet` (pro Traefik alcançar), e
nessa rede JÁ EXISTE um serviço com alias `postgres` (o
`postgres_postgres` compartilhado do VPS, Postgres 14 de outro
projeto). Usar `@postgres:5432` no `DATABASE_URL` fez o `web` conectar
no banco do outro projeto e falhar com `password authentication failed`
— enquanto o `worker` (que está só na `advice_internal`) conectava
certo. **No Swarm, sempre o nome qualificado: `advice_postgres`.**
`scripts/deploy-vps.sh` tem um guard que aborta o deploy se o `.env`
estiver com o host errado.

Detalhe que dá calafrio: se aquele Postgres compartilhado tivesse um
usuário `advice` com a mesma senha, a app teria escrito dados no banco
de outro projeto silenciosamente, sem erro nenhum.

## Traefik desse VPS — como certificado funciona

- Certresolver chamado **`letsencryptresolver`** (HTTP challenge via
  entrypoint `web`), storage em `/etc/traefik/letsencrypt/acme.json`
  (volume `volume_swarm_certificates`).
- **Não existe certresolver padrão na entrypoint** — cada router tem que
  declarar `tls.certresolver=letsencryptresolver` no label, senão o
  Traefik serve o self-signed dele. O `vidanovaguarus_web` não tem esse
  label e mesmo assim funciona porque o cert dele já está emitido e
  salvo no acme.json (vai quebrar quando expirar, se ninguém mexer).
- A entrypoint `web` (:80) já tem redirect global pra `websecure`.

## Próximo passo natural

Está no ar e funcionando. O que vale considerar a seguir, em ordem:

1. **`/hm-security` L1** — o app está publicamente acessível em
   `advice.autozapx.com` **sem nenhuma autenticação**: qualquer um que
   descobrir o domínio pode criar/cancelar lembretes que vão pro
   WhatsApp do dono. Foi construído assumindo uso pessoal, mas agora que
   está exposto na internet isso vira uma decisão consciente a tomar
   (basic auth no Traefik resolveria em minutos, se for o caso).
2. Backup do volume `advice_postgres_data` (dados sagrados — hoje não
   tem backup nenhum configurado).
3. Dívida técnica conhecida: atomicidade da numeração de `tentativa` em
   `Envio` (ver acima).

Não há acesso SSH ao VPS a partir da máquina de dev — deploys são
guiados comando a comando, ou rodando `./scripts/deploy-vps.sh` no VPS.
