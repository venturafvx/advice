import { describe, expect, it } from "vitest";
import { Frequencia, Recorrencia } from "./Recorrencia";
import { partesEmTimezone } from "./tempo";
import { DomainError } from "../erros/DomainError";

const SP = "America/Sao_Paulo";

/** Instante → "YYYY-MM-DD HH:mm" no relógio de parede de São Paulo. */
function parede(instante: Date, timezone = SP): string {
  const p = partesEmTimezone(instante, timezone);
  const pad = (n: number) => `${n}`.padStart(2, "0");
  return `${p.ano}-${pad(p.mes)}-${pad(p.dia)} ${pad(p.hora)}:${pad(p.minuto)}`;
}

describe("Recorrencia — validação", () => {
  it("rejeita hora e minuto fora do relógio", () => {
    expect(() => Recorrencia.diaria(24, 0)).toThrow(DomainError);
    expect(() => Recorrencia.diaria(7, 60)).toThrow(DomainError);
    expect(() => Recorrencia.diaria(7.5, 0)).toThrow(DomainError);
  });

  it("exige pelo menos um dia na recorrência semanal", () => {
    expect(() => Recorrencia.semanal([], 7, 0)).toThrow(DomainError);
  });

  it("normaliza dias da semana repetidos e fora de ordem", () => {
    expect(Recorrencia.semanal([5, 1, 1, 3], 7, 0).getDiasDaSemana()).toEqual([1, 3, 5]);
  });

  it("rejeita dia do mês impossível", () => {
    expect(() => Recorrencia.mensal(0, 7, 0)).toThrow(DomainError);
    expect(() => Recorrencia.mensal(32, 7, 0)).toThrow(DomainError);
  });

  it("descarta campos que não pertencem à frequência", () => {
    const diaria = Recorrencia.de({
      frequencia: Frequencia.DIARIA,
      hora: 7,
      minuto: 0,
      diasDaSemana: [1, 2],
      diaDoMes: 15,
    });

    expect(diaria.getDiasDaSemana()).toEqual([]);
    expect(diaria.getDiaDoMes()).toBeNull();
  });
});

describe("Recorrencia — próxima ocorrência diária", () => {
  const seteDaManha = Recorrencia.diaria(7, 0);

  it("pega o horário de hoje quando ele ainda não passou", () => {
    // 05:00 em São Paulo (UTC-3).
    const agora = new Date("2026-09-17T08:00:00Z");
    expect(parede(seteDaManha.proximaOcorrencia(agora, SP))).toBe("2026-09-17 07:00");
  });

  it("pula para amanhã quando o horário de hoje já passou", () => {
    // 09:00 em São Paulo.
    const agora = new Date("2026-09-17T12:00:00Z");
    expect(parede(seteDaManha.proximaOcorrencia(agora, SP))).toBe("2026-09-18 07:00");
  });

  it("nunca devolve o próprio instante — é estritamente futuro", () => {
    const seteEmPonto = new Date("2026-09-17T10:00:00Z"); // exatamente 07:00 em SP
    expect(parede(seteDaManha.proximaOcorrencia(seteEmPonto, SP))).toBe("2026-09-18 07:00");
  });

  it("atravessa a virada de mês e de ano", () => {
    const reveillon = new Date("2026-12-31T12:00:00Z"); // 09:00 de 31/12 em SP
    expect(parede(seteDaManha.proximaOcorrencia(reveillon, SP))).toBe("2027-01-01 07:00");
  });

  it("não acumula atrasos: worker fora do ar por dias dispara uma vez só", () => {
    // A ocorrência vencida era 14/09; o worker só voltou dia 17 às 09:00.
    const agora = new Date("2026-09-17T12:00:00Z");
    expect(parede(seteDaManha.proximaOcorrencia(agora, SP))).toBe("2026-09-18 07:00");
  });

  it("mantém o relógio de parede atravessando horário de verão", () => {
    // Nova York muda o relógio em 08/03/2026. A regra é "07:00", não "+24h".
    const ny = "America/New_York";
    const antes = new Date("2026-03-07T13:00:00Z"); // 08:00 de 07/03 em NY
    const depois = Recorrencia.diaria(7, 0).proximaOcorrencia(antes, ny);

    expect(parede(depois, ny)).toBe("2026-03-08 07:00");
    // 23 horas de distância no relógio absoluto, 24 no relógio de parede.
    expect(depois.getTime() - new Date("2026-03-07T12:00:00Z").getTime()).toBe(23 * 60 * 60 * 1000);
  });
});

describe("Recorrencia — próxima ocorrência semanal", () => {
  it("encontra o próximo dia marcado da semana", () => {
    // 17/09/2026 é uma quinta-feira. Regra: segunda (1) e quarta (3).
    const regra = Recorrencia.semanal([1, 3], 9, 30);
    const quinta = new Date("2026-09-17T12:00:00Z");

    expect(parede(regra.proximaOcorrencia(quinta, SP))).toBe("2026-09-21 09:30"); // segunda
  });

  it("aceita o próprio dia quando o horário ainda não chegou", () => {
    const regra = Recorrencia.semanal([4], 22, 0); // quinta
    const quintaDeManha = new Date("2026-09-17T12:00:00Z");

    expect(parede(regra.proximaOcorrencia(quintaDeManha, SP))).toBe("2026-09-17 22:00");
  });

  it("dá a volta na semana quando só há um dia marcado e ele já passou", () => {
    const regra = Recorrencia.semanal([4], 6, 0); // quinta às 06:00
    const quintaDeManha = new Date("2026-09-17T12:00:00Z"); // quinta 09:00

    expect(parede(regra.proximaOcorrencia(quintaDeManha, SP))).toBe("2026-09-24 06:00");
  });
});

describe("Recorrencia — próxima ocorrência mensal", () => {
  it("cai no dia escolhido do mês seguinte quando o deste mês passou", () => {
    const regra = Recorrencia.mensal(5, 8, 0);
    const agora = new Date("2026-09-17T12:00:00Z");

    expect(parede(regra.proximaOcorrencia(agora, SP))).toBe("2026-10-05 08:00");
  });

  it("encurta o dia 31 para o último dia do mês curto", () => {
    const regra = Recorrencia.mensal(31, 8, 0);
    const emFevereiro = new Date("2027-02-01T12:00:00Z");

    expect(parede(regra.proximaOcorrencia(emFevereiro, SP))).toBe("2027-02-28 08:00");
  });

  it("encurta respeitando ano bissexto", () => {
    const regra = Recorrencia.mensal(30, 8, 0);
    const emFevereiro = new Date("2028-02-01T12:00:00Z");

    expect(parede(regra.proximaOcorrencia(emFevereiro, SP))).toBe("2028-02-29 08:00");
  });
});
