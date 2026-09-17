import { DomainError } from "../erros/DomainError";

/**
 * Aritmética de calendário num timezone IANA, sem dependência externa.
 *
 * Um lembrete recorrente é uma regra de **relógio de parede** ("todo dia
 * às 07:00"), não um intervalo fixo de 24 horas. Somar 86.400.000 ms ao
 * instante anterior erraria a hora na virada de horário de verão — e
 * "às 07:00" viraria "às 06:00" para sempre, silenciosamente. Por isso
 * toda a conta acontece em partes de data/hora no timezone, e só no fim
 * volta a ser instante absoluto.
 *
 * `Intl.DateTimeFormat` é a única fonte de verdade sobre offsets aqui:
 * é o banco IANA que já vem no runtime, atualizado junto com ele. Nada
 * de tabela de offset escrita à mão.
 */

export interface PartesDeTempo {
  ano: number;
  /** 1–12 (não o 0–11 de `Date`, que é uma armadilha de leitura). */
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
}

const FORMATADORES = new Map<string, Intl.DateTimeFormat>();

function formatador(timezone: string): Intl.DateTimeFormat {
  const existente = FORMATADORES.get(timezone);
  if (existente) return existente;

  let novo: Intl.DateTimeFormat;
  try {
    novo = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    throw new DomainError(`Timezone desconhecido: ${timezone}`);
  }

  FORMATADORES.set(timezone, novo);
  return novo;
}

function numero(partes: Intl.DateTimeFormatPart[], tipo: Intl.DateTimeFormatPartTypes): number {
  const valor = partes.find((parte) => parte.type === tipo)?.value;
  return valor === undefined ? Number.NaN : Number(valor);
}

/** Quebra um instante absoluto no relógio de parede do timezone. */
export function partesEmTimezone(instante: Date, timezone: string): PartesDeTempo {
  if (Number.isNaN(instante.getTime())) {
    throw new DomainError("Instante inválido");
  }

  const partes = formatador(timezone).formatToParts(instante);
  return {
    ano: numero(partes, "year"),
    mes: numero(partes, "month"),
    dia: numero(partes, "day"),
    hora: numero(partes, "hour"),
    minuto: numero(partes, "minute"),
    segundo: numero(partes, "second"),
  };
}

/** Offset do timezone (ms) vigente naquele instante — positivo a leste de Greenwich. */
function offsetEm(instante: Date, timezone: string): number {
  const p = partesEmTimezone(instante, timezone);
  return Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo) - instante.getTime();
}

/**
 * Relógio de parede no timezone → instante absoluto.
 *
 * Duas passadas: a primeira usa o offset vigente no palpite em UTC, a
 * segunda corrige o caso em que o próprio palpite caiu do outro lado de
 * uma virada de horário de verão. Numa hora que não existe (o pulo de
 * primavera) o resultado é o instante imediatamente seguinte à virada —
 * o lembrete dispara, que é o comportamento desejado; nunca some.
 */
export function instanteDe(
  partes: { ano: number; mes: number; dia: number; hora: number; minuto: number },
  timezone: string,
): Date {
  const comoSeFosseUtc = Date.UTC(partes.ano, partes.mes - 1, partes.dia, partes.hora, partes.minuto, 0, 0);
  const primeiroPalpite = comoSeFosseUtc - offsetEm(new Date(comoSeFosseUtc), timezone);
  return new Date(comoSeFosseUtc - offsetEm(new Date(primeiroPalpite), timezone));
}

/** 0 = domingo … 6 = sábado, para uma data civil (sem hora, sem timezone). */
export function diaDaSemanaDe(ano: number, mes: number, dia: number): number {
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

/** Data civil deslocada em dias. UTC aqui é exato: não tem horário de verão. */
export function somarDias(
  base: { ano: number; mes: number; dia: number },
  dias: number,
): { ano: number; mes: number; dia: number } {
  const d = new Date(Date.UTC(base.ano, base.mes - 1, base.dia + dias));
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
}

/** Mês civil deslocado em meses (dia ignorado — o chamador decide o dia). */
export function somarMeses(base: { ano: number; mes: number }, meses: number): { ano: number; mes: number } {
  const d = new Date(Date.UTC(base.ano, base.mes - 1 + meses, 1));
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 };
}

export function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}
