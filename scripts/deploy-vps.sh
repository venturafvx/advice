#!/usr/bin/env bash
# Deploy no VPS (Docker Swarm + Traefik). Rodar de dentro de /var/www/advice:
#
#   ./scripts/deploy-vps.sh
#
# Faz o que precisa ser feito na ordem certa e sem depender de ninguém
# lembrar de exportar env var na mão:
#   1. builda as duas imagens (docker stack deploy NÃO builda nada)
#   2. exporta o .env (docker stack deploy NÃO lê .env pra ${VAR})
#   3. aplica a stack
#   4. mostra o status
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "ERRO: .env não existe. Copie de .env.example e preencha antes de subir." >&2
  exit 1
fi

# O host do banco no Swarm precisa ser o nome qualificado da stack.
# Nome curto (`postgres`) colide com o postgres_postgres compartilhado
# que também está na rede Monadanet — a app conectaria no banco errado.
if grep -qE '@postgres:5432' .env; then
  echo "ERRO: DATABASE_URL está usando o host 'postgres'." >&2
  echo "      No Swarm tem que ser 'advice_postgres' — ver .env.example." >&2
  exit 1
fi

echo "==> Buildando imagens..."
docker build -f apps/web/Dockerfile    -t advice-web:latest    .
docker build -f apps/worker/Dockerfile -t advice-worker:latest .

echo "==> Aplicando a stack..."
set -a
# shellcheck disable=SC1091
source .env
set +a
docker stack deploy -c docker-stack.yml advice

echo "==> Status (aguardando os serviços estabilizarem)..."
sleep 20
docker service ls | grep advice_

echo ""
echo "Logs:    docker service logs advice_web --tail 30"
echo "         docker service logs advice_worker --tail 30"
echo "Teste:   curl -sS -I https://advice.autozapx.com"
