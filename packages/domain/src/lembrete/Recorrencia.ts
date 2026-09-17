import { DomainError } from "../erros/DomainError";
import { diaDaSemanaDe, instanteDe, partesEmTimezone, somarDias, somarMeses, ultimoDiaDoMes } from "./tempo";

export const Frequencia = {
  DIARIA: "DIARIA",
  SEMANAL: "SEMANAL",
  MENSAL: "MENSAL",
} as const;

export type Frequencia = (typeof Frequencia)[keyof typeof Frequencia];

export const FREQUENCIAS: readonly Frequencia[] = [Frequencia.DIARIA, Frequencia.SEMANAL, Frequencia.MENSAL];

export function ehFrequencia(valor: unknown): valor is Frequencia {
  return typeof valor === "string" && (FREQUENCIAS as readonly string[]).includes(valor);
}

/** Forma serializável da regra — o que atravessa banco, API e formulário. */
export interface RecorrenciaProps {
  frequencia: Frequencia;
  hora: number;
  minuto: number;
  /** 0 = domingo … 6 = sábado. Vazio quando a frequência não é SEMANAL. */
  diasDaSemana: readonly number[];
  /** 1–31. `null` quando a frequência não é MENSAL. */
  diaDoMes: number | null;
}

/** Quantos candidatos olhar antes de desistir — 8 dias cobre qualquer semana. */
const LIMITE_DIAS = 8;
/** Dois meses bastam: o dia do mês sempre existe depois do ajuste de fim de mês. */
const LIMITE_MESES = 2;

function exigirInteiroNoIntervalo(valor: number, minimo: number, maximo: number, nome: string): number {
  if (!Number.isInteger(valor) || valor < minimo || valor > maximo) {
    throw new DomainError(`${nome} deve ser um número inteiro entre ${minimo} e ${maximo}`);
  }
  return valor;
}

/**
 * Value object: a regra que diz *quando* um lembrete se repete.
 *
 * Guarda relógio de parede (hora/minuto) e não intervalo, porque é isso
 * que o fundador pediu — "todo dia às 07:00" continua às 07:00 mesmo se
 * o offset do timezone mudar. A conversão para instante absoluto é
 * responsabilidade de `proximaOcorrencia`, e só ela.
 *
 * Imutável: mudar a regra é criar outra.
 */
export class Recorrencia {
  private constructor(
    private readonly frequencia: Frequencia,
    private readonly hora: number,
    private readonly minuto: number,
    private readonly diasDaSemana: readonly number[],
    private readonly diaDoMes: number | null,
  ) {}

  static diaria(hora: number, minuto: number): Recorrencia {
    return Recorrencia.de({ frequencia: Frequencia.DIARIA, hora, minuto, diasDaSemana: [], diaDoMes: null });
  }

  static semanal(diasDaSemana: readonly number[], hora: number, minuto: number): Recorrencia {
    return Recorrencia.de({ frequencia: Frequencia.SEMANAL, hora, minuto, diasDaSemana, diaDoMes: null });
  }

  static mensal(diaDoMes: number, hora: number, minuto: number): Recorrencia {
    return Recorrencia.de({ frequencia: Frequencia.MENSAL, hora, minuto, diasDaSemana: [], diaDoMes });
  }

