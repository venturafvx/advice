# CLAUDE.md — advice

Contexto específico deste projeto. Para como trabalhar em geral, ver o
CLAUDE.md global do usuário.

## O que é

Sistema pessoal de lembretes: agenda um aviso (título + dia + hora) numa
interface web e o envia via WhatsApp na hora certa, usando a Evolution
API (instância "advice", já self-hosted em `evolution.autozapx.com`,
autenticação via API key global).
Uso pessoal — um único destinatário fixo, sem multi-tenant.

Desde 2026-09-13 o app tem um **segundo contexto, Operação**
(`/operacao`): registrar compras de mercadoria com custos personalizáveis
(frete, etiquetagem, taxa Amazon, o que o fundador criar), quantidade e
preço de venda, e ver margem bruta, líquida, retorno sobre o custo e
ponto de equilíbrio. Também registra serviços (valor recebido e custos).
Nada a ver com Lembretes além de dividir o mesmo app.

Desde 2026-09-17 a Operação atende **dois negócios**, com painel
próprio cada um:

- **Fabio Junior Decor** (`/operacao/fabiojuniordecor`) — papel de
  parede: compra e venda do material, e o serviço de aplicação.
- **Venturax** (`/operacao/venturax`) — compra e revenda de produtos em
  marketplace.

`/operacao` é a visão geral: os dois lado a lado, **sem linha de
total**.

Desde 2026-09-17 há um **terceiro contexto, Hábitos** (`/habitos`):
definir um hábito e a frequência, ticar o dia quando cumpre, e — quando
quebra — registrar o que aconteceu e o que passou pela cabeça na hora.
A tela mostra a semana, a sequência, a aderência e um diário das
quebras. Não tem relação com Lembretes nem com Operação além de dividir
o mesmo app.

