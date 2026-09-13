import { describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";

const SEGREDO = Buffer.alloc(32, 7);
const OUTRO_SEGREDO = Buffer.alloc(32, 9);

// O módulo lê AUTH_SESSION_SECRET de forma lazy (na primeira chamada),
// nunca no import — então basta definir antes do primeiro uso.
process.env.AUTH_SESSION_SECRET = SEGREDO.toString("base64");

const { emitirSessao, lerSessao, opcoesCookieExpirado, opcoesCookieSessao } = await import("./sessao");

const EMAIL = "operador@exemplo.com";

/** Monta um token "quase válido" para testar cada defesa isoladamente. */
function forjar(opcoes: {
  chave?: Uint8Array;
  emissor?: string;
  audiencia?: string;
  expiraEm?: number;
}): Promise<string> {
  const agora = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(EMAIL)
    .setIssuer(opcoes.emissor ?? "advice")
    .setAudience(opcoes.audiencia ?? "advice-web")
    .setIssuedAt(agora - 10)
    .setExpirationTime(opcoes.expiraEm ?? agora + 3600)
    .sign(opcoes.chave ?? SEGREDO);
}

describe("emitirSessao / lerSessao", () => {
  it("faz o caminho de volta com o e-mail e um prazo no futuro", async () => {
    const sessao = await lerSessao(await emitirSessao(EMAIL));

    expect(sessao?.email).toBe(EMAIL);
    expect(sessao?.expiraEm).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("devolve null sem token", async () => {
    await expect(lerSessao(undefined)).resolves.toBeNull();
    await expect(lerSessao("")).resolves.toBeNull();
  });

  it("recusa token adulterado no payload", async () => {
    const token = await emitirSessao(EMAIL);
    const [cabecalho, , assinatura] = token.split(".");
    const payloadFalso = Buffer.from(JSON.stringify({ sub: "invasor@exemplo.com" }))
      .toString("base64url")
      .replace(/=+$/, "");

    await expect(lerSessao(`${cabecalho}.${payloadFalso}.${assinatura}`)).resolves.toBeNull();
  });

  it("recusa token assinado com outra chave", async () => {
    await expect(lerSessao(await forjar({ chave: OUTRO_SEGREDO }))).resolves.toBeNull();
  });

  it("recusa token expirado", async () => {
    await expect(
      lerSessao(await forjar({ expiraEm: Math.floor(Date.now() / 1000) - 60 })),
    ).resolves.toBeNull();
  });

  it("recusa token de outro emissor ou outra audiência", async () => {
    await expect(lerSessao(await forjar({ emissor: "outro-app" }))).resolves.toBeNull();
    await expect(lerSessao(await forjar({ audiencia: "outro-app" }))).resolves.toBeNull();
  });

  it('recusa token com alg "none" (confusão de algoritmo)', async () => {
    const cabecalho = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: EMAIL,
        iss: "advice",
        aud: "advice-web",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url");

    await expect(lerSessao(`${cabecalho}.${payload}.`)).resolves.toBeNull();
  });

  it("recusa lixo que não é sequer um JWT", async () => {
    await expect(lerSessao("nao-e-um-token")).resolves.toBeNull();
  });
});

describe("opcoesCookieSessao", () => {
  it("é httpOnly, SameSite=Lax e escopado na raiz", () => {
    const opcoes = opcoesCookieSessao();

    expect(opcoes.httpOnly).toBe(true);
    expect(opcoes.sameSite).toBe("lax");
    expect(opcoes.path).toBe("/");
    expect(opcoes.maxAge).toBe(60 * 60 * 24 * 30);
  });

  it("só marca Secure em produção — em dev o app é http://localhost", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(opcoesCookieSessao().secure).toBe(true);

    vi.stubEnv("NODE_ENV", "development");
    expect(opcoesCookieSessao().secure).toBe(false);

    vi.unstubAllEnvs();
  });

  it("expira o cookie com maxAge zero, mantendo os demais atributos", () => {
    expect(opcoesCookieExpirado()).toEqual({ ...opcoesCookieSessao(), maxAge: 0 });
  });
});

describe("segredo mal configurado", () => {
  /**
   * Fail closed e barulhento: segredo ausente ou curto tem que derrubar
   * a requisição, não degradar para "ninguém está autenticado" — que é
   * indistinguível, de fora, de um app funcionando.
   */
  async function comSegredo(valor: string | undefined): Promise<typeof import("./sessao")> {
    // O segredo é memoizado na primeira chamada; só um módulo novo relê a env.
    vi.resetModules();
    if (valor === undefined) vi.stubEnv("AUTH_SESSION_SECRET", undefined);
    else vi.stubEnv("AUTH_SESSION_SECRET", valor);
    return import("./sessao");
  }

  it("estoura quando o segredo é curto demais para HS256", async () => {
    const modulo = await comSegredo(Buffer.alloc(16, 1).toString("base64"));
    await expect(modulo.lerSessao("qualquer.coisa.aqui")).rejects.toThrow(/32/);
    vi.unstubAllEnvs();
  });

  it("estoura quando o segredo não existe", async () => {
    const modulo = await comSegredo(undefined);
    await expect(modulo.lerSessao("qualquer.coisa.aqui")).rejects.toThrow(/AUTH_SESSION_SECRET/);
    vi.unstubAllEnvs();
  });

  it("estoura quando o segredo não é base64", async () => {
    const modulo = await comSegredo("nao é base64 %%%");
    await expect(modulo.lerSessao("qualquer.coisa.aqui")).rejects.toThrow(/base64/);
    vi.unstubAllEnvs();
  });
});
