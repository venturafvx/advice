import { LembreteId } from "./LembreteId";
import { StatusLembrete } from "./StatusLembrete";
import { AgendamentoInfo, TIMEZONE_PADRAO } from "./AgendamentoInfo";
import { Recorrencia } from "./Recorrencia";
import { DomainError, LembreteImutavelError, TransicaoInvalidaError } from "../erros/DomainError";
import type { LembreteEvento } from "./eventos";

const TITULO_MAX_LENGTH = 200;

export interface LembretePropsRestauracao {
  id: LembreteId;
  titulo: string;
  agendamento: AgendamentoInfo;
  status: StatusLembrete;
  criadoEm: Date;
  recorrencia?: Recorrencia | null;
  serieId?: LembreteId | null;
}

/**
 * O novo "quando" de um lembrete que está sendo editado.
 *
 * União discriminada pelo mesmo motivo de `CriarLembreteInput`: um
 * lembrete é uma data única **ou** uma repetição, nunca os dois, e o
 * tipo é quem impede a pergunta "qual deles ganha?" de existir. Editar
 * é, inclusive, como se converte um no outro.
 */
export type NovoAgendamento =
  | { tipo: "AVULSO"; instante: Date; timezone?: string }
  | { tipo: "RECORRENTE"; recorrencia: Recorrencia; timezone?: string };

function validarTitulo(titulo: string): string {
  const limpo = titulo.trim();
  if (limpo.length === 0) {
    throw new DomainError("O título do lembrete não pode ser vazio");
  }
  if (limpo.length > TITULO_MAX_LENGTH) {
    throw new DomainError(`O título do lembrete não pode ter mais que ${TITULO_MAX_LENGTH} caracteres`);
  }
  return limpo;
}

/**
 * Aggregate root do contexto de Lembretes.
 *
 * Invariantes:
 * - título não pode ser vazio nem passar de TITULO_MAX_LENGTH
 * - não pode ser criado com agendamento no passado (garantido por AgendamentoInfo.criar)
 * - só é possível cancelar, marcar como enviado ou marcar como falho a partir de PENDENTE
 * - PENDENTE é o único status não-terminal — as demais transições são definitivas
 * - só um lembrete PENDENTE pode ser editado; terminal é história, não rascunho
 * - um lembrete recorrente pertence a uma série (`serieId`) e só gera o
 *   sucessor a partir de um estado terminal do sistema (ENVIADO/FALHOU)
 *
 * ## Como a recorrência é modelada
 *
 * Um lembrete recorrente **não** é uma linha que reabre. Cada disparo é
 * uma ocorrência própria, com id, histórico de Envios e estado terminal
 * próprios — e, ao terminar, materializa a próxima. Isso preserva
 * intacta a invariante mais valiosa do aggregate (status terminal é
 * definitivo, logo nada é enviado duas vezes por engano) e dá de graça
 * um histórico honesto: dá para ver que a série disparou ontem e
 * falhou anteontem.
 *
 * Existe no máximo uma ocorrência PENDENTE por série, e é isso que faz
 * "cancelar" significar "encerrar a repetição": sem ocorrência pendente,
 * não há quem gere a próxima.
 */
export class Lembrete {
  private eventos: LembreteEvento[] = [];

  private constructor(
    private readonly id: LembreteId,
    private titulo: string,
    private agendamento: AgendamentoInfo,
    private status: StatusLembrete,
    private readonly criadoEm: Date,
    // Mutáveis porque a edição de uma ocorrência PENDENTE pode trocar a
    // regra de repetição — e até converter avulso em série e vice-versa.
    // Fora da edição, nada aqui muda: `gerarProximaOcorrencia` constrói
    // um lembrete novo em vez de mexer no atual.
    private recorrencia: Recorrencia | null,
    private serieId: LembreteId | null,
  ) {}

  static criar(titulo: string, agendamento: AgendamentoInfo, agora: Date = new Date()): Lembrete {
    const lembrete = new Lembrete(
      LembreteId.novo(),
      validarTitulo(titulo),
      agendamento,
      StatusLembrete.PENDENTE,
      agora,
      null,
      null,
    );
    lembrete.eventos.push({ tipo: "LembreteCriado", lembreteId: lembrete.id, ocorridoEm: agora });
    return lembrete;
  }

