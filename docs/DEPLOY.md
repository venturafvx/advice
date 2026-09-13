# Deploy automático (webhook)

`git push` na `main` coloca o commit em produção (`advice.autozapx.com`),
sem ninguém abrir SSH.

```
push na main
   │
   ├─ GitHub dispara POST http://167.88.42.134:9003/deploy  (assinado, HMAC-SHA256)
   │
   ├─ webhook-advice.service  ......... valida assinatura, evento, branch e SHA
   │                                    um deploy por vez (o 2º leva 409)
   ├─ scripts/deploy-remoto.sh ........ git checkout <sha> (com flock)
   ├─ scripts/deploy-vps.sh ........... build das 2 imagens, tag = SHA curto
   │                                    docker stack deploy
   │                                    espera convergir de verdade
   │                                    não convergiu -> docker service rollback
   └─ log em /var/log/deploy-advice.log
```

Mesmo padrão do `torredeoracao` (que roda na 9000 neste mesmo VPS), com
três diferenças deliberadas:

| Lá | Aqui | Por quê |
| --- | --- | --- |
| `npm ci \|\| npm install` | `pnpm install --frozen-lockfile` (dentro do Docker) | fallback esconde lockfile fora de sync; aqui o deploy falha alto e produção não muda |
| `server.js` só em `/var/www` | versionado em `infra/webhook/` | infra que só existe no servidor morre com o servidor |
| `docker service update --force` | `docker stack deploy` + espera + rollback | `--force` não sabe se subiu; aqui deploy quebrado volta sozinho |

## Peças

| O quê | Onde |
| --- | --- |
| Código do webhook | `infra/webhook/server.js` → `/var/www/advice-webhook/server.js` |
| Serviço | `webhook-advice.service` (usuário `deploy`, grupo `docker`) |
| Configuração + segredo | `/etc/default/webhook-advice` (modo 600, root) |
| Deploy | `/var/www/advice/scripts/deploy-remoto.sh` → `deploy-vps.sh` |
| Log de deploy | `/var/log/deploy-advice.log` (logrotate semanal) |
| Porta | `9003`. As `9000`, `9001` e `9002` já são de outros webhooks deste VPS — confira com `ss -ltnp` antes de assumir que uma porta está livre, em vez de deduzir pelo vizinho que você conhece. O instalador recusa instalar sobre porta ocupada. Override: `DEPLOY_PORT=9004 bash infra/webhook/instalar.sh`. |

---

# Instalação (uma vez só)

## 1. Pré-requisitos no VPS

```bash
ssh root@167.88.42.134
ls /var/www/advice/.git /var/www/advice/.env    # clone e .env de produção precisam existir
```

Se o `.env` não existir, envie da máquina de dev **antes**:
`./scripts/enviar-env-producao.sh root@167.88.42.134`.

## 2. Rodar o instalador (como root, no VPS)

```bash
cd /var/www/advice && git pull
bash infra/webhook/instalar.sh
```

Ele cria o usuário `deploy` (no grupo `docker`), instala o `server.js`, a
unit do systemd e o logrotate, gera o `WEBHOOK_SECRET`, sobe o serviço,
restringe a porta 9003 às faixas de IP do GitHub (se o `ufw` estiver
ativo) e imprime o segredo no fim. É idempotente — rodar de novo atualiza
tudo e **preserva** o segredo. Para trocar o segredo:
`bash infra/webhook/instalar.sh --rotar-segredo`.

## 3. Cadastrar o webhook no GitHub

`github.com/venturafvx/advice` → `Settings` → `Webhooks` → `Add webhook`:

| Campo | Valor |
| --- | --- |
| Payload URL | `http://167.88.42.134:9003/deploy` |
| Content type | `application/json` |
| Secret | o segredo impresso pelo instalador |
| Events | `Just the push event` |
| Active | ✅ |

O GitHub manda um `ping` na hora — a entrega tem que voltar `200`.

## 4. Validar antes de confiar

