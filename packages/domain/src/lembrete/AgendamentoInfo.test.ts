import { describe, expect, it } from "vitest";
import { AgendamentoInfo } from "./AgendamentoInfo";
import { DomainError } from "../erros/DomainError";

const AGORA = new Date("2026-09-12T12:00:00Z");

describe("AgendamentoInfo", () => {
  it("rejeita agendamento no passado", () => {
    const noPassado = new Date(AGORA.getTime() - 1000);
    expect(() => AgendamentoInfo.criar(noPassado, "America/Sao_Paulo", AGORA)).toThrow(DomainError);
  });

  it("rejeita data inválida", () => {
    expect(() => AgendamentoInfo.criar(new Date("data-invalida"), "America/Sao_Paulo", AGORA)).toThrow(DomainError);
  });

  it("aceita agendamento no futuro e sabe dizer se já venceu", () => {
    const noFuturo = new Date(AGORA.getTime() + 60_000);
    const agendamento = AgendamentoInfo.criar(noFuturo, "America/Sao_Paulo", AGORA);

    expect(agendamento.jaVenceu(AGORA)).toBe(false);
    expect(agendamento.jaVenceu(new Date(noFuturo.getTime() + 1))).toBe(true);
  });
});
