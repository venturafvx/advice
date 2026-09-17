import { DomainError } from "../erros/DomainError";
import { RegistroDeHabitoId } from "./RegistroDeHabitoId";
import { SituacaoDoDia, ehSituacaoDoDia } from "./SituacaoDoDia";
import type { DiaCivil } from "./DiaCivil";
import type { HabitoId } from "./HabitoId";

const NOTA_MAX_LENGTH = 2000;

export interface NotasDoDia {
  /** O que aconteceu — o gatilho, a circunstância. */
  observacao?: string | null;
  /** O que passou pela cabeça na hora. */
  pensamento?: string | null;
}

export interface RegistroDeHabitoPropsRestauracao {
  id: RegistroDeHabitoId;
  habitoId: HabitoId;
  dia: DiaCivil;
  situacao: SituacaoDoDia;
  observacao: string | null;
  pensamento: string | null;
  registradoEm: Date;
  atualizadoEm: Date;
}

function validarNota(texto: string | null | undefined, campo: string): string | null {
  const limpo = texto?.trim() ?? "";
  if (limpo.length === 0) return null;
  if (limpo.length > NOTA_MAX_LENGTH) {
    throw new DomainError(`${campo} não pode ter mais que ${NOTA_MAX_LENGTH} caracteres`);
  }
  return limpo;
}

function validarSituacao(situacao: SituacaoDoDia): SituacaoDoDia {
  if (!ehSituacaoDoDia(situacao)) {
    throw new DomainError("Situação do dia inválida");
  }
  return situacao;
}

/**
 * Aggregate próprio: o que foi declarado sobre um hábito num dia.
 *
 * Existe um por hábito por dia, no máximo — ticar de novo **corrige** o
 * registro, não cria um segundo (ver `corrigir` e o índice único no
 * banco). Trocar de ideia às 22h sobre o que se disse às 8h é normal;
 * ter dois veredictos sobre o mesmo dia não é.
 *
 * Os dois textos são separados de propósito. `observacao` é o que
 * aconteceu; `pensamento` é o que passou pela cabeça. Colapsar os dois
 * num campo só perderia exatamente a parte que serve para reconhecer o
 * padrão na próxima vez — que é o motivo de o fundador ter pedido para
 * escrever quando quebra.
 *
 * Nenhum dos dois é exclusivo da quebra: "foi difícil mas fiz, e pensei
 * em desistir" é informação boa demais para o domínio proibir.
 */
export class RegistroDeHabito {
  private constructor(
    private readonly id: RegistroDeHabitoId,
    private readonly habitoId: HabitoId,
    private readonly dia: DiaCivil,
    private situacao: SituacaoDoDia,
    private observacao: string | null,
    private pensamento: string | null,
    private readonly registradoEm: Date,
    private atualizadoEm: Date,
  ) {}

  static registrar(
    habitoId: HabitoId,
    dia: DiaCivil,
    situacao: SituacaoDoDia,
    notas: NotasDoDia = {},
    agora: Date = new Date(),
  ): RegistroDeHabito {
    return new RegistroDeHabito(
      RegistroDeHabitoId.novo(),
      habitoId,
      dia,
      validarSituacao(situacao),
      validarNota(notas.observacao, "A observação"),
      validarNota(notas.pensamento, "O pensamento"),
      agora,
      agora,
    );
  }

  static restaurar(props: RegistroDeHabitoPropsRestauracao): RegistroDeHabito {
    return new RegistroDeHabito(
      props.id,
      props.habitoId,
      props.dia,
      props.situacao,
      props.observacao,
      props.pensamento,
      props.registradoEm,
      props.atualizadoEm,
    );
  }

  /**
   * Corrige o veredicto do dia e as notas.
   *
   * `registradoEm` não se move: é quando o dia foi declarado pela
   * primeira vez, e é a única coisa aqui que o passado não pode perder.
   */
  corrigir(situacao: SituacaoDoDia, notas: NotasDoDia = {}, agora: Date = new Date()): void {
    this.situacao = validarSituacao(situacao);
    this.observacao = validarNota(notas.observacao, "A observação");
    this.pensamento = validarNota(notas.pensamento, "O pensamento");
    this.atualizadoEm = agora;
  }

  foiQuebra(): boolean {
    return this.situacao === SituacaoDoDia.QUEBRADO;
  }

  /** Tem algo escrito? É o que decide se a quebra entra no diário da tela. */
  temRelato(): boolean {
    return this.observacao !== null || this.pensamento !== null;
  }

  getId(): RegistroDeHabitoId {
    return this.id;
  }

  getHabitoId(): HabitoId {
    return this.habitoId;
  }

  getDia(): DiaCivil {
    return this.dia;
  }

  getSituacao(): SituacaoDoDia {
    return this.situacao;
  }

  getObservacao(): string | null {
    return this.observacao;
  }

  getPensamento(): string | null {
    return this.pensamento;
  }

  getRegistradoEm(): Date {
    return new Date(this.registradoEm.getTime());
  }

  getAtualizadoEm(): Date {
    return new Date(this.atualizadoEm.getTime());
  }
}
