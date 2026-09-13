#!/usr/bin/env bash
# Builda e sobe a stack no VPS (Docker Swarm + Traefik). Rodar de dentro
# de /var/www/advice, com o commit desejado já em checkout.
#
#   ./scripts/deploy-vps.sh                 # builda o HEAD atual e sobe
#   ADVICE_TAG=a1b2c3d ./scripts/deploy-vps.sh   # rollback: sobe imagem que já existe
#
# No fluxo normal ninguém chama isto na mão: o push na main dispara o
# webhook (infra/webhook/), que chama scripts/deploy-remoto.sh, que faz
# o checkout e chama este script. Ver docs/DEPLOY.md.
#
# Cada build é tagueado com o SHA curto do commit, além de :latest. É o
# que torna rollback barato: a imagem anterior continua no disco, então
# voltar é `ADVICE_TAG=<sha-anterior>` — sem rebuild, em segundos.
#
# O que este script garante, em ordem:
#   1. o .env do VPS é mesmo o de produção (cada check abaixo já custou
#      um incidente ou quase)
#   2. a imagem nova existe ANTES de o Swarm ser tocado — build quebrado
#      não derruba o que está no ar
#   3. a stack sobe com as env vars exportadas (stack deploy não lê .env
#      sozinho para os ${VAR})
#   4. os serviços convergem de verdade — e, se não convergirem, volta
#      sozinho para a versão anterior e sai com código de erro
set -euo pipefail

cd "$(dirname "$0")/.."

PRAZO_CONVERGENCIA=180
IMAGENS_GUARDADAS=6

# ---------------------------------------------------------------- modo
if [ -n "${ADVICE_TAG:-}" ]; then
  MODO=reusar
else
  MODO=build
  ADVICE_TAG="$(git rev-parse --short=12 HEAD)"
fi
export ADVICE_TAG

echo "==> advice :$ADVICE_TAG ($MODO)"

# ------------------------------------------------------- sanidade do env
if [ ! -f .env ]; then
  echo "ERRO: .env não existe. Use ./scripts/enviar-env-producao.sh na máquina de dev." >&2
  exit 1
fi

# O banco de produção é o Supabase, não um Postgres na stack.
if grep -qE '@(postgres|advice_postgres|localhost|127\.0\.0\.1):5432' .env; then
  echo "ERRO: DATABASE_URL aponta para um Postgres local/da stack." >&2
  echo "      Produção é o Supabase — isto é um .env de dev." >&2
  exit 1
fi
if ! grep -qE '^DATABASE_URL=.*pooler\.supabase\.com:6543/' .env; then
  echo "ERRO: DATABASE_URL não é o pooler do Supabase na 6543." >&2
  echo "      db.<ref>.supabase.co só resolve em IPv6 e este VPS não tem." >&2
  echo "      A 6543 também é o sinal que desliga prepared statements." >&2
  exit 1
fi
if ! grep -qE '^WORKER_PRIMARY=true$' .env; then
  echo "ERRO: falta WORKER_PRIMARY=true — o worker vai recusar iniciar." >&2
  exit 1
fi

# --------------------------------------------------------------- imagens
if [ "$MODO" = build ]; then
  echo "==> Buildando imagens..."
  # Sem `|| fallback` de dependência: se o pnpm-lock.yaml estiver fora de
  # sync, o build TEM que falhar aqui, com produção intacta.
  docker build -f apps/web/Dockerfile    -t "advice-web:$ADVICE_TAG"    -t advice-web:latest    .
  docker build -f apps/worker/Dockerfile -t "advice-worker:$ADVICE_TAG" -t advice-worker:latest .
else
  for imagem in "advice-web:$ADVICE_TAG" "advice-worker:$ADVICE_TAG"; do
    docker image inspect "$imagem" >/dev/null 2>&1 || {
      echo "ERRO: imagem $imagem não existe neste VPS." >&2
      echo "      Tags disponíveis:" >&2
      docker image ls advice-web --format '        {{.Tag}}' >&2
      exit 1
    }
  done
fi

# ----------------------------------------------------------------- stack
echo "==> Aplicando a stack..."
set -a
# shellcheck disable=SC1091
source .env
set +a
export ADVICE_TAG
# As imagens só existem neste host: sem --resolve-image never o Swarm
# tentaria resolver a tag num registry.
docker stack deploy -c docker-stack.yml --resolve-image never advice

# ----------------------------------------------------------- convergência
# "Subiu" é o serviço estar Running e CONTINUAR Running — um crash loop
# (env faltando, migration quebrada) passa por Running alguns segundos
# antes de morrer.
aguardar() {
  local servico="$1"
  local limite=$((SECONDS + PRAZO_CONVERGENCIA))
  local estaveis=0 estado

  while (( SECONDS < limite )); do
    estado="$(docker service ps "$servico" --filter desired-state=running \
      --format '{{.CurrentState}}' 2>/dev/null | head -1)"
    case "$estado" in
      Running*)  estaveis=$((estaveis + 1)) ;;
      Failed*|Rejected*)
        echo "ERRO: $servico falhou ($estado)" >&2
        return 1 ;;
      *) estaveis=0 ;;
    esac
    (( estaveis >= 3 )) && { echo "OK: $servico — $estado"; return 0; }
    sleep 5
  done

  echo "ERRO: $servico não convergiu em ${PRAZO_CONVERGENCIA}s (último estado: ${estado:-desconhecido})" >&2
  return 1
}

falhou=0
for servico in advice_worker advice_web; do
  if ! aguardar "$servico"; then
    falhou=1
    echo "--- docker service ps $servico ---" >&2
    docker service ps "$servico" --no-trunc | head -5 >&2
    echo "--- docker service logs $servico ---" >&2
    docker service logs "$servico" --tail 40 2>&1 | tail -40 >&2
  fi
done

if [ "$falhou" -ne 0 ]; then
  echo "" >&2
  echo "==> Revertendo para a versão anterior..." >&2
  docker service rollback advice_web    || echo "(sem versão anterior para advice_web)" >&2
  docker service rollback advice_worker || echo "(sem versão anterior para advice_worker)" >&2
  exit 1
fi

# --------------------------------------------------------------- limpeza
# Disco do VPS é compartilhado com outros projetos, e cada deploy deixa
# uma imagem nova para trás. Limpar SÓ o que é nosso, guardando as
# últimas $IMAGENS_GUARDADAS (são elas que tornam o rollback instantâneo):
# `docker system prune -a` já derrubou este servidor uma vez — ver
# "VPS_SUBIR_PASSO_A_PASSO 1 1.md".
for repo in advice-web advice-worker; do
  docker image ls "$repo" --format '{{.CreatedAt}}\t{{.Repository}}:{{.Tag}}' \
    | sort -r | tail -n +$((IMAGENS_GUARDADAS + 1)) | cut -f2 \
    | grep -v ':latest$' \
    | xargs -r docker rmi >/dev/null 2>&1 || true
done
# Camadas órfãs do build novo (nunca `-a`).
docker image prune -f >/dev/null 2>&1 || true

echo ""
echo "Deploy OK — advice :$ADVICE_TAG"
docker service ls | grep advice_ || true
