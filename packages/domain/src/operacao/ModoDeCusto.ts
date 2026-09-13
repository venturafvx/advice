/**
 * Como um custo incide sobre a operação. É a decisão de modelagem mais
 * importante deste contexto: um custo de R$ 40 de frete, R$ 0,80 de
 * etiqueta por peça e 15% de taxa da Amazon são três matemáticas
 * diferentes. Tratar os três como "um valor" daria uma margem errada —
 * que é exatamente o número pelo qual o produto existe.
 */
export const ModoDeCusto = {
  /** Incide uma vez sobre o lote inteiro (ex: frete da carga). */
  VALOR_FIXO: "VALOR_FIXO",
  /** Multiplica pela quantidade (ex: etiquetagem por peça). */
  POR_UNIDADE: "POR_UNIDADE",
  /** Percentual da receita bruta (ex: comissão da Amazon, imposto). */
  PERCENTUAL_DA_VENDA: "PERCENTUAL_DA_VENDA",
} as const;

export type ModoDeCusto = (typeof ModoDeCusto)[keyof typeof ModoDeCusto];

export const MODOS_DE_CUSTO: readonly ModoDeCusto[] = [
  ModoDeCusto.VALOR_FIXO,
  ModoDeCusto.POR_UNIDADE,
  ModoDeCusto.PERCENTUAL_DA_VENDA,
];

export function ehModoDeCusto(valor: string): valor is ModoDeCusto {
  return (MODOS_DE_CUSTO as readonly string[]).includes(valor);
}

/** `true` quando o valor guardado são pontos-base, não centavos. */
export function ehModoPercentual(modo: ModoDeCusto): boolean {
  return modo === ModoDeCusto.PERCENTUAL_DA_VENDA;
}
