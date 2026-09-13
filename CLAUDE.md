# CLAUDE.md — advice

Contexto específico deste projeto. Para como trabalhar em geral, ver o
CLAUDE.md global do usuário.

## O que é

Sistema pessoal de lembretes: agenda um aviso (título + dia + hora) numa
interface web e o envia via WhatsApp na hora certa, usando a Evolution
API (instância "advice", já self-hosted em `evolution.autozapx.com`,
autenticação via API key global).
Uso pessoal — um único destinatário fixo, sem multi-tenant.

Modelagem de domínio completa em [`docs/DOMAIN.md`](docs/DOMAIN.md).
Decisões de stack/infra/segurança em [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Glossário do domínio (ver docs/DOMAIN.md para o modelo completo)

- **Lembrete**: a intenção de ser avisado de algo numa data/hora. Aggregate root.
- **Envio**: uma tentativa de entrega via WhatsApp (sucesso ou falha). Aggregate próprio.
- **Notificador**: porta de saída para "enviar WhatsApp" — nunca conhece Evolution API diretamente.
- Status do Lembrete: `PENDENTE` (único não-terminal) → `ENVIADO` | `FALHOU` | `CANCELADO`.

## Decisões cravadas (não revisitar sem motivo novo)

- **Destinatário fixo** via env var `WHATSAPP_DESTINO` — não é uma entidade. Confirmado com o fundador.
- **Sem recorrência na v1** — cada Lembrete tem uma única data/hora.
- **Banco de produção é Supabase** (projeto `advice`, ref
  `vekbsbodosnxewatycrr`, Postgres 17, ca-central-1) — não há mais
  serviço `postgres` no `docker-stack.yml`. Continua sendo Drizzle +
  driver `postgres` falando SQL direto: **não** usar `supabase-js`, que
  só faria sentido se o browser acessasse o banco. Dev local segue no
  Postgres do Docker (`docker compose up -d postgres`) — dev nunca
  escreve no banco de produção.
- **Conectar sempre pelo pooler** (`...pooler.supabase.com`), nunca por
  `db.<ref>.supabase.co`: a conexão direta só resolve em IPv6 e o VPS
  não tem IPv6. Na porta 6543 (transaction mode) o `client.ts` desliga
  prepared statements sozinho lendo a porta da URL.
- **RLS ligada sem policy nenhuma** nas duas tabelas
  (`drizzle/0001_rls_deny_postgrest.sql`). O schema `public` do Supabase
  é exposto via PostgREST pela chave `anon`, que é pública; RLS sem
  policy nega tudo por ali e não afeta a aplicação, que conecta como
  owner das tabelas. Nunca criar policy "permissiva pra facilitar".
- **Timezone fixo** `America/Sao_Paulo`, via `TZ` dos containers Docker. Não modelar timezone por usuário.
- **CommonJS** nos packages de backend (`domain`, `application`, `infrastructure`, `worker`) — não migrar para ESM/NodeNext sem motivo concreto (ver ARCHITECTURE.md).
- **ESLint pinado em 9.x** — ESLint 10 quebra `eslint-plugin-react` (usado por `eslint-config-next`). Reavaliar quando o plugin atualizar; não fazer bump "porque é a versão mais nova" sem testar `pnpm lint` de verdade primeiro.
- **TypeScript pinado em 5.9.x** — TS 7 (novo compilador nativo) ainda não é suportado por `typescript-eslint` (peer `<6.1.0`). Reavaliar quando o ecossistema alcançar.
- **Deploy real é Docker Swarm + Traefik** no VPS `167.88.42.134` (mesmo
  onde a Evolution API roda), domínio `advice.autozapx.com` — ver
  `docker-stack.yml` e `VPS_SUBIR_PASSO_A_PASSO 1 1.md`. `docker-compose.yml`
  é só para dev local / um Compose simples alternativo; Swarm não builda
  imagem nem suporta `depends_on: condition:`, por isso os arquivos são
  diferentes e as migrations rodam no boot do `worker`, não num serviço
  `migrate` separado.
- **`getEnv()` / `getDb()` são lazy** (`packages/infrastructure/src/config/env.ts`, `.../db/client.ts`) — nunca voltar a validar env ou abrir conexão no import do módulo; isso quebra o `next build` (que avalia o grafo de módulos das rotas em build-time, sem as env vars de runtime disponíveis).

## Baseline obrigatório antes de qualquer commit

```
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Todos os quatro passam limpos no commit inicial deste projeto — qualquer
PR que quebrar um deles não está pronto.

## Estrutura

Ver "Estrutura do monorepo" em `ARCHITECTURE.md`. Resumo: `domain` não
importa nada de fora; `application` só conhece `ports` (interfaces);
`infrastructure` é o único lugar que sabe o que é Postgres ou Evolution
API; `apps/web` e `apps/worker` só fazem composition root + entrega.

## Pendências conhecidas (não são bugs, são escopo futuro)

- Sem testes de integração para os repositórios Drizzle nem para o
  `EvolutionApiNotificador` (só testes unitários do domínio puro). Vale
  adicionar quando houver um Postgres de teste disponível em CI.
- Os dados de teste do Postgres local **foram** migrados para o Supabase
  (9 lembretes, 19 envios), a pedido — produção não nasceu limpa. Todos
  em status terminal (FALHOU/ENVIADO/CANCELADO), nenhum `PENDENTE`, então
  não há nada agendado para o worker disparar. O original continua no
  volume Docker `advice_postgres_data`, que desde então divergiu do
  Supabase: o dev local tem registros que produção não tem.
- Numeração de `tentativa` em `Envio` não é atômica (`contarTentativas` +
  `salvar` em dois passos) — sob dois processos do worker rodando ao
  mesmo tempo, gera `tentativa` duplicada/pulada. Mitigado em produção
  pela regra de 1 réplica do worker, mas é uma fragilidade real. Ver
  `MEMORY.md`.

## Já validado de verdade (não é suposição)

- Local: `pnpm typecheck/lint/test/build` limpos; app rodando de ponta a
  ponta (Postgres em Docker + web/worker nativos) com **envio real de
  WhatsApp confirmado** via instância "advice" + API key global.
- VPS de produção (Monadaserver, 167.88.42.134): rede Traefik real é
  `Monadanet` (não existe "traefik-public"), routers usam `tls: true`
  sem `certresolver` explícito — confirmado inspecionando
  `vidanovaguarus_web`, que já roda assim. `docker-stack.yml` reflete
  isso, não é mais placeholder. `docker stack deploy` **não suporta**
  `env_file:` (só `docker compose up` suporta) — por isso usa `${VAR}`.
