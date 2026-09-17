import { describe, expect, it } from "vitest";
import { Cadencia } from "./Cadencia";
import { DiaCivil } from "./DiaCivil";
import { SituacaoDoDia } from "./SituacaoDoDia";
import { calcularDesempenho, type DiaDeclarado } from "./desempenho";

const HOJE = DiaCivil.de("2026-09-17"); // quinta-feira
const HA_MUITO_TEMPO = DiaCivil.de("2026-01-01");

function feito(dia: string): DiaDeclarado {
  return { dia, situacao: SituacaoDoDia.FEITO };
}

function quebrado(dia: string): DiaDeclarado {
  return { dia, situacao: SituacaoDoDia.QUEBRADO };
}

function desempenho(cadencia: Cadencia, registros: DiaDeclarado[], desde = HA_MUITO_TEMPO) {
  return calcularDesempenho({ cadencia, registros, hoje: HOJE, desde });
}

describe("sequência de um hábito diário", () => {
  it("conta os dias seguidos cumpridos, incluindo hoje", () => {
    const r = desempenho(Cadencia.diaria(), [feito("2026-09-15"), feito("2026-09-16"), feito("2026-09-17")]);
    expect(r.sequencia).toBe(3);
    expect(r.unidadeDaSequencia).toBe("DIAS");
  });

  /**
   * O dia ainda não acabou. Zerar a sequência às 00h01 de cada dia,
   * antes de a pessoa ter tido chance de cumprir, seria um app que
   * castiga por acordar.
   */
  it("hoje ainda não declarado não interrompe a sequência de ontem", () => {
    const r = desempenho(Cadencia.diaria(), [feito("2026-09-15"), feito("2026-09-16")]);
    expect(r.sequencia).toBe(2);
    expect(r.situacaoDeHoje).toBeNull();
    expect(r.cobrarHoje).toBe(true);
  });

  it("quebrar hoje zera a sequência na hora", () => {
    const r = desempenho(Cadencia.diaria(), [feito("2026-09-15"), feito("2026-09-16"), quebrado("2026-09-17")]);
    expect(r.sequencia).toBe(0);
    expect(r.cobrarHoje).toBe(false);
  });

  /** Sequência é o que foi cumprido *e declarado*. Silêncio não é acerto. */
  it("dia devido sem registro nenhum interrompe a sequência", () => {
    const r = desempenho(Cadencia.diaria(), [feito("2026-09-14"), feito("2026-09-16"), feito("2026-09-17")]);
    expect(r.sequencia).toBe(2);
  });

  it("não conta nada de antes de o hábito existir", () => {
    const r = desempenho(Cadencia.diaria(), [feito("2026-09-16"), feito("2026-09-17")], DiaCivil.de("2026-09-16"));
    expect(r.sequencia).toBe(2);
    expect(r.devidos).toBe(2);
  });
});

describe("sequência de um hábito em dias fixos da semana", () => {
  const segundaQuartaSexta = Cadencia.nosDias([1, 3, 5]);

  it("pula os dias que a regra não cobra", () => {
    // 07 seg, 09 qua, 11 sex, 14 seg, 16 qua — todos feitos. Hoje (qui) não é cobrado.
    const r = desempenho(segundaQuartaSexta, [
      feito("2026-09-07"),
      feito("2026-09-09"),
      feito("2026-09-11"),
      feito("2026-09-14"),
      feito("2026-09-16"),
    ]);
    expect(r.sequencia).toBe(5);
    expect(r.cobrarHoje).toBe(false);
    expect(r.situacaoDeHoje).toBeNull();
  });

  it("uma falta num dia cobrado interrompe, mesmo com os outros em dia", () => {
    const r = desempenho(segundaQuartaSexta, [
      feito("2026-09-09"),
      quebrado("2026-09-11"),
      feito("2026-09-14"),
      feito("2026-09-16"),
    ]);
    expect(r.sequencia).toBe(2);
  });

  it("aderência olha só os dias que a regra cobra", () => {
    const r = calcularDesempenho({
      cadencia: segundaQuartaSexta,
      registros: [feito("2026-09-14"), feito("2026-09-16")],
      hoje: HOJE,
      desde: DiaCivil.de("2026-09-14"),
    });
    // Seg 14 e qua 16 cobrados e feitos; quinta 17 não é cobrada.
    expect(r.devidos).toBe(2);
    expect(r.feitos).toBe(2);
    expect(r.aderencia).toBe(1);
  });
});