  /**
   * Fronteira única de validação: tudo que vem de fora (formulário, API,
   * banco) entra por aqui. Não existe caminho para uma Recorrencia
   * inconsistente existir em memória.
   */
  static de(props: RecorrenciaProps): Recorrencia {
    if (!ehFrequencia(props.frequencia)) {
      throw new DomainError("Frequência de recorrência inválida");
    }

    const hora = exigirInteiroNoIntervalo(props.hora, 0, 23, "A hora");
    const minuto = exigirInteiroNoIntervalo(props.minuto, 0, 59, "O minuto");

    if (props.frequencia === Frequencia.SEMANAL) {
      const dias = [...new Set(props.diasDaSemana ?? [])].sort((a, b) => a - b);
      if (dias.length === 0) {
        throw new DomainError("Escolha pelo menos um dia da semana");
      }
      dias.forEach((dia) => exigirInteiroNoIntervalo(dia, 0, 6, "O dia da semana"));
      return new Recorrencia(props.frequencia, hora, minuto, dias, null);
    }

    if (props.frequencia === Frequencia.MENSAL) {
      const dia = exigirInteiroNoIntervalo(props.diaDoMes ?? Number.NaN, 1, 31, "O dia do mês");
      return new Recorrencia(props.frequencia, hora, minuto, [], dia);
    }

    return new Recorrencia(props.frequencia, hora, minuto, [], null);
  }

  /**
   * O primeiro instante que satisfaz a regra e é **estritamente** depois
   * de `depoisDe`.
   *
   * Partir sempre de "agora" (e não do agendamento anterior + 1 período)
   * é o que evita a enxurrada de disparos atrasados: se o worker ficou
   * três dias fora do ar, o lembrete diário dispara uma vez e a próxima
   * ocorrência é amanhã — não três avisos seguidos de dias que passaram.
   */
  proximaOcorrencia(depoisDe: Date, timezone: string): Date {
    const base = partesEmTimezone(depoisDe, timezone);
    const limite = this.frequencia === Frequencia.MENSAL ? LIMITE_MESES : LIMITE_DIAS;

    for (let passo = 0; passo <= limite; passo++) {
      const candidato = this.candidato(base, passo, timezone);
      if (candidato && candidato.getTime() > depoisDe.getTime()) {
        return candidato;
      }
    }

    // Inalcançável: DIARIA resolve em ≤1 passo, SEMANAL em ≤7, MENSAL em ≤1.
    throw new DomainError("Não foi possível calcular a próxima ocorrência da recorrência");
  }

  private candidato(base: { ano: number; mes: number; dia: number }, passo: number, timezone: string): Date | null {
    if (this.frequencia === Frequencia.MENSAL) {
      const { ano, mes } = somarMeses(base, passo);
      // Dia 31 num mês de 30 cai no último dia: a intenção "todo fim de
      // mês" é preservada em vez de o lembrete sumir em fevereiro.
      const dia = Math.min(this.diaDoMes ?? 1, ultimoDiaDoMes(ano, mes));
      return instanteDe({ ano, mes, dia, hora: this.hora, minuto: this.minuto }, timezone);
    }

    const data = somarDias(base, passo);

    if (this.frequencia === Frequencia.SEMANAL) {
      const diaDaSemana = diaDaSemanaDe(data.ano, data.mes, data.dia);
      if (!this.diasDaSemana.includes(diaDaSemana)) return null;
    }

    return instanteDe({ ...data, hora: this.hora, minuto: this.minuto }, timezone);
  }

  paraProps(): RecorrenciaProps {
    return {
      frequencia: this.frequencia,
      hora: this.hora,
      minuto: this.minuto,
      diasDaSemana: [...this.diasDaSemana],
      diaDoMes: this.diaDoMes,
    };
  }

  getFrequencia(): Frequencia {
    return this.frequencia;
  }

  getHora(): number {
    return this.hora;
  }

  getMinuto(): number {
    return this.minuto;
  }

  getDiasDaSemana(): readonly number[] {
    return this.diasDaSemana;
  }

  getDiaDoMes(): number | null {
    return this.diaDoMes;
  }

  igual(outra: Recorrencia): boolean {
    return (
      this.frequencia === outra.frequencia &&
      this.hora === outra.hora &&
      this.minuto === outra.minuto &&
      this.diaDoMes === outra.diaDoMes &&
      this.diasDaSemana.length === outra.diasDaSemana.length &&
      this.diasDaSemana.every((dia, i) => dia === outra.diasDaSemana[i])
    );
  }
}
