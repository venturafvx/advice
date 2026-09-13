'use strict';

// Webhook de deploy do advice.
//
// Fica escutando na 9003 (a 9000, a 9001 e a 9002 já são de outros
// webhooks neste VPS — confira com `ss -ltnp`), recebe o push da
// main vindo do GitHub e dispara scripts/deploy-remoto.sh com o SHA do
// commit. Zero dependência de terceiro: só o que vem no Node.
//
// Roda como systemd unit (webhook-advice.service), com a configuração
// em /etc/default/webhook-advice (modo 600). Ver docs/DEPLOY.md.
//
// Postura de segurança, já que isto é uma porta aberta na internet que
// termina em `docker stack deploy`:
//   - assinatura HMAC-SHA256 obrigatória, comparada em tempo constante;
//   - corpo limitado, para um POST gigante não virar memória;
//   - só evento `push`, só a branch configurada, só SHA de 40 hex;
//   - um deploy por vez — o segundo recebe 409, não uma corrida;
//   - o payload NUNCA vira argumento de shell: o SHA é validado por
//     regex e passado como argv, sem shell no meio.

const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

const SEGREDO = process.env.WEBHOOK_SECRET || '';
const PORTA = Number(process.env.DEPLOY_PORT || 9003);
const ENDERECO = process.env.DEPLOY_BIND || '0.0.0.0';
const BRANCH = process.env.DEPLOY_BRANCH || 'main';
const SCRIPT = process.env.DEPLOY_SCRIPT || '/var/www/advice/scripts/deploy-remoto.sh';
const LOG = process.env.DEPLOY_LOG || '/var/log/deploy-advice.log';

const LIMITE_CORPO = 512 * 1024; // GitHub manda ~20KB; 512KB já é folga.
const SHA_VALIDO = /^[0-9a-f]{40}$/;

if (SEGREDO.length < 32) {
  console.error('ERRO: WEBHOOK_SECRET ausente ou curto demais (mínimo 32 chars).');
  console.error('      Gere com: openssl rand -hex 32');
  process.exit(1);
}
if (!fs.existsSync(SCRIPT)) {
  console.error(`ERRO: script de deploy não encontrado: ${SCRIPT}`);
  process.exit(1);
}

/** Deploy em andamento, ou null. É a trava de concorrência do processo. */
let emAndamento = null;

const registrar = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

/**
 * Compara a assinatura do GitHub em tempo constante. Um `===` aqui
 * vazaria, pelo tempo de resposta, quantos bytes do HMAC o atacante
 * acertou — é assim que se forja uma assinatura sem saber o segredo.
 */
function assinaturaConfere(corpo, assinaturaRecebida) {
  if (typeof assinaturaRecebida !== 'string') return false;
  const esperada =
    'sha256=' + crypto.createHmac('sha256', SEGREDO).update(corpo).digest('hex');
  const a = Buffer.from(assinaturaRecebida, 'utf8');
  const b = Buffer.from(esperada, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    const pedacos = [];
    let tamanho = 0;
    req.on('data', (pedaco) => {
      tamanho += pedaco.length;
      if (tamanho > LIMITE_CORPO) {
        reject(Object.assign(new Error('corpo grande demais'), { status: 413 }));
        req.destroy();
        return;
      }
      pedacos.push(pedaco);
    });
    req.on('end', () => resolve(Buffer.concat(pedacos)));
    req.on('error', reject);
  });
}

function responder(res, status, dados) {
  const corpo = JSON.stringify(dados);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(corpo),
  });
  res.end(corpo);
}

