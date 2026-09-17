import type { LembreteId } from "./LembreteId";

export type LembreteEvento =
  | { tipo: "LembreteCriado"; lembreteId: LembreteId; ocorridoEm: Date }
  | { tipo: "LembreteEditado"; lembreteId: LembreteId; ocorridoEm: Date }
  | { tipo: "LembreteCancelado"; lembreteId: LembreteId; ocorridoEm: Date }
  | { tipo: "LembreteEnviado"; lembreteId: LembreteId; ocorridoEm: Date }
  | { tipo: "EnvioDeLembreteFalhou"; lembreteId: LembreteId; motivo: string; ocorridoEm: Date };
