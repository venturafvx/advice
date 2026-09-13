import { describe, expect, it } from "vitest";
import { Lembrete } from "./Lembrete";
import { AgendamentoInfo } from "./AgendamentoInfo";
import { StatusLembrete } from "./StatusLembrete";
import { TransicaoInvalidaError } from "../erros/DomainError";
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
