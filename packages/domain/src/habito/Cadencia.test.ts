import { describe, expect, it } from "vitest";
import { Cadencia, FrequenciaDoHabito } from "./Cadencia";
import { DiaCivil } from "./DiaCivil";
import { DomainError } from "../erros/DomainError";

const QUINTA = DiaCivil.de("2026-09-17");
const SEXTA = DiaCivil.de("2026-09-18");

describe("Cadencia", () => {
  it("diária cobra todo dia", () => {
    const cadencia = Cadencia.diaria();
    expect(cadencia.exigeDia(QUINTA)).toBe(true);
    expect(cadencia.exigeDia(SEXTA)).toBe(true);
    expect(cadencia.metaSemanal()).toBe(7);
  });

  it("dias da semana cobra só os dias escolhidos", () => {
    const cadencia = Cadencia.nosDias([1, 4]); // segunda e quinta
    expect(cadencia.exigeDia(QUINTA)).toBe(true);
    expect(cadencia.exigeDia(SEXTA)).toBe(false);
    expect(cadencia.metaSemanal()).toBe(2);
  });

  it("normaliza dias repetidos e fora de ordem", () => {
    expect(Cadencia.nosDias([5, 1, 1, 3]).getDiasDaSemana()).toEqual([1, 3, 5]);
  });

  it("recusa dias da semana sem nenhum dia, ou com dia inexistente", () => {
    expect(() => Cadencia.nosDias([])).toThrow(DomainError);
    expect(() => Cadencia.nosDias([7])).toThrow(DomainError);
    expect(() => Cadencia.nosDias([1.5])).toThrow(DomainError);
  });

  /**
   * Meta flexível não tem dia obrigatório: a cobrança é da semana. Se
   * `exigeDia` respondesse `true`, "3x por semana" viraria sete
   * cobranças diárias e quatro falsas faltas.
   */
  it("meta flexível não exige nenhum dia em particular", () => {
    const cadencia = Cadencia.vezesNaSemana(3);
    expect(cadencia.exigeDia(QUINTA)).toBe(false);
    expect(cadencia.exigeDia(SEXTA)).toBe(false);
    expect(cadencia.metaSemanal()).toBe(3);
    expect(cadencia.ehFlexivel()).toBe(true);
  });

  it("recusa meta semanal fora de 1..7", () => {
    expect(() => Cadencia.vezesNaSemana(0)).toThrow(DomainError);
    expect(() => Cadencia.vezesNaSemana(8)).toThrow(DomainError);
    expect(() => Cadencia.vezesNaSemana(2.5)).toThrow(DomainError);
  });

  it("7x por semana é diária, e vira diária de verdade", () => {
    const cadencia = Cadencia.vezesNaSemana(7);
    expect(cadencia.getFrequencia()).toBe(FrequenciaDoHabito.DIARIA);
    expect(cadencia.ehFlexivel()).toBe(false);
  });

  it("recusa frequência inventada vinda de fora", () => {
    expect(() =>
      Cadencia.de({ frequencia: "QUANDO_DER" as never, diasDaSemana: [], vezesPorSemana: null }),
    ).toThrow(DomainError);
  });

  it("vai e volta pela forma serializável sem perder nada", () => {
    for (const cadencia of [Cadencia.diaria(), Cadencia.nosDias([0, 6]), Cadencia.vezesNaSemana(4)]) {
      expect(Cadencia.de(cadencia.paraProps()).igual(cadencia)).toBe(true);
    }
  });
});