Modelagem de domínio completa em [`docs/DOMAIN.md`](docs/DOMAIN.md).
Decisões de stack/infra/segurança em [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Glossário do domínio (ver docs/DOMAIN.md para o modelo completo)

- **Lembrete**: a intenção de ser avisado de algo numa data/hora. Aggregate root.
- **Envio**: uma tentativa de entrega via WhatsApp (sucesso ou falha). Aggregate próprio.
- **Notificador**: porta de saída para "enviar WhatsApp" — nunca conhece Evolution API diretamente.
- Status do Lembrete: `PENDENTE` (único não-terminal) → `ENVIADO` | `FALHOU` | `CANCELADO`.
- **Recorrência**: a regra de repetição de um Lembrete (frequência + hora). Value object.
- **Ocorrência**: um Lembrete concreto de uma série recorrente — id, envios e status próprios.
- **Série** (`serieId`): a identidade da repetição atravessando todas as suas ocorrências.

Contexto de Operação (ver `docs/DOMAIN.md` para o modelo completo):

- **Negócio**: a qual das duas operações um lançamento pertence —
  `FABIOJUNIORDECOR` | `VENTURAX`. Value object.
- **Compra**: um lote de mercadoria comprado para revenda. Aggregate root.
- **Serviço**: um trabalho prestado e recebido (papel de parede). Aggregate root.
- **CustoOperacional**: linha de custo dentro de uma Compra/Serviço. Value object.
- **CategoriaDeCusto**: tipo de custo reutilizável e criável pelo fundador. Aggregate root.
- **Modo de incidência**: `VALOR_FIXO` | `POR_UNIDADE` | `PERCENTUAL_DA_VENDA`.

Contexto de Hábitos (ver `docs/DOMAIN.md` para o modelo completo):

- **Hábito**: a intenção que se repete. Aggregate root.
- **Registro**: o que foi declarado sobre um hábito num dia. Aggregate próprio.
- **Cadência**: a regra de repetição — `DIARIA` | `DIAS_DA_SEMANA` | `VEZES_POR_SEMANA`. Value object.
- **DiaCivil**: um dia do calendário (`2026-09-17`), sem hora e sem fuso. Value object.
- Situação do dia: `FEITO` | `QUEBRADO`. Não existe "pulado".
- **Sequência**: dias (ou semanas) seguidos cumpridos *e declarados*.
- **Aderência**: cumpridos ÷ cobrados numa janela.

## Decisões cravadas (não revisitar sem motivo novo)

- **Destinatário fixo** via env var `WHATSAPP_DESTINO` — não é uma entidade. Confirmado com o fundador.
- **Recorrência é série de ocorrências, não linha que reabre** — um
  Lembrete recorrente guarda a regra (`Recorrencia`: diária, semanal com
  dias escolhidos, ou mensal com dia do mês) e, ao chegar a um estado
  terminal *do sistema* (ENVIADO ou FALHOU), materializa a próxima
  ocorrência: outro Lembrete, outro id, mesma `serieId`. Status terminal
  continua definitivo — a invariante que impede reenvio por engano não
  foi afrouxada para caber repetição. Consequências que não se
  revisitam: existe no máximo **uma** ocorrência PENDENTE por série;
  **cancelar é como se encerra a repetição** (sem pendente, ninguém gera
  a próxima); uma falha definitiva **continua** a série (a Evolution API
  cair numa manhã não pode matar o lembrete diário).
- **A regra de recorrência é relógio de parede, não intervalo** — "todo
  dia às 07:00" é 07:00 no timezone, e a próxima ocorrência sai sempre
  de "agora", nunca de "anterior + 24h". É o que mantém o horário certo
  na virada de horário de verão e o que faz o worker ficar três dias
  fora do ar sem disparar três avisos atrasados de uma vez. A conta vive
  em `packages/domain/src/lembrete/tempo.ts` (só `Intl`, sem
  dependência) e roda nos dois lados: a prévia "primeiro envio…" no
  formulário é o mesmo código do servidor, como `calcularResultado()`.
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
- **Deploy é automático no push da `main`, via webhook no VPS**
  (`infra/webhook/`, porta 9001, systemd `webhook-advice.service`) — o
  mesmo padrão do `torredeoracao`, que já roda na 9000 nesse host. O
  GitHub assina o POST (HMAC-SHA256, segredo em
  `/etc/default/webhook-advice`), o webhook valida assinatura/evento/
  branch/SHA e chama `scripts/deploy-remoto.sh <sha>` → `deploy-vps.sh`,
  que builda no VPS, tagueia a imagem com o SHA curto, sobe a stack,
  espera convergir e faz `docker service rollback` se não convergir.
  Rollback manual é `ADVICE_TAG=<sha-curto> ./scripts/deploy-vps.sh` —
  as 6 últimas imagens ficam no disco. Passo a passo em
  [`docs/DEPLOY.md`](docs/DEPLOY.md). Descartado: GitHub Actions + GHCR +
  SSH — mais peças e um segundo jeito de deployar no mesmo servidor.
  O `.github/workflows/ci.yml` roda só o baseline, não deploya; o portão
  real do deploy é o `docker build` falhar.
  O `.env` de produção continua fora disso, indo direto de dev pro VPS.
- **Editar só existe para PENDENTE; terminal é história, não rascunho**
  — `Lembrete.editar()` troca título e agendamento (e, num recorrente,
  a própria regra) enquanto o lembrete ainda vai acontecer. Depois de
  ENVIADO/FALHOU/CANCELADO, reescrever seria maquiar o que de fato
  aconteceu. Como existe no máximo uma ocorrência PENDENTE por série,
  editar essa ocorrência é editar a repetição daqui para a frente; as
  que já dispararam ficam no histórico como foram. A edição é também o
  único caminho pelo qual um avulso vira série (inaugurando a própria,
  `serieId = id`) e uma série vira avulso.
- **Cancelar e apagar são dois verbos, não um com bandeira** —
  `POST /api/lembretes/:id/cancelar` preserva o registro (vira
  CANCELADO e desce para o histórico); `DELETE /api/lembretes/:id`
  apaga de verdade, o lembrete e os Envios dele, na mesma transação.
  `DELETE /api/lembretes/historico` varre todo o estado terminal e
  nunca toca em PENDENTE. Apagar é irreversível de propósito — um
  "apagar" que só esconde deixaria o banco crescendo com lixo invisível
  — e por isso a tela confirma na própria linha, sem `window.confirm`.
- **`salvar` (upsert) e `atualizar` (UPDATE puro) são coisas
  diferentes** — o upsert existe para a materialização idempotente da
  próxima ocorrência (id determinístico). Toda escrita sobre um
  lembrete que já existe passa por `atualizar`, que devolve `false` se
  a linha sumiu: sem isso, apagar um lembrete no segundo em que o
  worker o envia o traria de volta do nada, marcado como ENVIADO.
- **Busca é no servidor, com curinga escapado** — `ILIKE` sobre o
  título, `%` e `_` do termo escapados (senão procurar "100%" devolve a
  tabela inteira). Filtrar em memória só alcançaria o que já estava na
  tela, e o histórico na tela é uma janela dos mais recentes (40, ou
  200 com busca ativa), não a tabela. Varredura sequencial é escolha
  consciente nesta ordem de grandeza; passando de ~100k ocorrências, a
  resposta é um índice GIN com `pg_trgm`, não trocar a consulta.
- **`getEnv()` / `getDb()` são lazy** (`packages/infrastructure/src/config/env.ts`, `.../db/client.ts`) — nunca voltar a validar env ou abrir conexão no import do módulo; isso quebra o `next build` (que avalia o grafo de módulos das rotas em build-time, sem as env vars de runtime disponíveis).

### Operação

- **Negócio é uma coluna, não um segundo sistema** — `negocio` NOT NULL
  em `compras` e `servicos`, com CHECK no banco e revalidação no
  aggregate. Duas tabelas de compras seriam duas cópias de toda
  invariante de dinheiro e dois caminhos para a margem divergir. As
  regras, o `calcularResultado()` e as categorias de custo são
  compartilhados; o que muda é o recorte. Consequências que não se
  revisitam: **a visão geral nunca soma os dois** (cartão por negócio,
  sem total — receita projetada de marketplace com recebido de
  aplicação não é caixa nem projeção de ninguém); o negócio é
  **editável** no formulário (lançar no lugar errado é o engano mais
  fácil, e sem o campo a correção seria apagar e redigitar); e o painel
  de um negócio 404 numa compra do outro, senão trocar o slug na URL
  abriria o lançamento alheio numa tela que diz ser deste.
- **Que a Venturax não tenha serviço é fato de negócio, não invariante**
  — vive em `PERFIS` (`apps/web/src/lib/negocios.ts`), apresentação, não
  domínio. A seção some do painel só se de fato não houver serviço
  registrado: esconder a seção esconderia dinheiro que existe.
- **Dinheiro é centavo inteiro (`bigint`), percentual é ponto-base
  inteiro** — do campo do formulário ao banco. Nenhum `float`, nenhuma
  coluna `numeric` de dinheiro, em lugar nenhum. Ver ARCHITECTURE.md.
- **`calcularResultado()` é a única fonte da margem** e roda nos dois
  lados (servidor e browser). Nunca reimplementar a conta em SQL, na UI
  ou num relatório — o número tem de ser sempre o mesmo.
- **Modo de incidência do custo não é enfeite**: frete é fixo,
  etiquetagem é por unidade, taxa da Amazon é percentual da venda.
  Colapsar os três em "um valor" dá margem errada.
- **Mercadoria é receita projetada, serviço é receita realizada.** O
  resumo separa os dois e a UI diz isso em voz alta. Não somar em
  silêncio.
- **CategoriaDeCusto nunca é excluída, só arquivada** (FK `ON DELETE
  RESTRICT`) — histórico financeiro não pode perder o rótulo do gasto.
- **Custo `POR_UNIDADE` não existe em Serviço** — invariante do
  aggregate e CHECK no banco.
- **Apagar e editar são visíveis na lista** — cada linha do painel tem
  "Editar" e uma lixeira, e a exclusão confirma na própria linha, sem
  `window.confirm` (mesma regra dos lembretes). Antes as duas ações
  existiam na API e só se chegava nelas descobrindo que a linha inteira
  era clicável — afordância invisível não é afordância.
- **Toda rota e toda página novas exigem sessão explicitamente**
  (`sessaoAtual()` / `exigirSessao()`). O `proxy.ts` é a segunda camada,
  não a autorização. `rotas-protegidas.test.ts` quebra se esquecer.

### Hábitos

- **O dia é `date`, não `timestamptz`** — "fiz hoje" é uma afirmação
  sobre o calendário. Guardar instante faria o mesmo registro mudar de
  dia conforme o fuso de quem lê (às 21h de São Paulo já é o dia
  seguinte em UTC) e destruiria a invariante central: **um registro por
  hábito por dia**. O fuso aparece uma vez só, em `DiaCivil.hoje()`, no
  servidor — a tela recebe o `hoje` pronto e nunca calcula o seu.
- **Ausência de registro não é quebra** — quebrar é um ato declarado, e
  não existe estado `PULADO` (ele obrigaria a distinguir "pulei de
  propósito" de "não abri o app"). A consequência aceita: um dia cobrado
  sem registro interrompe a sequência. Silêncio não é acerto.
- **`observacao` e `pensamento` são dois campos** — o que aconteceu e o
  que passou pela cabeça são leituras diferentes; colapsar os dois
  perderia exatamente a parte que serve para reconhecer o padrão na
  próxima vez. Nenhum dos dois é exclusivo da quebra.
- **Meta flexível cobra a semana, não o dia** — `Cadencia.exigeDia()`
  devolve `false` em `VEZES_POR_SEMANA` de propósito: dizer `true`
  viraria sete cobranças e quatro faltas falsas. Daí a sequência dela
  contar semanas e a aderência olhar só semanas fechadas. `7×` é
  normalizado para `DIARIA` na criação.
- **`calcularDesempenho()` é a única fonte da sequência e da aderência**
  e roda nos dois lados, como `calcularResultado()`. Nunca reimplementar
  em SQL ou na UI. Dois detalhes que só aparecem sob teste: hoje só
  conta contra depois de declarado, e `desde` (a criação) limita a
  **aderência**, não a sequência — dias preenchidos retroativamente
  contam como qualquer outro.
- **Arquivar e apagar são dois verbos** — arquivar preserva os registros
  e libera o nome; apagar leva tudo junto e é para o hábito criado por
  engano. Mesma regra dos lembretes.
- **CHECK com resultado NULL é aceito pelo Postgres** — por isso o
  CHECK de cadência tem `is not null` explícito e usa `cardinality()`,
  não `array_length(_, 1)` (que devolve NULL para `ARRAY[]::int[]`, não
  0). Sem isso entrava "DIAS_DA_SEMANA sem dia nenhum". O CHECK
  `lembretes_recorrencia_coerente` ainda tem esse buraco — confirmado
  em dev, ainda não corrigido.

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
