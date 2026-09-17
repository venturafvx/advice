import { describe, expect, it } from "vitest";
import { DiaCivil } from "./DiaCivil";
import { DomainError } from "../erros/DomainError";

describe("DiaCivil", () => {
  it("aceita uma data real e a devolve no mesmo formato", () => {
    expect(DiaCivil.de("2026-09-17").toString()).toBe("2026-09-17");
  });

  it("recusa formato torto", () => {
    expect(() => DiaCivil.de("17/09/2026")).toThrow(DomainError);
    expect(() => DiaCivil.de("2026-9-17")).toThrow(DomainError);
  });

  it("recusa data que não existe, não só formato inválido", () => {
    expect(() => DiaCivil.de("2026-02-30")).toThrow(/inexistente/);
    expect(() => DiaCivil.de("2026-13-01")).toThrow(/inexistente/);
  });

  it("aceita 29 de fevereiro em ano bissexto e recusa fora dele", () => {
    expect(DiaCivil.de("2028-02-29").toString()).toBe("2028-02-29");
    expect(() => DiaCivil.de("2027-02-29")).toThrow(/inexistente/);
  });

  /**
   * O ponto do tipo inteiro: às 21h de São Paulo já é o dia seguinte em
   * UTC. Se "hoje" viesse de `toISOString()`, o tique da noite cairia no
   * dia errado — e o registro do dia certo pareceria não existir.
   */
  it("hoje() é o dia do calendário no timezone, não o dia em UTC", () => {
    const vinteETresHorasEmSaoPaulo = new Date("2026-09-18T02:30:00Z");
    expect(DiaCivil.hoje("America/Sao_Paulo", vinteETresHorasEmSaoPaulo).toString()).toBe("2026-09-17");
    expect(DiaCivil.hoje("UTC", vinteETresHorasEmSaoPaulo).toString()).toBe("2026-09-18");
  });

  it("soma dias atravessando mês e ano", () => {
    expect(DiaCivil.de("2026-01-31").somarDias(1).toString()).toBe("2026-02-01");
    expect(DiaCivil.de("2026-12-31").somarDias(1).toString()).toBe("2027-01-01");
    expect(DiaCivil.de("2026-03-01").somarDias(-1).toString()).toBe("2026-02-28");
  });

  it("conhece o dia da semana (0 = domingo)", () => {
    expect(DiaCivil.de("2026-09-17").diaDaSemana()).toBe(4); // quinta
    expect(DiaCivil.de("2026-09-20").diaDaSemana()).toBe(0); // domingo
  });

  it("a semana começa na segunda, inclusive quando o dia é domingo", () => {
    expect(DiaCivil.de("2026-09-17").inicioDaSemana().toString()).toBe("2026-09-14");
    expect(DiaCivil.de("2026-09-14").inicioDaSemana().toString()).toBe("2026-09-14");
    // Domingo pertence à semana que começou na segunda anterior — não
    // inaugura uma semana nova.
    expect(DiaCivil.de("2026-09-20").inicioDaSemana().toString()).toBe("2026-09-14");
  });

  it("compara e mede distância entre dias", () => {
    const a = DiaCivil.de("2026-09-10");
    const b = DiaCivil.de("2026-09-17");
    expect(a.ehAntesDe(b)).toBe(true);
    expect(b.ehDepoisDe(a)).toBe(true);
    expect(b.diferencaEmDias(a)).toBe(7);
    expect(a.igual(DiaCivil.de("2026-09-10"))).toBe(true);
  });
});