describe("sequência de uma meta semanal flexível", () => {
  const tresPorSemana = Cadencia.vezesNaSemana(3);

  it("conta semanas que bateram a meta, não dias", () => {
    const r = desempenho(tresPorSemana, [
      // semana de 31/08: 3 feitos
      feito("2026-08-31"),
      feito("2026-09-02"),
      feito("2026-09-04"),
      // semana de 07/09: 3 feitos
      feito("2026-09-07"),
      feito("2026-09-09"),
      feito("2026-09-11"),
      // semana corrente (14/09): 3 feitos
      feito("2026-09-14"),
      feito("2026-09-15"),
      feito("2026-09-16"),
    ]);
    expect(r.unidadeDaSequencia).toBe("SEMANAS");
    expect(r.sequencia).toBe(3);
    expect(r.feitosNaSemana).toBe(3);
    // Meta batida: a semana não cobra mais nada.
    expect(r.cobrarHoje).toBe(false);
  });

  it("semana corrente incompleta não conta como cumprida, mas também não zera o passado", () => {
    const r = desempenho(tresPorSemana, [
      feito("2026-09-07"),
      feito("2026-09-09"),
      feito("2026-09-11"),
      feito("2026-09-14"),
    ]);
    expect(r.sequencia).toBe(1); // só a semana fechada
    expect(r.feitosNaSemana).toBe(1);
    expect(r.cobrarHoje).toBe(true);
  });

  it("aderência mede semanas fechadas, nunca a que ainda está sendo jogada", () => {
    const r = desempenho(tresPorSemana, [
      feito("2026-09-07"),
      feito("2026-09-09"),
      feito("2026-09-11"),
      feito("2026-09-14"),
    ]);
    // A semana corrente (1 de 3) ficaria de fora: incluí-la mostraria
    // 33% toda segunda-feira de manhã.
    expect(r.janela.unidade).toBe("SEMANAS");
    expect(r.feitos).toBe(3);
    expect(r.devidos).toBe(r.janela.tamanho * 3);
    expect(r.aderencia).toBe(3 / r.devidos);
  });
});

describe("hábito recém-criado", () => {
  it("não tem aderência, e isso é null e não 0%", () => {
    const r = calcularDesempenho({
      cadencia: Cadencia.diaria(),
      registros: [],
      hoje: HOJE,
      desde: HOJE,
    });
    expect(r.devidos).toBe(0);
    expect(r.aderencia).toBeNull();
    expect(r.sequencia).toBe(0);
    expect(r.cobrarHoje).toBe(true);
  });

  it("meta flexível sem nenhuma semana fechada também devolve null", () => {
    const r = calcularDesempenho({
      cadencia: Cadencia.vezesNaSemana(3),
      registros: [feito("2026-09-16")],
      hoje: HOJE,
      desde: DiaCivil.de("2026-09-14"),
    });
    expect(r.devidos).toBe(0);
    expect(r.aderencia).toBeNull();
  });
});

/**
 * O caso que só apareceu na prova de ponta a ponta: hábito criado hoje,
 * com os dias anteriores preenchidos na mesma sessão ("venho fazendo há
 * três dias"). A sequência parava na data de criação e mostrava 1.
 */
describe("dias preenchidos retroativamente", () => {
  it("contam na sequência, mesmo sendo anteriores à criação do hábito", () => {
    const r = calcularDesempenho({
      cadencia: Cadencia.diaria(),
      registros: [feito("2026-09-15"), feito("2026-09-16"), feito("2026-09-17")],
      hoje: HOJE,
      desde: HOJE,
    });

    expect(r.sequencia).toBe(3);
  });

  it("mas não entram na aderência — ali só conta o que era para ser cobrado", () => {
    const r = calcularDesempenho({
      cadencia: Cadencia.diaria(),
      registros: [feito("2026-09-15"), feito("2026-09-16"), feito("2026-09-17")],
      hoje: HOJE,
      desde: HOJE,
    });

    expect(r.devidos).toBe(1);
    expect(r.feitos).toBe(1);
  });

  it("uma semana flexível cumprida antes da criação também conta na sequência", () => {
    const r = calcularDesempenho({
      cadencia: Cadencia.vezesNaSemana(3),
      registros: [feito("2026-09-07"), feito("2026-09-09"), feito("2026-09-11")],
      hoje: HOJE,
      desde: HOJE,
    });

    expect(r.sequencia).toBe(1);
    // A semana da criação sai inteira da aderência: cobrar 3 idas numa
    // semana em que o hábito existiu por um dia seria falso.
    expect(r.devidos).toBe(0);
    expect(r.aderencia).toBeNull();
  });
});
