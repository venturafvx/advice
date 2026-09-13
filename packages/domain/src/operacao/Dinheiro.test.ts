import { describe, expect, it } from "vitest";
import { DomainError } from "../erros/DomainError";
import { Dinheiro } from "./Dinheiro";
import { Percentual } from "./Percentual";

describe("Dinheiro", () => {
  it("rejeita centavo fracionário — é o que garante que nenhum float entra no banco", () => {
    expect(() => Dinheiro.deCentavos(10.5)).toThrow(DomainError);
    expect(() => Dinheiro.deCentavos(Number.NaN)).toThrow(DomainError);
  });

  it("rejeita valor negativo", () => {
    expect(() => Dinheiro.deCentavos(-1)).toThrow(DomainError);
  });

  it("converte reais para centavos arredondando o terceiro decimal", () => {
    expect(Dinheiro.deReais(19.99).emCentavos()).toBe(1_999);
    expect(Dinheiro.deReais(0.1 + 0.2).emCentavos()).toBe(30);
  });

  it("rejeita valor acima do teto defensivo", () => {
    expect(() => Dinheiro.deCentavos(100_000_000_001)).toThrow(DomainError);
  });
});

describe("Percentual", () => {
  it("guarda pontos-base e converte para fração", () => {
    expect(Percentual.dePontosBase(1_500).comoFracao()).toBe(0.15);
  });

  it("rejeita percentual acima de 100% ou negativo", () => {
    expect(() => Percentual.dePontosBase(10_001)).toThrow(DomainError);
    expect(() => Percentual.dePontosBase(-1)).toThrow(DomainError);
  });
});
