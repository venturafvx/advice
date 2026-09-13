#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Criado .env a partir de .env.example — edite EVOLUTION_API_KEY e WHATSAPP_DESTINO antes de continuar."
fi

corepack enable
pnpm install
pnpm --filter @advice/domain --filter @advice/infrastructure run build

echo "Subindo Postgres..."
docker compose up -d postgres

echo "Aguardando Postgres ficar saudável..."
until [ "$(docker compose ps -q postgres | xargs docker inspect -f '{{.State.Health.Status}}')" = "healthy" ]; do
  sleep 1
done

echo "Aplicando migrations..."
pnpm db:migrate

echo ""
echo "Pronto. Para desenvolver:"
echo "  Terminal 1: pnpm dev:web"
echo "  Terminal 2: pnpm dev:worker"
echo ""
echo "Para produção (no VPS):"
echo "  docker compose -f docker-compose.yml up -d --build"
