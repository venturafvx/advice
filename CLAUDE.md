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

- Migrations e boot completo dos containers Docker não foram validados
  numa máquina real com Docker (sandbox de desenvolvimento não tinha
  Docker disponível) — validar no primeiro deploy no VPS.
- Sem testes de integração para os repositórios Drizzle nem para o
  `EvolutionApiNotificador` (só testes unitários do domínio puro). Vale
  adicionar quando houver um Postgres de teste disponível em CI.
- `docker-stack.yml` tem 3 valores placeholder que dependem da config do
  Traefik desse VPS específico (nome da rede externa, entrypoint HTTPS,
  certresolver) — confirmar contra `docker network ls` / o
  `docker-compose.yml` de `vidanovaguarus` ou `torredeoracao` antes do
  primeiro deploy.
