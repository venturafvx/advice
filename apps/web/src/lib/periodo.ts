import type { FiltroPeriodo } from "@advice/domain";

export type ChaveDePeriodo = "mes" | "noventa" | "ano" | "tudo";

export const PERIODOS: { chave: ChaveDePeriodo; rotulo: string }[] = [
  { chave: "mes", rotulo: "Este mês" },
  { chave: "noventa", rotulo: "90 dias" },
  { chave: "ano", rotulo: "Este ano" },
  { chave: "tudo", rotulo: "Tudo" },
];

export function lerChaveDePeriodo(valor: string | undefined): ChaveDePeriodo {
  return PERIODOS.some((p) => p.chave === valor) ? (valor as ChaveDePeriodo) : "mes";
}

/**
 * Converte o recorte escolhido em instantes absolutos, sempre no fuso
 * do processo (`TZ=America/Sao_Paulo` nos containers). Os limites são
 * início do dia e fim do dia — filtrar "até hoje" precisa incluir o
 * que aconteceu hoje de manhã.
 */
export function resolverPeriodo(chave: ChaveDePeriodo, agora: Date = new Date()): FiltroPeriodo | undefined {
  const fimDoDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999);

  switch (chave) {
    case "mes":
      return { de: new Date(agora.getFullYear(), agora.getMonth(), 1), ate: fimDoDia };
    case "noventa": {
      const de = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 89);
      return { de, ate: fimDoDia };
    }
    case "ano":
      return { de: new Date(agora.getFullYear(), 0, 1), ate: fimDoDia };
    case "tudo":
      return undefined;
  }
}
