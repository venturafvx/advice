import { describe, expect, it } from "vitest";
import { conferirSenha, gerarHashDeSenha } from "./senha";

const SENHA = "uma senha longa o bastante para ser real";

describe("gerarHashDeSenha", () => {
  it("produz o formato scrypt$N$r$p$sal$chave", async () => {
    const hash = await gerarHashDeSenha(SENHA);
    const [algoritmo, n, r, p, sal, chave] = hash.split("$");

    expect(algoritmo).toBe("scrypt");
    expect(Number(n)).toBe(131072);
    expect(Number(r)).toBe(8);
    expect(Number(p)).toBe(1);
    expect(Buffer.from(sal ?? "", "base64")).toHaveLength(16);
    expect(Buffer.from(chave ?? "", "base64")).toHaveLength(32);
  });

  it("usa sal novo a cada chamada", async () => {
    const [a, b] = await Promise.all([gerarHashDeSenha(SENHA), gerarHashDeSenha(SENHA)]);
    expect(a).not.toBe(b);
  });
});

describe("conferirSenha", () => {
  it("aceita a senha correta", async () => {
    const hash = await gerarHashDeSenha(SENHA);
    await expect(conferirSenha(SENHA, hash)).resolves.toBe(true);
  });

  it("recusa senha errada", async () => {
    const hash = await gerarHashDeSenha(SENHA);
    await expect(conferirSenha(`${SENHA}x`, hash)).resolves.toBe(false);
  });

  it("trata formas unicode equivalentes como a mesma senha", async () => {
    // "café" composto (e + acento combinante) vs. pré-composto: o mesmo
    // texto digitado em teclados diferentes.
    const composto = "café secreta";
    const precomposto = "café secreta";

    const hash = await gerarHashDeSenha(composto);
    await expect(conferirSenha(precomposto, hash)).resolves.toBe(true);
  });

  it.each([
    ["formato desconhecido", "argon2$v=19$m=65536,t=3,p=4$c2Fs$Y2hhdmU"],
    ["campos de menos", "scrypt$131072$8$1$c2Fs"],
    ["N que não é potência de dois", "scrypt$131073$8$1$c2Fs$Y2hhdmVjaGF2ZWNoYXZlY2hhdmU="],
    ["N absurdo, que travaria o processo", "scrypt$1073741824$8$1$c2Fs$Y2hhdmVjaGF2ZWNoYXZlY2hhdmU="],
    ["sal vazio", "scrypt$131072$8$1$$Y2hhdmVjaGF2ZWNoYXZlY2hhdmU="],
    ["string vazia", ""],
  ])("recusa hash malformado sem lançar: %s", async (_caso, hash) => {
    await expect(conferirSenha(SENHA, hash)).resolves.toBe(false);
  });
});
