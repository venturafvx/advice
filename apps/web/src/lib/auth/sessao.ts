import { SignJWT, jwtVerify } from "jose";

/**
 * Sessão do operador: emissão e verificação do JWT que vive no cookie.
 *
 * Deliberadamente agnóstico de runtime — só Web Crypto, via `jose`,
 * nada de `node:crypto`. O `proxy.ts` do Next 16 roda em Node hoje, mas
 * as próprias docs descrevem o proxy como algo que "pode rodar fora do
 * runtime principal da aplicação"; amarrar a sessão a APIs de Node
 * seria apostar num detalhe que não é contrato. scrypt, que é de Node
 * por natureza, fica isolado em `senha.ts` — importado só pelo route
 * handler de login.
 *
 * Por que JWT assinado e não sessão em tabela: um operador, um
 * dispositivo, nenhuma necessidade de revogar sessão individual. Uma
 * tabela de sessões custaria migration, escrita no banco a cada request
 * e um caminho de limpeza — para resolver um problema que este app não
 * tem. Se um dia precisar derrubar tudo, trocar AUTH_SESSION_SECRET faz
 * isso em um deploy.
 */

export const COOKIE_SESSAO = "advice_sessao";

const EMISSOR = "advice";
const AUDIENCIA = "advice-web";

/**
 * 30 dias. Uso pessoal, um operador, um dispositivo: o que protege a
 * sessão é o cookie httpOnly + Secure + SameSite, não uma janela curta
 * que só produziria fricção semanal.
 */
const DURACAO_SEGUNDOS = 60 * 60 * 24 * 30;

/**
 * Renovação deslizante: com menos disto sobrando, o middleware reemite
 * o cookie. Quem usa o app com alguma regularidade nunca reencontra a
 * tela de login; quem some por 30 dias precisa entrar de novo.
 */
export const RENOVAR_QUANDO_FALTAR_SEGUNDOS = 60 * 60 * 24 * 15;

export interface Sessao {
  /** E-mail do operador, como configurado em `AUTH_EMAIL`. */
  email: string;
  /** Epoch em segundos. */
  expiraEm: number;
}

let segredoCache: Uint8Array | undefined;

/**
 * Lazy, pelo mesmo motivo de `getEnv()` em `@advice/infrastructure`: o
 * `next build` avalia o grafo de módulos das rotas sem as env vars de
 * runtime. Resolver o segredo no import quebraria o build.
 */
function segredo(): Uint8Array {
  if (segredoCache) return segredoCache;

  const bruto = process.env.AUTH_SESSION_SECRET;
  if (!bruto) {
    throw new Error("AUTH_SESSION_SECRET não definida — gere uma com `pnpm auth:senha`.");
  }

  let bytes: Uint8Array;
  try {
    bytes = decodificarBase64(bruto);
  } catch {
    throw new Error("AUTH_SESSION_SECRET não é base64 válido — regere com `pnpm auth:senha`.");
  }

  if (bytes.length < 32) {
    throw new Error(`AUTH_SESSION_SECRET tem ${bytes.length} bytes; HS256 exige no mínimo 32.`);
  }

  segredoCache = bytes;
  return segredoCache;
}

function decodificarBase64(valor: string): Uint8Array {
  const binario = atob(valor);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) {
    bytes[i] = binario.charCodeAt(i);
  }
  return bytes;
}

export async function emitirSessao(email: string): Promise<string> {
  const agora = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(email)
    .setIssuer(EMISSOR)
    .setAudience(AUDIENCIA)
    .setIssuedAt(agora)
    .setExpirationTime(agora + DURACAO_SEGUNDOS)
    .sign(segredo());
}

/**
 * Devolve `null` para qualquer token que não seja íntegro, válido e no
 * prazo — nunca lança por token ruim. Erro de configuração (segredo
 * ausente ou curto) continua estourando de propósito: é falha do
 * ambiente, não de quem está batendo na porta, e precisa ser barulhenta.
 */
export async function lerSessao(token: string | undefined): Promise<Sessao | null> {
  if (!token) return null;

  const chave = segredo();

  try {
    const { payload } = await jwtVerify(token, chave, {
      // Fixar o algoritmo é o que impede troca de `alg` no header
      // (para `none`, ou de HMAC para uma chave pública conhecida).
      algorithms: ["HS256"],
      issuer: EMISSOR,
      audience: AUDIENCIA,
    });

    if (typeof payload.sub !== "string" || typeof payload.exp !== "number") return null;

    return { email: payload.sub, expiraEm: payload.exp };
  } catch {
    return null;
  }
}

export function opcoesCookieSessao(): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    // Lax (não Strict) para que o redirect do /login de volta para a
    // página pedida entregue o cookie na primeira navegação.
    sameSite: "lax",
    // Em dev o app roda em http://localhost; `Secure` ali descartaria
    // o cookie silenciosamente. Em produção é sempre HTTPS (Traefik).
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACAO_SEGUNDOS,
  };
}

export function opcoesCookieExpirado(): ReturnType<typeof opcoesCookieSessao> {
  return { ...opcoesCookieSessao(), maxAge: 0 };
}
