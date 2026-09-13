export const StatusEnvio = {
  SUCESSO: "SUCESSO",
  FALHA: "FALHA",
} as const;

export type StatusEnvio = (typeof StatusEnvio)[keyof typeof StatusEnvio];