```bash
# saúde
curl -i http://127.0.0.1:9003/health

# disparo assinado, sem passar pelo GitHub
SEGREDO=$(sudo awk -F= '/^WEBHOOK_SECRET=/{print $2}' /etc/default/webhook-advice)
SHA=$(sudo -u deploy git -C /var/www/advice rev-parse HEAD)
BODY="{\"ref\":\"refs/heads/main\",\"after\":\"$SHA\"}"
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SEGREDO" -hex | sed 's/^.* //')"

curl -i -X POST http://127.0.0.1:9003/deploy \
  -H 'Content-Type: application/json' \
  -H 'X-GitHub-Event: push' \
  -H 'X-GitHub-Delivery: teste-local-1' \
  -H "X-Hub-Signature-256: $SIG" \
  --data "$BODY"

# assinatura errada TEM que dar 401
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:9003/deploy \
  -H 'X-GitHub-Event: push' -H 'X-Hub-Signature-256: sha256=errado' --data "$BODY"
```

Esperado: `202` no disparo válido, `401` no inválido. Acompanhe:

```bash
sudo journalctl -u webhook-advice.service -f     # o webhook
sudo tail -f /var/log/deploy-advice.log          # o deploy
```

## 5. Primeiro push de verdade

```bash
git push origin main
```

`Settings → Webhooks → Recent Deliveries` mostra a entrega e a resposta
`202`. O resultado do deploy está no `/var/log/deploy-advice.log` — o
GitHub só sabe que o pedido foi aceito, não que subiu.

---

# Operação

| Situação | Comando |
| --- | --- |
| Deploy | `git push origin main` |
| Redeploy sem commit novo | `Recent Deliveries` → `Redeliver` |
| Ver o que está no ar | `docker service inspect advice_web -f '{{.Spec.TaskTemplate.ContainerSpec.Image}}'` |
| Rollback (imagem já no disco) | `cd /var/www/advice && sudo -u deploy env ADVICE_TAG=<sha-curto> ./scripts/deploy-vps.sh` |
| Versões disponíveis para rollback | `docker image ls advice-web` (as 6 últimas) |
| Deploy de um commit específico | `sudo -u deploy /var/www/advice/scripts/deploy-remoto.sh <sha-40-hex>` |
| Log do último deploy | `sudo tail -n 200 /var/log/deploy-advice.log` |
| Webhook caiu | `sudo systemctl restart webhook-advice.service` |
| Esqueceu/perdeu o segredo | `sudo awk -F= '/^WEBHOOK_SECRET=/{print $2}' /etc/default/webhook-advice` |
| Mudou env var de produção | `./scripts/enviar-env-producao.sh root@167.88.42.134` + redeploy |
| `git pull` na mão no VPS | `sudo -u deploy git -C /var/www/advice pull` (como root, o git deixa objetos root-owned e o próximo deploy quebra) |

## Quando o deploy não acontece

Em ordem, do mais comum ao mais raro:

```bash
# 1. o GitHub conseguiu entregar?  Settings -> Webhooks -> Recent Deliveries
#    (vermelho = não chegou: firewall/porta; 401 = segredo diferente)

# 2. o serviço está de pé?
sudo systemctl status webhook-advice.service --no-pager -l
sudo ss -ltnp | grep :9003

# 3. o webhook recebeu e disparou?
sudo journalctl -u webhook-advice.service -n 100 --no-pager

# 4. o deploy rodou e falhou onde?
sudo tail -n 200 /var/log/deploy-advice.log

# 5. o Swarm, o que diz?
docker service ps advice_web --no-trunc | head -5
docker service logs advice_web --tail 50
```

Falha de build não toca em produção: as imagens são buildadas antes de o
Swarm ser tocado. Falha depois disso dispara `docker service rollback`
automático — o log registra `FALHOU`.

# O que NÃO é automático (de propósito)

- **`.env` de produção.** Segredo não passa por webhook nem por CI.
  Mudou? `scripts/enviar-env-producao.sh` e só então redeploye.
- **Testes.** O webhook não roda `pnpm test` — quem roda é o GitHub
  Actions (`.github/workflows/ci.yml`), em paralelo. O portão real do
  deploy é o `docker build`: typecheck e `next build` quebrados não
  geram imagem. Teste vermelho, hoje, não segura o deploy — olhe o CI.
- **Migrations.** Rodam no boot do `worker`, contra o Supabase. Um push
  com migration quebrada derruba o worker; o script detecta e reverte a
  *imagem*, **mas o banco já terá sido alterado**. Migration destrutiva
  ainda pede revisão humana.