  /**
   * Primeira ocorrência de uma série. A data não vem do chamador: ela é
   * derivada da regra ("todo dia às 07:00" → o próximo 07:00 que ainda
   * não passou). Ter dois lugares calculando isso seria ter dois
   * calendários.
   */
  static criarRecorrente(
    titulo: string,
    recorrencia: Recorrencia,
    timezone: string = TIMEZONE_PADRAO,
    agora: Date = new Date(),
  ): Lembrete {
    const instante = recorrencia.proximaOcorrencia(agora, timezone);
    const agendamento = AgendamentoInfo.criar(instante, timezone, agora);
    const id = LembreteId.novo();

    const lembrete = new Lembrete(
      id,
      validarTitulo(titulo),
      agendamento,
      StatusLembrete.PENDENTE,
      agora,
      recorrencia,
      id,
    );
    lembrete.eventos.push({ tipo: "LembreteCriado", lembreteId: id, ocorridoEm: agora });
    return lembrete;
  }

  static restaurar(props: LembretePropsRestauracao): Lembrete {
    return new Lembrete(
      props.id,
      props.titulo,
      props.agendamento,
      props.status,
      props.criadoEm,
      props.recorrencia ?? null,
      props.serieId ?? null,
    );
  }

  /**
   * Corrige o lembrete em si: o título e quando ele dispara.
   *
   * Só vale para PENDENTE. Um lembrete que já foi enviado, falhou ou
   * foi cancelado é registro histórico — reescrevê-lo apagaria o que de
   * fato aconteceu, que é exatamente o que o histórico existe para
   * contar. Quem quer o passado fora da tela apaga, não maquia.
   *
   * A edição é o único caminho pelo qual a regra de repetição muda, e o
   * único pelo qual um avulso vira série (inaugurando a própria) ou uma
   * série vira avulso. Como existe no máximo uma ocorrência PENDENTE
   * por série, editar esta ocorrência é editar a repetição daqui para a
   * frente — as que já dispararam continuam no histórico como foram.
   */
  editar(titulo: string, quando: NovoAgendamento, agora: Date = new Date()): void {
    if (this.status !== StatusLembrete.PENDENTE) {
      throw new LembreteImutavelError(this.status);
    }

    const timezone = quando.timezone ?? this.agendamento.getTimezone();
    this.titulo = validarTitulo(titulo);

    if (quando.tipo === "AVULSO") {
      this.agendamento = AgendamentoInfo.criar(quando.instante, timezone, agora);
      this.recorrencia = null;
      this.serieId = null;
    } else {
      // A data continua saindo da regra, nunca do chamador — mesmo
      // contrato de `criarRecorrente`, para não existir um segundo
      // calendário.
      const instante = quando.recorrencia.proximaOcorrencia(agora, timezone);
      this.agendamento = AgendamentoInfo.criar(instante, timezone, agora);
      this.recorrencia = quando.recorrencia;
      this.serieId = this.serieId ?? this.id;
    }

    this.eventos.push({ tipo: "LembreteEditado", lembreteId: this.id, ocorridoEm: agora });
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

  ehRecorrente(): boolean {
    return this.recorrencia !== null;
  }

  /**
   * A próxima ocorrência da série, ou `null` quando não há o que gerar.
   *
   * Não gera a partir de PENDENTE (a ocorrência atual ainda é a próxima)
   * nem de CANCELADO — cancelar é exatamente como o fundador encerra uma
   * repetição. Uma falha definitiva **gera**: a série não pode morrer
   * porque a Evolution API esteve fora do ar numa manhã.
   */
  gerarProximaOcorrencia(agora: Date = new Date()): Lembrete | null {
    if (!this.recorrencia || !this.serieId) return null;
    if (this.status !== StatusLembrete.ENVIADO && this.status !== StatusLembrete.FALHOU) return null;

    const timezone = this.agendamento.getTimezone();
    const instante = this.recorrencia.proximaOcorrencia(agora, timezone);
    const proxima = new Lembrete(
      LembreteId.daOcorrencia(this.serieId, instante),
      this.titulo,
      AgendamentoInfo.criar(instante, timezone, agora),
      StatusLembrete.PENDENTE,
      agora,
      this.recorrencia,
      this.serieId,
    );

    proxima.eventos.push({ tipo: "LembreteCriado", lembreteId: proxima.id, ocorridoEm: agora });
    return proxima;
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

  getRecorrencia(): Recorrencia | null {
    return this.recorrencia;
  }

  getSerieId(): LembreteId | null {
    return this.serieId;
  }
}
