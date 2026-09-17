import { describe, expect, it } from "vitest";
import { Lembrete } from "./Lembrete";
import { AgendamentoInfo } from "./AgendamentoInfo";
import { StatusLembrete } from "./StatusLembrete";
import { Recorrencia } from "./Recorrencia";
import { LembreteImutavelError, TransicaoInvalidaError } from "../erros/DomainError";
import { DomainError } from "../erros/DomainError";

const AGORA = new Date("2026-09-12T12:00:00Z");
const DAQUI_A_UMA_HORA = new Date("2026-09-12T13:00:00Z");

function criarLembretePendente() {
  const agendamento = AgendamentoInfo.criar(DAQUI_A_UMA_HORA, "America/Sao_Paulo", AGORA);
  return Lembrete.criar("Reunião com fornecedor", agendamento, AGORA);
}

describe("Lembrete", () => {
  it("nasce PENDENTE e dispara o evento LembreteCriado", () => {
    const lembrete = criarLembretePendente();

    expect(lembrete.getStatus()).toBe(StatusLembrete.PENDENTE);
    const eventos = lembrete.extrairEventos();
    expect(eventos).toHaveLength(1);
    expect(eventos[0]?.tipo).toBe("LembreteCriado");
  });

  it("rejeita título vazio", () => {
    const agendamento = AgendamentoInfo.criar(DAQUI_A_UMA_HORA, "America/Sao_Paulo", AGORA);
    expect(() => Lembrete.criar("   ", agendamento, AGORA)).toThrow(DomainError);
  });

  it("cancela um lembrete pendente", () => {
    const lembrete = criarLembretePendente();
    lembrete.extrairEventos();

    lembrete.cancelar(AGORA);

    expect(lembrete.getStatus()).toBe(StatusLembrete.CANCELADO);
    expect(lembrete.extrairEventos()[0]?.tipo).toBe("LembreteCancelado");
  });

  it("não permite cancelar um lembrete que já foi enviado", () => {
    const lembrete = criarLembretePendente();
    lembrete.marcarComoEnviado(AGORA);

    expect(() => lembrete.cancelar(AGORA)).toThrow(TransicaoInvalidaError);
  });

  it("não permite marcar como enviado duas vezes", () => {
    const lembrete = criarLembretePendente();
    lembrete.marcarComoEnviado(AGORA);

    expect(() => lembrete.marcarComoEnviado(AGORA)).toThrow(TransicaoInvalidaError);
  });

  it("identifica quando está pendente e já venceu o horário", () => {
    const lembrete = criarLembretePendente();
    const depoisDoAgendamento = new Date(DAQUI_A_UMA_HORA.getTime() + 1000);

    expect(lembrete.estaPendenteParaEnvio(AGORA)).toBe(false);
    expect(lembrete.estaPendenteParaEnvio(depoisDoAgendamento)).toBe(true);
  });
});

describe("Lembrete recorrente", () => {
  const SP = "America/Sao_Paulo";
  // 17/09/2026, 09:00 em São Paulo.
  const MANHA = new Date("2026-09-17T12:00:00Z");
  const seteDaManha = Recorrencia.diaria(7, 0);

  function criarDiario() {
    return Lembrete.criarRecorrente("Tomar o remédio", seteDaManha, SP, MANHA);
  }

  it("nasce PENDENTE na próxima ocorrência da regra, sem receber data", () => {
    const lembrete = criarDiario();

    expect(lembrete.getStatus()).toBe(StatusLembrete.PENDENTE);
    expect(lembrete.ehRecorrente()).toBe(true);
    // 07:00 de hoje já passou às 09:00 — a primeira é amanhã.
    expect(lembrete.getAgendamento().paraData().toISOString()).toBe("2026-09-18T10:00:00.000Z");
  });

  it("é a origem da própria série", () => {
    const lembrete = criarDiario();
    expect(lembrete.getSerieId()?.toString()).toBe(lembrete.getId().toString());
  });

  it("não gera a próxima ocorrência enquanto está pendente", () => {
    expect(criarDiario().gerarProximaOcorrencia(MANHA)).toBeNull();
  });

  it("materializa a próxima ocorrência depois de enviado, na mesma série", () => {
    const lembrete = criarDiario();
    const disparo = new Date("2026-09-18T10:00:05Z"); // 07:00:05 do dia seguinte
    lembrete.marcarComoEnviado(disparo);

    const proxima = lembrete.gerarProximaOcorrencia(disparo);

    expect(proxima).not.toBeNull();
    expect(proxima?.getStatus()).toBe(StatusLembrete.PENDENTE);
    expect(proxima?.getTitulo()).toBe("Tomar o remédio");
    expect(proxima?.getSerieId()?.toString()).toBe(lembrete.getSerieId()?.toString());
    expect(proxima?.getId().toString()).not.toBe(lembrete.getId().toString());
    expect(proxima?.getAgendamento().paraData().toISOString()).toBe("2026-09-19T10:00:00.000Z");
  });

  it("continua a série depois de uma falha definitiva", () => {
    const lembrete = criarDiario();
    const disparo = new Date("2026-09-18T10:00:05Z");
    lembrete.marcarComoFalhou("Evolution API fora do ar", disparo);

    expect(lembrete.gerarProximaOcorrencia(disparo)?.getAgendamento().paraData().toISOString()).toBe(
      "2026-09-19T10:00:00.000Z",
    );
  });

  it("encerra a série quando é cancelado", () => {
    const lembrete = criarDiario();
    lembrete.cancelar(MANHA);

    expect(lembrete.gerarProximaOcorrencia(MANHA)).toBeNull();
  });

  it("gera id determinístico — regenerar depois de uma falha não duplica o lembrete", () => {
    const lembrete = criarDiario();
    const disparo = new Date("2026-09-18T10:00:05Z");
    lembrete.marcarComoEnviado(disparo);

    const primeira = lembrete.gerarProximaOcorrencia(disparo);
    const repetida = lembrete.gerarProximaOcorrencia(new Date(disparo.getTime() + 60_000));

    expect(repetida?.getId().toString()).toBe(primeira?.getId().toString());
  });

  it("um lembrete avulso nunca gera sucessor", () => {
    const lembrete = criarLembretePendente();
    lembrete.marcarComoEnviado(AGORA);

    expect(lembrete.ehRecorrente()).toBe(false);
    expect(lembrete.gerarProximaOcorrencia(AGORA)).toBeNull();
  });
});

