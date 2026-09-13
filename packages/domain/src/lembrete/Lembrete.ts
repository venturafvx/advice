import { LembreteId } from "./LembreteId";
import { StatusLembrete } from "./StatusLembrete";
import { AgendamentoInfo } from "./AgendamentoInfo";
import { DomainError, TransicaoInvalidaError } from "../erros/DomainError";
import type { LembreteEvento } from "./eventos";

const TITULO_MAX_LENGTH = 200;

export interface LembretePropsRestauracao {
  id: LembreteId;
  titulo: string;
  agendamento: AgendamentoInfo;
  status: StatusLembrete;
  criadoEm: Date;
}

/**
 * Aggregate root do contexto de Lembretes.
 *
 * Invariantes:
 * - título não pode ser vazio nem passar de TITULO_MAX_LENGTH
 * - não pode ser criado com agendamento no passado (garantido por AgendamentoInfo.criar)
 * - só é possível cancelar, marcar como enviado ou marcar como falho a partir de PENDENTE
 * - PENDENTE é o único status não-terminal — as demais transições são definitivas
 */
export class Lembrete {
  private eventos: LembreteEvento[] = [];

  private constructor(
    private readonly id: LembreteId,
    private titulo: string,
    private agendamento: AgendamentoInfo,
    private status: StatusLembrete,
    private readonly criadoEm: Date,
  ) {}

  static criar(titulo: string, agendamento: AgendamentoInfo, agora: Date = new Date()): Lembrete {
    const tituloLimpo = titulo.trim();
    if (tituloLimpo.length === 0) {
      throw new DomainError("O título do lembrete não pode ser vazio");
    }
    if (tituloLimpo.length > TITULO_MAX_LENGTH) {
      throw new DomainError(`O título do lembrete não pode ter mais que ${TITULO_MAX_LENGTH} caracteres`);
    }

    const lembrete = new Lembrete(LembreteId.novo(), tituloLimpo, agendamento, StatusLembrete.PENDENTE, agora);
    lembrete.eventos.push({ tipo: "LembreteCriado", lembreteId: lembrete.id, ocorridoEm: agora });
    return lembrete;
  }

  static restaurar(props: LembretePropsRestauracao): Lembrete {
    return new Lembrete(props.id, props.titulo, props.agendamento, props.status, props.criadoEm);
  }

  cancelar(agora: Date = new Date()): void {
    this.exigirPendente(StatusLembrete.CANCELADO);
    this.status = StatusLembrete.CANCELADO;
    this.eventos.push({ tipo: "LembreteCancelado", lembreteId: this.id, ocorridoEm: agora });
  }

  marcarComoEnviado(agora: Date = new Date()): void {
    this.exigirPendente(StatusLembrete.ENVIADO);
    this.status = StatusLembrete.ENVIADO;
    this.eventos.push({ tipo: "LembreteEnviado", lembreteId: this.id, ocorridoEm: agora });
  }

  marcarComoFalhou(motivo: string, agora: Date = new Date()): void {
    this.exigirPendente(StatusLembrete.FALHOU);
    this.status = StatusLembrete.FALHOU;
    this.eventos.push({ tipo: "EnvioDeLembreteFalhou", lembreteId: this.id, motivo, ocorridoEm: agora });
  }

  estaPendenteParaEnvio(agora: Date = new Date()): boolean {
    return this.status === StatusLembrete.PENDENTE && this.agendamento.jaVenceu(agora);
  }

  extrairEventos(): LembreteEvento[] {
    const eventos = this.eventos;
    this.eventos = [];
    return eventos;
  }

  private exigirPendente(statusDesejado: StatusLembrete): void {
    if (this.status !== StatusLembrete.PENDENTE) {
      throw new TransicaoInvalidaError(this.status, statusDesejado);
    }
  }

  getId(): LembreteId {
    return this.id;
  }

  getTitulo(): string {
    return this.titulo;
  }

  getAgendamento(): AgendamentoInfo {
    return this.agendamento;
  }

  getStatus(): StatusLembrete {
    return this.status;
  }

  getCriadoEm(): Date {
    return new Date(this.criadoEm.getTime());
  }
}
