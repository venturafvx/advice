#!/usr/bin/env bash
# Instala (ou reinstala) o webhook de deploy do advice no VPS.
# Rodar como root, no VPS, com o repositório já clonado em /var/www/advice:
#
#   bash /var/www/advice/infra/webhook/instalar.sh
#   bash /var/www/advice/infra/webhook/instalar.sh --rotar-segredo
#
# É idempotente: rodar de novo atualiza o server.js, a unit e o
# logrotate, e PRESERVA o segredo existente (a menos que --rotar-segredo,
# que obriga a trocar também no GitHub).
set -euo pipefail

REPO=/var/www/advice
DESTINO=/var/www/advice-webhook
CONFIG=/etc/default/webhook-advice
UNIT=/etc/systemd/system/webhook-advice.service
LOG=/var/log/deploy-advice.log
PORTA=9001   # a 9000 é do webhook do torredeoracao
USUARIO=deploy

[ "$(id -u)" -eq 0 ] || { echo "ERRO: rode como root." >&2; exit 1; }
[ -d "$REPO/.git" ] || { echo "ERRO: $REPO não é um clone do repositório." >&2; exit 1; }

NODE="$(command -v node || true)"
[ -n "$NODE" ] || { echo "ERRO: node não encontrado no PATH." >&2; exit 1; }

rotar=0
[ "${1:-}" = "--rotar-segredo" ] && rotar=1

echo "==> Usuário $USUARIO"
id -u "$USUARIO" >/dev/null 2>&1 || useradd -m -s /bin/bash "$USUARIO"
usermod -aG docker "$USUARIO"
# O deploy roda `git checkout` e `docker build` como este usuário.
chown -R "$USUARIO:$USUARIO" "$REPO"
# O .env de produção continua sendo só dele.
[ -f "$REPO/.env" ] && chmod 600 "$REPO/.env"

echo "==> Código do webhook em $DESTINO"
install -d -o "$USUARIO" -g "$USUARIO" -m 755 "$DESTINO"
install -o "$USUARIO" -g "$USUARIO" -m 644 "$REPO/infra/webhook/server.js" "$DESTINO/server.js"

echo "==> Log em $LOG"
touch "$LOG"
chown "$USUARIO:$USUARIO" "$LOG"
chmod 640 "$LOG"
install -m 644 "$REPO/infra/webhook/logrotate-advice-deploy" /etc/logrotate.d/advice-deploy

echo "==> Configuração em $CONFIG"
if [ ! -f "$CONFIG" ] || [ "$rotar" -eq 1 ]; then
  [ -f "$CONFIG" ] && cp -a "$CONFIG" "$CONFIG.bak.$(date +%F-%H%M%S)"
  SEGREDO="$(openssl rand -hex 32)"
  cat > "$CONFIG" <<EOF
WEBHOOK_SECRET=$SEGREDO
DEPLOY_PORT=$PORTA
DEPLOY_BRANCH=main
DEPLOY_SCRIPT=$REPO/scripts/deploy-remoto.sh
DEPLOY_REPO=$REPO
DEPLOY_LOG=$LOG
EOF
  chmod 600 "$CONFIG"
  chown root:root "$CONFIG"
  SEGREDO_NOVO=1
else
  echo "    (mantendo o segredo existente)"
  SEGREDO_NOVO=0
fi

echo "==> Unit do systemd"
install -m 644 "$REPO/infra/webhook/webhook-advice.service" "$UNIT"
if [ "$NODE" != /usr/bin/node ]; then
  sed -i "s|ExecStart=/usr/bin/node|ExecStart=$NODE|" "$UNIT"
  echo "    node: $NODE"
fi
systemctl daemon-reload
systemctl enable --now webhook-advice.service
systemctl restart webhook-advice.service

echo "==> Firewall"
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q '^Status: active'; then
  # Só o GitHub precisa alcançar esta porta. As faixas vêm da própria
  # API do GitHub (campo "hooks"), não de uma lista chutada aqui.
  faixas="$(curl -fsS --max-time 15 https://api.github.com/meta \
    | python3 -c 'import json,sys; print("\n".join(json.load(sys.stdin)["hooks"]))' 2>/dev/null || true)"
  if [ -n "$faixas" ]; then
    # Limpa regras antigas desta porta antes de recriar.
    #
    # `ufw --force delete`, não `yes | ufw delete`: com `set -o pipefail`
    # o `yes` morre de SIGPIPE (141) quando o ufw fecha a entrada, e o
    # `set -e` derrubava o instalador aqui. O bug só aparecia a partir da
    # SEGUNDA execução, quando já existe regra para apagar — e derrubava
    # o script depois de já ter rotacionado o segredo e antes de imprimi-lo.
    while n="$(ufw status numbered | grep -m1 "$PORTA" | sed -n 's/^\[ *\([0-9]*\).*/\1/p')" && [ -n "$n" ]; do
      ufw --force delete "$n" >/dev/null
    done
    while read -r faixa; do
      [ -n "$faixa" ] && ufw allow from "$faixa" to any port "$PORTA" proto tcp >/dev/null
    done <<< "$faixas"
    echo "    $(wc -l <<< "$faixas") faixas do GitHub liberadas na $PORTA; o resto continua bloqueado."
  else
    echo "    AVISO: não consegui ler api.github.com/meta. Libere a $PORTA manualmente." >&2
  fi
else
  echo "    ufw não está ativo — a porta $PORTA fica aberta para a internet."
  echo "    A assinatura HMAC continua protegendo, mas restringir por IP é melhor."
fi

echo "==> Health"
sleep 2
curl -fsS "http://127.0.0.1:$PORTA/health" && echo ""

echo ""
echo "Pronto."
if [ "${SEGREDO_NOVO:-0}" -eq 1 ]; then
  echo ""
  echo "  SEGREDO DO WEBHOOK (cole no GitHub -> Settings -> Webhooks):"
  echo ""
  echo "      $(awk -F= '/^WEBHOOK_SECRET=/{print $2}' "$CONFIG")"
  echo ""
  echo "  URL:          http://167.88.42.134:$PORTA/deploy"
  echo "  Content type: application/json"
  echo "  Evento:       Just the push event"
fi
