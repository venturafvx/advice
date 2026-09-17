import { Frequencia, Recorrencia, TIMEZONE_PADRAO } from "@advice/domain";
import type { RecorrenciaProps } from "@advice/domain";

/** 0 = domingo. Três letras: cabe no chip e não é ambíguo como "S" e "Q". */
export const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

const DIAS_PLURAL = ["domingos", "segundas", "terças", "quartas", "quintas", "sextas", "sábados"] as const;
const DIAS_SINGULAR = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"] as const;
/** "Todo domingo", mas "Toda segunda" — os únicos masculinos são as pontas da semana. */
const MASCULINOS = new Set([0, 6]);

export function formatarHoraMinuto(hora: number, minuto: number): string {
  return `${`${hora}`.padStart(2, "0")}:${`${minuto}`.padStart(2, "0")}`;
}

function juntar(partes: readonly string[]): string {
  if (partes.length <= 1) return partes[0] ?? "";
  return `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}

/**
 * "Toda segunda", "De segunda a sexta", "Terças e quintas".
 *
 * Exportada porque os Hábitos dizem exatamente a mesma coisa sobre os
 * mesmos sete dias. Uma segunda implementação em `lib/cadencia.ts` seria
 * duas listas de dias da semana para manter em português — e um dia uma
 * delas diria "Toda sábado".
 */
export function descreverDiasDaSemana(dias: readonly number[]): string {
  if (dias.length === 7) return "Todo dia";
  if (dias.length === 5 && dias.every((d) => d >= 1 && d <= 5)) return "De segunda a sexta";
  if (dias.length === 1) {
    const dia = dias[0] as number;
    return `${MASCULINOS.has(dia) ? "Todo" : "Toda"} ${DIAS_SINGULAR[dia]}`;
  }
  return juntar(dias.map((dia) => DIAS_PLURAL[dia] as string)).replace(/^./, (c) => c.toUpperCase());
}

/** A regra em uma linha de português — o que o fundador lê na lista. */
export function descreverRecorrencia(recorrencia: RecorrenciaProps): string {
  const horario = `às ${formatarHoraMinuto(recorrencia.hora, recorrencia.minuto)}`;

  switch (recorrencia.frequencia) {
    case Frequencia.DIARIA:
      return `Todo dia ${horario}`;
    case Frequencia.SEMANAL:
      return `${descreverDiasDaSemana(recorrencia.diasDaSemana)} ${horario}`;
    case Frequencia.MENSAL:
      return `Todo dia ${recorrencia.diaDoMes} do mês ${horario}`;
  }
}

/**
 * Quando a regra dispara pela primeira vez, calculado **no navegador**
 * pelo mesmo value object que o servidor usa. Não é uma estimativa
 * bonitinha: é a mesma conta, então não existe o dia em que a prévia e
 * o agendamento discordam.
 *
 * Devolve `null` enquanto a regra ainda está incompleta (nenhum dia da
 * semana marcado, por exemplo) — estado normal de um formulário a meio
 * caminho, não erro para mostrar.
 */
export function proximaOcorrenciaPrevista(props: RecorrenciaProps, agora: Date = new Date()): Date | null {
  try {
    return Recorrencia.de(props).proximaOcorrencia(agora, TIMEZONE_PADRAO);
  } catch {
    return null;
  }
}