describe("Lembrete editado", () => {
  const SP = "America/Sao_Paulo";
  // 17/09/2026, 09:00 em São Paulo.
  const MANHA = new Date("2026-09-17T12:00:00Z");
  const DEPOIS = new Date("2026-09-17T15:00:00Z");

  function criarAvulso() {
    const agendamento = AgendamentoInfo.criar(DEPOIS, SP, MANHA);
    return Lembrete.criar("Pagar o fornecedor", agendamento, MANHA);
  }

  it("troca título e data de um lembrete avulso", () => {
    const lembrete = criarAvulso();
    lembrete.extrairEventos();
    const novaData = new Date("2026-09-18T15:00:00Z");

    lembrete.editar("Pagar o fornecedor X", { tipo: "AVULSO", instante: novaData }, MANHA);

    expect(lembrete.getTitulo()).toBe("Pagar o fornecedor X");
    expect(lembrete.getAgendamento().paraData()).toEqual(novaData);
    expect(lembrete.extrairEventos()[0]?.tipo).toBe("LembreteEditado");
  });

  it("recusa a nova data no passado", () => {
    const lembrete = criarAvulso();
    const ontem = new Date("2026-09-16T15:00:00Z");

    expect(() => lembrete.editar("Pagar", { tipo: "AVULSO", instante: ontem }, MANHA)).toThrow(DomainError);
  });

  it("recusa título vazio e não deixa o lembrete meio editado", () => {
    const lembrete = criarAvulso();

    expect(() => lembrete.editar("   ", { tipo: "AVULSO", instante: DEPOIS }, MANHA)).toThrow(DomainError);
    expect(lembrete.getTitulo()).toBe("Pagar o fornecedor");
  });

  it("não edita um lembrete que já é história", () => {
    const lembrete = criarAvulso();
    lembrete.marcarComoEnviado(MANHA);

    expect(() => lembrete.editar("Outro título", { tipo: "AVULSO", instante: DEPOIS }, MANHA)).toThrow(
      LembreteImutavelError,
    );
  });

  it("converte um avulso em série, inaugurando a própria", () => {
    const lembrete = criarAvulso();

    lembrete.editar("Tomar o remédio", { tipo: "RECORRENTE", recorrencia: Recorrencia.diaria(7, 0) }, MANHA);

    expect(lembrete.ehRecorrente()).toBe(true);
    expect(lembrete.getSerieId()?.toString()).toBe(lembrete.getId().toString());
    // 07:00 de hoje já passou às 09:00 — a próxima é amanhã.
    expect(lembrete.getAgendamento().paraData().toISOString()).toBe("2026-09-18T10:00:00.000Z");
  });

  it("muda o horário da repetição sem trocar a série", () => {
    const lembrete = Lembrete.criarRecorrente("Tomar o remédio", Recorrencia.diaria(7, 0), SP, MANHA);
    const serie = lembrete.getSerieId()?.toString();

    lembrete.editar(
      "Tomar o remédio",
      { tipo: "RECORRENTE", recorrencia: Recorrencia.diaria(20, 30) },
      MANHA,
    );

    expect(lembrete.getSerieId()?.toString()).toBe(serie);
    expect(lembrete.getRecorrencia()?.getHora()).toBe(20);
    // 20:30 de hoje ainda não passou às 09:00 — a próxima é hoje à noite.
    expect(lembrete.getAgendamento().paraData().toISOString()).toBe("2026-09-17T23:30:00.000Z");
  });

  it("converte uma série em avulso e ela deixa de gerar sucessor", () => {
    const lembrete = Lembrete.criarRecorrente("Tomar o remédio", Recorrencia.diaria(7, 0), SP, MANHA);

    lembrete.editar("Tomar o remédio uma vez só", { tipo: "AVULSO", instante: DEPOIS }, MANHA);
    lembrete.marcarComoEnviado(DEPOIS);

    expect(lembrete.ehRecorrente()).toBe(false);
    expect(lembrete.getSerieId()).toBeNull();
    expect(lembrete.gerarProximaOcorrencia(DEPOIS)).toBeNull();
  });
});
