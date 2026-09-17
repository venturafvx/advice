import { DomainError } from "../erros/DomainError";
import { Cadencia } from "./Cadencia";
import { HabitoId } from "./HabitoId";
import type { DiaCivil } from "./DiaCivil";

const NOME_MAX_LENGTH = 60;
const MOTIVACAO_MAX_LENGTH = 500;

/** Mexer num hábito arquivado — que é história, não agenda. */
export class HabitoArquivadoError extends DomainError {
  constructor(nome: string) {
    super(`O hábito "${nome}" está arquivado. Reative para poder editar.`);
    this.name = "HabitoArquivadoError";
  }
}

export interface HabitoPropsRestauracao {
  id: HabitoId;
  nome: string;
  motivacao: string | null;
  cadencia: Cadencia;
  arquivado: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
}

function validarNome(nome: string): string {
  const limpo = nome.trim();
  if (limpo.length === 0) {
    throw new DomainError("O hábito precisa de um nome");
  }
  if (limpo.length > NOME_MAX_LENGTH) {
    throw new DomainError(`O nome do hábito não pode ter mais que ${NOME_MAX_LENGTH} caracteres`);
  }
  return limpo;
}

function validarMotivacao(motivacao: string | null): string | null {
  const limpa = motivacao?.trim() ?? "";
  if (limpa.length === 0) {
    // String vazia vira ausência: dois jeitos de dizer "não escrevi
    // nada" viram dois caminhos em toda leitura daqui para a frente.
    return null;
  }
  if (limpa.length > MOTIVACAO_MAX_LENGTH) {
    throw new DomainError(`A motivação não pode ter mais que ${MOTIVACAO_MAX_LENGTH} caracteres`);
  }
  return limpa;
}

/**
 * Aggregate root do contexto de Hábitos: a intenção que se repete.
 *
 * Invariantes:
 * - nome não vazio e dentro de NOME_MAX_LENGTH
 * - a regra de repetição é sempre uma `Cadencia` válida (nunca meio termo)
 * - hábito arquivado não é editado — arquivar é tirar de circulação, e
 *   um arquivado que muda de regra reescreveria o significado do que já
 *   foi registrado sob ele
 *
 * O que aconteceu em cada dia **não** vive aqui dentro: é
 * `RegistroDeHabito`, aggregate próprio, pela mesma razão que `Envio`
 * não vive dentro de `Lembrete` — um hábito diário produz 365 registros
 * por ano, e carregar todos para ler o nome do hábito seria uma
 * regressão garantida de performance com o tempo.
 *
 * `motivacao` é o porquê, escrito uma vez e lido no momento de fraqueza.
 * É o campo que a tela mostra ao lado do registro de quebra — a única
 * coisa que um app de hábitos pode oferecer quando a força de vontade
 * acabou.
 */
export class Habito {
  private constructor(
    private readonly id: HabitoId,
    private nome: string,
    private motivacao: string | null,
    private cadencia: Cadencia,
    private arquivado: boolean,
    private readonly criadoEm: Date,
    private atualizadoEm: Date,
  ) {}

  static criar(
    nome: string,
    cadencia: Cadencia,
    motivacao: string | null = null,
    agora: Date = new Date(),
  ): Habito {
    return new Habito(
      HabitoId.novo(),
      validarNome(nome),
      validarMotivacao(motivacao),
      cadencia,
      false,
      agora,
      agora,
    );
  }

  static restaurar(props: HabitoPropsRestauracao): Habito {
    return new Habito(
      props.id,
      props.nome,
      props.motivacao,
      props.cadencia,
      props.arquivado,
      props.criadoEm,
      props.atualizadoEm,
    );
  }

  /**
   * Troca nome, regra e motivação.
   *
   * Mudar a cadência vale daqui para a frente e **não** reescreve o
   * passado: os registros já feitos continuam como foram. A consequência
   * é deliberada — passar de "todo dia" para "3x por semana" muda o que
   * será cobrado amanhã, não o que foi cobrado ontem.
   */
  editar(nome: string, cadencia: Cadencia, motivacao: string | null, agora: Date = new Date()): void {
    this.exigirAtivo();
    this.nome = validarNome(nome);
    this.cadencia = cadencia;
    this.motivacao = validarMotivacao(motivacao);
    this.atualizadoEm = agora;
  }

  /**
   * Tira de circulação sem apagar: os registros continuam apontando para
   * ele e o histórico não pode perder o nome do que foi feito. Mesma
   * regra de `CategoriaDeCusto`.
   */
  arquivar(agora: Date = new Date()): void {
    if (this.arquivado) return;
    this.arquivado = true;
    this.atualizadoEm = agora;
  }

  reativar(agora: Date = new Date()): void {
    if (!this.arquivado) return;
    this.arquivado = false;
    this.atualizadoEm = agora;
  }

  /** Este dia é cobrado pela regra? Meta flexível responde `false` — ver `Cadencia.exigeDia`. */
  exigeDia(dia: DiaCivil): boolean {
    return this.cadencia.exigeDia(dia);
  }

  private exigirAtivo(): void {
    if (this.arquivado) {
      throw new HabitoArquivadoError(this.nome);
    }
  }

  getId(): HabitoId {
    return this.id;
  }

  getNome(): string {
    return this.nome;
  }

  getMotivacao(): string | null {
    return this.motivacao;
  }

  getCadencia(): Cadencia {
    return this.cadencia;
  }

  estaArquivado(): boolean {
    return this.arquivado;
  }

  getCriadoEm(): Date {
    return new Date(this.criadoEm.getTime());
  }

  getAtualizadoEm(): Date {
    return new Date(this.atualizadoEm.getTime());
  }
}
