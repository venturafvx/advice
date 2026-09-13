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
PORTA=${DEPLOY_PORT:-9003}   # a 9000, 9001 e 9002 já estão ocupadas neste VPS
USUARIO=deploy

[ "$(id -u)" -eq 0 ] || { echo "ERRO: rode como root." >&2; exit 1; }
[ -d "$REPO/.git" ] || { echo "ERRO: $REPO não é um clone do repositório." >&2; exit 1; }

NODE="$(command -v node || true)"
[ -n "$NODE" ] || { echo "ERRO: node não encontrado no PATH." >&2; exit 1; }

# A porta precisa estar livre — ou já ser nossa. Descobrir isso só DEPOIS
# de instalar custou caro: a 9000/9001/9002 já eram de outros webhooks,
# o nosso serviço morria de EADDRINUSE em loop, e o health check batia no
# vizinho, que respondia 200. Instalador que finge sucesso sobre porta
# ocupada é pior do que instalador que falha alto.
dono="$(ss -ltnp 2>/dev/null | awk -v porta=":$PORTA" '$4 ~ porta"$" {print; exit}' || true)"
if [ -n "$dono" ] && ! systemctl is-active --quiet webhook-advice.service; then
  echo "ERRO: a porta $PORTA já está ocupada por outro processo:" >&2
  echo "      $dono" >&2
  echo "      Escolha outra livre (ss -ltnp):  DEPLOY_PORT=9004 bash $0" >&2
  exit 1
fi

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
# O segredo é preservado entre execuções, mas o RESTO da configuração é
# sempre reescrito. Antes, um $CONFIG existente era deixado intacto — e
# então trocar a porta no instalador não surtia efeito nenhum: o serviço
# continuava lendo o DEPLOY_PORT antigo e morrendo de EADDRINUSE, com o
# instalador anunciando sucesso.
if [ ! -f "$CONFIG" ] || [ "$rotar" -eq 1 ]; then
  [ -f "$CONFIG" ] && cp -a "$CONFIG" "$CONFIG.bak.$(date +%F-%H%M%S)"
  SEGREDO="$(openssl rand -hex 32)"
  SEGREDO_NOVO=1
else
  SEGREDO="$(awk -F= '/^WEBHOOK_SECRET=/{print $2}' "$CONFIG")"
  [ -n "$SEGREDO" ] || {
    echo "ERRO: $CONFIG existe mas não tem WEBHOOK_SECRET." >&2
    echo "      Rode com --rotar-segredo para gerar um novo." >&2
    exit 1
  }
  cp -a "$CONFIG" "$CONFIG.bak.$(date +%F-%H%M%S)"
  echo "    (segredo preservado; resto da configuração atualizado)"
  SEGREDO_NOVO=0
fi

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
if ! systemctl is-active --quiet webhook-advice.service; then
  echo "ERRO: webhook-advice.service não subiu." >&2
  systemctl status webhook-advice.service --no-pager -l | head -20 >&2
  exit 1
fi
# Tem de ser o NOSSO /health. Um `curl -fsS` que aceita qualquer 200 foi
# exatamente o que mascarou o EADDRINUSE: o vizinho na mesma porta também
# devolvia 200, em texto puro. O nosso responde JSON e inclui "branch".
resposta="$(curl -fsS --max-time 5 "http://127.0.0.1:$PORTA/health" || true)"
case "$resposta" in
  *'"branch"'*) echo "    $resposta" ;;
  *)
    echo "ERRO: a porta $PORTA respondeu, mas não é o webhook do advice:" >&2
    echo "      ${resposta:-(nenhuma resposta)}" >&2
    exit 1
    ;;
esac

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
