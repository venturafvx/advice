import { describe, expect, it } from "vitest";
import { Cadencia } from "./Cadencia";
import { DiaCivil } from "./DiaCivil";
import { Habito, HabitoArquivadoError } from "./Habito";
import { HabitoId } from "./HabitoId";
import { RegistroDeHabito } from "./RegistroDeHabito";
import { SituacaoDoDia } from "./SituacaoDoDia";
import { DomainError } from "../erros/DomainError";

describe("Habito", () => {
  it("nasce ativo, com o nome aparado", () => {
    const habito = Habito.criar("  Academia  ", Cadencia.vezesNaSemana(3));
    expect(habito.getNome()).toBe("Academia");
    expect(habito.estaArquivado()).toBe(false);
    expect(habito.getMotivacao()).toBeNull();
  });

  it("recusa nome vazio ou só espaço", () => {
    expect(() => Habito.criar("", Cadencia.diaria())).toThrow(DomainError);
    expect(() => Habito.criar("   ", Cadencia.diaria())).toThrow(DomainError);
  });

  it("recusa nome longo demais", () => {
    expect(() => Habito.criar("a".repeat(61), Cadencia.diaria())).toThrow(/60 caracteres/);
  });

  it("motivação em branco vira ausência, não string vazia", () => {
    expect(Habito.criar("Ler", Cadencia.diaria(), "   ").getMotivacao()).toBeNull();
  });

  it("editar troca nome, regra e motivação", () => {
    const habito = Habito.criar("Ler", Cadencia.diaria());
    habito.editar("Ler 30 min", Cadencia.nosDias([1, 3, 5]), "clareza vem de leitura");

    expect(habito.getNome()).toBe("Ler 30 min");
    expect(habito.getCadencia().getDiasDaSemana()).toEqual([1, 3, 5]);
    expect(habito.getMotivacao()).toBe("clareza vem de leitura");
  });

  /**
   * Arquivar é tirar de circulação preservando o passado. Editar um
   * arquivado mudaria o significado do que já foi registrado sob ele —
   * a regra antiga é parte do que aqueles registros querem dizer.
   */
  it("hábito arquivado não pode ser editado", () => {
    const habito = Habito.criar("Correr", Cadencia.diaria());
    habito.arquivar();

    expect(() => habito.editar("Correr 5km", Cadencia.diaria(), null)).toThrow(HabitoArquivadoError);
  });

  it("reativar devolve o hábito para a agenda", () => {
    const habito = Habito.criar("Correr", Cadencia.diaria());
    habito.arquivar();
    habito.reativar();

    expect(habito.estaArquivado()).toBe(false);
    expect(() => habito.editar("Correr 5km", Cadencia.diaria(), null)).not.toThrow();
  });

  it("arquivar duas vezes não muda nada nem quebra", () => {
    const habito = Habito.criar("Correr", Cadencia.diaria());
    habito.arquivar(new Date("2026-09-17T10:00:00Z"));
    const carimbo = habito.getAtualizadoEm().getTime();
    habito.arquivar(new Date("2026-09-18T10:00:00Z"));

    expect(habito.getAtualizadoEm().getTime()).toBe(carimbo);
  });

  it("sabe se um dia é cobrado pela sua regra", () => {
    const habito = Habito.criar("Ler", Cadencia.nosDias([4]));
    expect(habito.exigeDia(DiaCivil.de("2026-09-17"))).toBe(true); // quinta
    expect(habito.exigeDia(DiaCivil.de("2026-09-18"))).toBe(false);
  });
});

describe("RegistroDeHabito", () => {
  const habitoId = HabitoId.novo();
  const dia = DiaCivil.de("2026-09-17");

  it("guarda o que aconteceu e o que passou pela cabeça, separados", () => {
    const registro = RegistroDeHabito.registrar(habitoId, dia, SituacaoDoDia.QUEBRADO, {
      observacao: "fui dormir 2h",
      pensamento: "sempre acho que amanhã eu compenso",
    });

    expect(registro.foiQuebra()).toBe(true);
    expect(registro.getObservacao()).toBe("fui dormir 2h");
    expect(registro.getPensamento()).toBe("sempre acho que amanhã eu compenso");
    expect(registro.temRelato()).toBe(true);
  });

  it("nota em branco vira ausência", () => {
    const registro = RegistroDeHabito.registrar(habitoId, dia, SituacaoDoDia.FEITO, {
      observacao: "  ",
      pensamento: "",
    });

    expect(registro.getObservacao()).toBeNull();
    expect(registro.temRelato()).toBe(false);
  });

  /** "Foi difícil mas fiz, e pensei em desistir" é dado bom demais para proibir. */
  it("aceita relato também num dia cumprido", () => {
    const registro = RegistroDeHabito.registrar(habitoId, dia, SituacaoDoDia.FEITO, {
      pensamento: "quase não fui",
    });

    expect(registro.foiQuebra()).toBe(false);
    expect(registro.temRelato()).toBe(true);
  });

  it("corrigir troca o veredicto sem mover a hora do primeiro registro", () => {
    const primeiraVez = new Date("2026-09-17T08:00:00Z");
    const registro = RegistroDeHabito.registrar(habitoId, dia, SituacaoDoDia.QUEBRADO, {}, primeiraVez);

    registro.corrigir(SituacaoDoDia.FEITO, {}, new Date("2026-09-17T22:00:00Z"));

    expect(registro.getSituacao()).toBe(SituacaoDoDia.FEITO);
    expect(registro.getRegistradoEm().toISOString()).toBe(primeiraVez.toISOString());
    expect(registro.getAtualizadoEm().getTime()).toBeGreaterThan(primeiraVez.getTime());
  });

  it("corrigir para FEITO limpa o relato da quebra", () => {
    const registro = RegistroDeHabito.registrar(habitoId, dia, SituacaoDoDia.QUEBRADO, {
      observacao: "não fui",
    });
    registro.corrigir(SituacaoDoDia.FEITO);

    expect(registro.getObservacao()).toBeNull();
  });

  it("recusa situação inventada", () => {
    expect(() => RegistroDeHabito.registrar(habitoId, dia, "TALVEZ" as never)).toThrow(DomainError);
  });

  it("recusa relato absurdamente longo", () => {
    expect(() =>
      RegistroDeHabito.registrar(habitoId, dia, SituacaoDoDia.QUEBRADO, { pensamento: "a".repeat(2001) }),
    ).toThrow(/2000 caracteres/);
  });
});
