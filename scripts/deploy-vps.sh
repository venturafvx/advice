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

# O banco de produção é o Supabase, não um Postgres na stack. Estas
# checagens existem porque cada uma já custou um incidente ou quase:
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
