#!/usr/bin/env bash
# Deploy de um commit específico. É isto que o webhook (infra/webhook/)
# executa quando chega um push na main, com o SHA do commit no $1:
#
#   /var/www/advice/scripts/deploy-remoto.sh <sha-de-40-hex>
#
# Serve também para rodar na mão, dentro do VPS, quando você quer subir
# um commit que não é o HEAD atual do servidor.
#
# Só faz três coisas: valida o SHA, coloca o repositório exatamente nele
# e chama o deploy-vps.sh. Quem sabe buildar e subir stack é o outro.
#
# Todo o corpo vive dentro de main() de propósito: o bash lê script do
# disco sob demanda, e este arquivo se reescreve no meio da própria
# execução (o `git checkout` abaixo). Dentro de uma função, ele é
# parseado inteiro antes de rodar.
set -euo pipefail

REPO="${DEPLOY_REPO:-/var/www/advice}"
TRAVA=/var/lock/advice-deploy.lock

main() {
  local sha="${1:-}"

  # O SHA vem de um payload HTTP. Validar não é paranoia: é o que impede
  # qualquer coisa que não seja um commit de chegar ao `git checkout`.
  if [[ ! "$sha" =~ ^[0-9a-f]{40}$ ]]; then
    echo "ERRO: esperado um SHA de commit (40 hex), recebido: '${sha:-vazio}'" >&2
    exit 2
  fi

  cd "$REPO"

  echo "==> Buscando $sha..."
  git fetch --prune --quiet origin main
  # --force porque o VPS não é lugar de guardar alteração local: o que
  # vale é o que está na main. --detach porque aqui não existe branch.
  git checkout --quiet --force --detach "$sha"
  echo "    $(git log -1 --pretty='%h %s')"

  # Sem ADVICE_TAG: o deploy-vps.sh builda o commit que acabou de entrar.
  unset ADVICE_TAG
  ./scripts/deploy-vps.sh
}

# Serializa deploys. Dois pushes seguidos chegam como dois webhooks, e
# dois `docker stack deploy` ao mesmo tempo deixam o Swarm em estado
# indeterminado. O segundo espera o primeiro terminar.
exec 9>"$TRAVA"
if ! flock -w 900 9; then
  echo "ERRO: outro deploy segurou a trava por mais de 15min." >&2
  exit 75
fi

main "$@"
