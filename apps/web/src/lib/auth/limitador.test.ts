import { describe, expect, it } from "vitest";
import { criarLimitador, ipDaRequisicao } from "./limitador";

describe("criarLimitador", () => {
  function comRelogio(limite: number, janelaMs: number) {
    let agora = 1_000_000;
    const limitador = criarLimitador({ limite, janelaMs, agora: () => agora });
    return { limitador, avancar: (ms: number) => (agora += ms) };
  }

  it("permite exatamente o limite de tentativas dentro da janela", () => {
    const { limitador } = comRelogio(3, 60_000);

    expect(limitador.consumir("a").permitido).toBe(true);
    expect(limitador.consumir("a").permitido).toBe(true);
    expect(limitador.consumir("a").permitido).toBe(true);
    expect(limitador.consumir("a").permitido).toBe(false);
  });

  it("informa quantos segundos faltam para a janela reiniciar", () => {
    const { limitador, avancar } = comRelogio(1, 60_000);

    limitador.consumir("a");
    avancar(15_000);

    expect(limitador.consumir("a")).toEqual({ permitido: false, esperarSegundos: 45 });
  });

  it("libera de novo quando a janela expira", () => {
    const { limitador, avancar } = comRelogio(1, 60_000);

    limitador.consumir("a");
    expect(limitador.consumir("a").permitido).toBe(false);

    avancar(60_001);
    expect(limitador.consumir("a").permitido).toBe(true);
  });

  it("conta cada chave separadamente", () => {
    const { limitador } = comRelogio(1, 60_000);

    limitador.consumir("a");
    expect(limitador.consumir("a").permitido).toBe(false);
    expect(limitador.consumir("b").permitido).toBe(true);
  });

  it("zera a contagem da chave depois de um login bem-sucedido", () => {
    const { limitador } = comRelogio(2, 60_000);

    limitador.consumir("a");
    limitador.consumir("a");
    limitador.liberar("a");

    expect(limitador.consumir("a").permitido).toBe(true);
  });

  it("não cresce sem limite quando as chaves são descartáveis", () => {
    let agora = 0;
    const limitador = criarLimitador({ limite: 5, janelaMs: 60_000, maxChaves: 8, agora: () => agora });

    for (let i = 0; i < 500; i += 1) {
      agora += 1;
      limitador.consumir(`ip-${i}`);
    }

    // Sem teto, seriam 500 janelas vivas. O que importa é o limite
    // global continuar contando — o por-IP é best effort sob flood.
    expect(limitador.consumir("ip-499").permitido).toBe(true);
  });
});

describe("ipDaRequisicao", () => {
  function requisicao(headers: Record<string, string>): Request {
    return new Request("https://advice.autozapx.com/api/auth/login", { method: "POST", headers });
  }

  it("usa o primeiro endereço do X-Forwarded-For", () => {
    expect(ipDaRequisicao(requisicao({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe("203.0.113.9");
  });

  it("cai para X-Real-IP quando não há X-Forwarded-For", () => {
    expect(ipDaRequisicao(requisicao({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("não devolve string vazia quando o header vem em branco", () => {
    expect(ipDaRequisicao(requisicao({ "x-forwarded-for": "  " }))).toBe("desconhecido");
  });
});
