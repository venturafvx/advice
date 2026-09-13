import { DomainError } from "../erros/DomainError";

export const TIMEZONE_PADRAO = "America/Sao_Paulo";

/**
 * Representa o instante para o qual um Lembrete está agendado.
 * Internamente guarda sempre um instante absoluto (Date); o timezone
 * é preservado apenas para exibição — a comparação com "agora" nunca
 * depende dele.
 */
export class AgendamentoInfo {
  private constructor(
    private readonly instante: Date,
    private readonly timezone: string,
  ) {}

  static criar(instante: Date, timezone: string = TIMEZONE_PADRAO, agora: Date = new Date()): AgendamentoInfo {
    if (Number.isNaN(instante.getTime())) {
      throw new DomainError("Data/hora do agendamento é inválida");
    }
    if (instante.getTime() <= agora.getTime()) {
      throw new DomainError("Não é possível agendar um lembrete no passado");
    }
    return new AgendamentoInfo(instante, timezone);
  }

  static restaurar(instante: Date, timezone: string): AgendamentoInfo {
    return new AgendamentoInfo(instante, timezone);
  }

  jaVenceu(agora: Date = new Date()): boolean {
    return this.instante.getTime() <= agora.getTime();
  }

  paraData(): Date {
    return new Date(this.instante.getTime());
  }

  getTimezone(): string {
    return this.timezone;
  }
}
