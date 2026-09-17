import { DomainError } from "../erros/DomainError";
import type { DiaCivil } from "./DiaCivil";

export const FrequenciaDoHabito = {
  /** Todo dia, sem exceção. */
  DIARIA: "DIARIA",
  /** Em dias fixos da semana — segunda, quarta e sexta. */
  DIAS_DA_SEMANA: "DIAS_DA_SEMANA",
  /** Tantas vezes por semana, em qualquer dia. A meta é da semana, não do dia. */
  VEZES_POR_SEMANA: "VEZES_POR_SEMANA",
} as const;

export type FrequenciaDoHabito = (typeof FrequenciaDoHabito)[keyof typeof FrequenciaDoHabito];

export const FREQUENCIAS_DE_HABITO: readonly FrequenciaDoHabito[] = [
  FrequenciaDoHabito.DIARIA,
  FrequenciaDoHabito.DIAS_DA_SEMANA,
  FrequenciaDoHabito.VEZES_POR_SEMANA,
];

export function ehFrequenciaDeHabito(valor: unknown): valor is FrequenciaDoHabito {
  return typeof valor === "string" && (FREQUENCIAS_DE_HABITO as readonly string[]).includes(valor);
}

/** Forma serializável da regra — o que atravessa banco, API e formulário. */
export interface CadenciaProps {
  frequencia: FrequenciaDoHabito;
  /** 0 = domingo … 6 = sábado. Vazio quando a frequência não é DIAS_DA_SEMANA. */
  diasDaSemana: readonly number[];
  /** 1–7. `null` quando a frequência não é VEZES_POR_SEMANA. */
  vezesPorSemana: number | null;
}

const DIAS_NA_SEMANA = 7;

/**
 * Value object: a regra que diz *quando* um hábito é cobrado.
 *
 * Três formas porque são três perguntas diferentes, e colapsá-las numa
 * só daria a resposta errada: "todo dia" cobra hoje; "segunda, quarta e
 * sexta" cobra hoje se hoje for um desses; "3x por semana" não cobra
 * nenhum dia em particular — cobra a semana. É por isso que `exigeDia`
 * devolve `false` para a terceira: a pergunta "este dia é obrigatório?"
 * simplesmente não se aplica a ela, e responder `true` transformaria uma
 * meta flexível em sete cobranças diárias.
 *
 * Imutável: mudar a regra é criar outra.
 */
export class Cadencia {
  private constructor(
    private readonly frequencia: FrequenciaDoHabito,
    private readonly diasDaSemana: readonly number[],
    private readonly vezesPorSemana: number | null,
  ) {}

  static diaria(): Cadencia {
    return new Cadencia(FrequenciaDoHabito.DIARIA, [], null);
  }

  static nosDias(diasDaSemana: readonly number[]): Cadencia {
    return Cadencia.de({
      frequencia: FrequenciaDoHabito.DIAS_DA_SEMANA,
      diasDaSemana,
      vezesPorSemana: null,
    });
  }

  static vezesNaSemana(vezes: number): Cadencia {
    return Cadencia.de({
      frequencia: FrequenciaDoHabito.VEZES_POR_SEMANA,
      diasDaSemana: [],
      vezesPorSemana: vezes,
    });
  }

  /**
   * Fronteira única de validação: tudo que vem de fora (formulário, API,
   * banco) entra por aqui. Não existe caminho para uma Cadencia
   * inconsistente existir em memória.
   */
  static de(props: CadenciaProps): Cadencia {
    if (!ehFrequenciaDeHabito(props.frequencia)) {
      throw new DomainError("Frequência de hábito inválida");
    }

    if (props.frequencia === FrequenciaDoHabito.DIAS_DA_SEMANA) {
      const dias = [...new Set(props.diasDaSemana ?? [])].sort((a, b) => a - b);
      if (dias.length === 0) {
        throw new DomainError("Escolha pelo menos um dia da semana");
      }
      for (const dia of dias) {
        if (!Number.isInteger(dia) || dia < 0 || dia > 6) {
          throw new DomainError("Dia da semana deve ser um número inteiro entre 0 e 6");
        }
      }
      return new Cadencia(props.frequencia, dias, null);
    }

    if (props.frequencia === FrequenciaDoHabito.VEZES_POR_SEMANA) {
      const vezes = props.vezesPorSemana ?? Number.NaN;
      if (!Number.isInteger(vezes) || vezes < 1 || vezes > DIAS_NA_SEMANA) {
        throw new DomainError("A meta semanal deve ser um número inteiro entre 1 e 7");
      }
      // 7x por semana é "todo dia" com outro nome, e as duas contariam
      // sequência de formas diferentes (semanas x dias). Normalizar aqui
      // é mais honesto que manter duas representações do mesmo hábito.
      if (vezes === DIAS_NA_SEMANA) {
        return Cadencia.diaria();
      }
      return new Cadencia(props.frequencia, [], vezes);
    }

    return new Cadencia(props.frequencia, [], null);
  }

  /**
   * Este dia é obrigatório pela regra?
   *
   * `false` numa meta flexível não significa "pode faltar": significa
   * que a cobrança é da semana. Quem monta a lista de hoje consulta
   * também o que já foi feito na semana (ver `calcularDesempenho`).
   */
  exigeDia(dia: DiaCivil): boolean {
    if (this.frequencia === FrequenciaDoHabito.DIARIA) return true;
    if (this.frequencia === FrequenciaDoHabito.DIAS_DA_SEMANA) {
      return this.diasDaSemana.includes(dia.diaDaSemana());
    }
    return false;
  }

  /** Quantos dias a regra espera numa semana cheia — a meta. */
  metaSemanal(): number {
    if (this.frequencia === FrequenciaDoHabito.DIARIA) return DIAS_NA_SEMANA;
    if (this.frequencia === FrequenciaDoHabito.DIAS_DA_SEMANA) return this.diasDaSemana.length;
    return this.vezesPorSemana ?? 0;
  }

  /** A sequência de um hábito flexível se conta em semanas; a dos outros, em dias. */
  ehFlexivel(): boolean {
    return this.frequencia === FrequenciaDoHabito.VEZES_POR_SEMANA;
  }

  paraProps(): CadenciaProps {
    return {
      frequencia: this.frequencia,
      diasDaSemana: [...this.diasDaSemana],
      vezesPorSemana: this.vezesPorSemana,
    };
  }

  getFrequencia(): FrequenciaDoHabito {
    return this.frequencia;
  }

  getDiasDaSemana(): readonly number[] {
    return this.diasDaSemana;
  }

  getVezesPorSemana(): number | null {
    return this.vezesPorSemana;
  }

  igual(outra: Cadencia): boolean {
    return (
      this.frequencia === outra.frequencia &&
      this.vezesPorSemana === outra.vezesPorSemana &&
      this.diasDaSemana.length === outra.diasDaSemana.length &&
      this.diasDaSemana.every((dia, i) => dia === outra.diasDaSemana[i])
    );
  }
}