function dispararDeploy(sha, entrega) {
  const inicio = Date.now();
  emAndamento = { sha, entrega, inicio };

  const log = fs.openSync(LOG, 'a');
  fs.writeSync(
    log,
    `\n===== ${new Date().toISOString()} deploy ${sha} (delivery ${entrega}) =====\n`,
  );

  // argv, não string de shell: o SHA já passou pela regex, mas manter o
  // shell fora do caminho elimina a classe inteira de injeção.
  const filho = spawn(SCRIPT, [sha], { stdio: ['ignore', log, log] });

  const terminar = (desfecho) => {
    const segundos = Math.round((Date.now() - inicio) / 1000);
    fs.writeSync(log, `===== fim: ${desfecho} em ${segundos}s =====\n`);
    fs.closeSync(log);
    emAndamento = null;
    registrar(`deploy ${sha.slice(0, 7)} — ${desfecho} (${segundos}s)`);
  };

  filho.on('close', (codigo) =>
    terminar(codigo === 0 ? 'OK' : `FALHOU (código ${codigo})`),
  );
  filho.on('error', (erro) => terminar(`FALHOU ao iniciar: ${erro.message}`));
}

const servidor = http.createServer(async (req, res) => {
  const rota = (req.url || '').split('?')[0];

  if (req.method === 'GET' && rota === '/health') {
    return responder(res, 200, {
      ok: true,
      branch: BRANCH,
      deploy: emAndamento
        ? { sha: emAndamento.sha, ha: `${Math.round((Date.now() - emAndamento.inicio) / 1000)}s` }
        : null,
    });
  }

  if (req.method !== 'POST' || rota !== '/deploy') {
    return responder(res, 404, { erro: 'rota desconhecida' });
  }

  let corpo;
  try {
    corpo = await lerCorpo(req);
  } catch (erro) {
    return responder(res, erro.status || 400, { erro: erro.message });
  }

  if (!assinaturaConfere(corpo, req.headers['x-hub-signature-256'])) {
    registrar(`assinatura inválida de ${req.socket.remoteAddress}`);
    return responder(res, 401, { erro: 'assinatura inválida' });
  }

  const evento = req.headers['x-github-event'];
  const entrega = String(req.headers['x-github-delivery'] || 'sem-delivery-id').slice(0, 64);

  if (evento === 'ping') return responder(res, 200, { ok: true, pong: true });
  if (evento !== 'push') return responder(res, 202, { ignorado: `evento ${evento}` });

  let payload;
  try {
    payload = JSON.parse(corpo.toString('utf8'));
  } catch {
    return responder(res, 400, { erro: 'payload não é JSON' });
  }

  if (payload.ref !== `refs/heads/${BRANCH}`) {
    return responder(res, 202, { ignorado: `ref ${payload.ref}` });
  }
  if (payload.deleted) {
    return responder(res, 202, { ignorado: 'branch deletada' });
  }

  const sha = String(payload.after || '');
  if (!SHA_VALIDO.test(sha)) {
    return responder(res, 400, { erro: 'campo after não é um SHA válido' });
  }

  if (emAndamento) {
    registrar(`recusado ${sha.slice(0, 7)}: deploy ${emAndamento.sha.slice(0, 7)} em andamento`);
    return responder(res, 409, { erro: 'deploy em andamento', sha: emAndamento.sha });
  }

  // Responder ANTES de deployar: o GitHub desiste da entrega em ~10s, e
  // um build daqui leva minutos.
  responder(res, 202, { ok: true, sha, log: LOG });
  registrar(`deploy ${sha.slice(0, 7)} disparado (delivery ${entrega})`);
  dispararDeploy(sha, entrega);
});

servidor.headersTimeout = 15_000;
servidor.requestTimeout = 30_000;

servidor.listen(PORTA, ENDERECO, () =>
  registrar(`webhook advice escutando em ${ENDERECO}:${PORTA} (branch ${BRANCH})`),
);

for (const sinal of ['SIGTERM', 'SIGINT']) {
  process.on(sinal, () => {
    registrar(`${sinal} recebido; parando de aceitar conexões`);
    // Um deploy já disparado continua: é um processo filho com o log
    // próprio, e matá-lo no meio de um `docker stack deploy` é pior.
    servidor.close(() => process.exit(0));
  });
}
