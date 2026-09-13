#!/usr/bin/env bash
# Envia o .env.production para o VPS, onde ele aterrissa como `.env`.
#
#   ./scripts/enviar-env-producao.sh root@167.88.42.134
#
# Por que o rename: `docker stack deploy` não tem --env-file — ele lê
# `.env` do diretório corrente, e o scripts/deploy-vps.sh dá
# `source .env`. Então no VPS o arquivo precisa se chamar `.env`.
# Na máquina de dev ele NÃO pode se chamar `.env`, senão `pnpm dev:*`
# passaria a escrever em produção.
set -euo pipefail

cd "$(dirname "$0")/.."

DESTINO="${1:-}"
REMOTO="${2:-/var/www/advice}"

if [ -z "$DESTINO" ]; then
  echo "uso: $0 <user>@<host> [caminho-remoto]" >&2
  exit 1
fi

if [ ! -f .env.production ]; then
  echo "ERRO: .env.production não existe." >&2
  exit 1
fi

# Sanidade: falhar aqui é barato, descobrir no ar é caro.
erro=0
grep -qE '^DATABASE_URL=.*pooler\.supabase\.com:6543/' .env.production || {
  echo "ERRO: DATABASE_URL não é o pooler do Supabase na 6543." >&2
  echo "      A 5432/conexão direta só resolve em IPv6 e o VPS não tem." >&2
  echo "      A porta 6543 também é o que desliga prepared statements." >&2
  erro=1
}
grep -qE '^WORKER_PRIMARY=true$' .env.production || {
  echo "ERRO: falta WORKER_PRIMARY=true — o worker vai recusar iniciar." >&2
  erro=1
}
if grep -qE '^[A-Z_]+=.*(change-me|your-.*-here)' .env.production; then
  echo "ERRO: ainda há placeholder do .env.example em .env.production." >&2
  erro=1
fi
[ "$erro" -eq 0 ] || exit 1

echo "==> Enviando .env.production -> $DESTINO:$REMOTO/.env"
scp -p .env.production "$DESTINO:$REMOTO/.env.novo"
ssh "$DESTINO" "chmod 600 $REMOTO/.env.novo && mv $REMOTO/.env.novo $REMOTO/.env"

echo "OK. Agora, no VPS:  cd $REMOTO && ./scripts/deploy-vps.sh"
