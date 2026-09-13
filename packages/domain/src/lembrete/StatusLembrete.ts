export const StatusLembrete = {
  PENDENTE: "PENDENTE",
  ENVIADO: "ENVIADO",
  FALHOU: "FALHOU",
  CANCELADO: "CANCELADO",
} as const;

export type StatusLembrete = (typeof StatusLembrete)[keyof typeof StatusLembrete];

const STATUS_TERMINAIS: ReadonlySet<StatusLembrete> = new Set([
  StatusLembrete.ENVIADO,
  StatusLembrete.FALHOU,
  StatusLembrete.CANCELADO,
]);

export function eStatusTerminal(status: StatusLembrete): boolean {
  return STATUS_TERMINAIS.has(status);
}
