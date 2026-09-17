/**
 * O que foi declarado sobre um dia.
 *
 * Só há dois valores porque só há dois atos: cumpri, ou quebrei. **Não
 * existe "pulado"** — a ausência de registro já diz isso, e inventar um
 * terceiro estado obrigaria a distinguir "pulei de propósito" de "não
 * abri o app", que ninguém sabe responder depois.
 */
export const SituacaoDoDia = {
  FEITO: "FEITO",
  QUEBRADO: "QUEBRADO",
} as const;

export type SituacaoDoDia = (typeof SituacaoDoDia)[keyof typeof SituacaoDoDia];

export const SITUACOES_DO_DIA: readonly SituacaoDoDia[] = [SituacaoDoDia.FEITO, SituacaoDoDia.QUEBRADO];

export function ehSituacaoDoDia(valor: unknown): valor is SituacaoDoDia {
  return typeof valor === "string" && (SITUACOES_DO_DIA as readonly string[]).includes(valor);
}
