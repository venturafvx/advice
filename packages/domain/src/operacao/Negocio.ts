/**
 * A qual negócio uma operação pertence.
 *
 * O fundador toca duas operações distintas, com economias distintas, e
 * somá-las num painel só produz um número que não descreve nenhuma das
 * duas: o papel de parede vende poucas unidades caras com mão de obra
 * junto, o marketplace vende muitas unidades baratas com taxa
 * percentual da plataforma. Margem média entre as duas não é a margem
 * de nada.
 *
 * Por isso o negócio é uma **dimensão do dado**, não duas instalações
 * do app nem duas tabelas: as regras de cálculo, as categorias de custo
 * e o vocabulário são os mesmos — o que muda é o recorte. Um dado sem
 * negócio é um dado que não sabe de quem é, então a coluna é NOT NULL
 * e o aggregate rejeita valor desconhecido.
 */
export const Negocio = {
  /** Papel de parede: venda do material e o serviço de aplicação. */
  FABIOJUNIORDECOR: "FABIOJUNIORDECOR",
  /** Compra e revenda de produtos em marketplace. */
  VENTURAX: "VENTURAX",
} as const;

export type Negocio = (typeof Negocio)[keyof typeof Negocio];

export const NEGOCIOS: readonly Negocio[] = [Negocio.FABIOJUNIORDECOR, Negocio.VENTURAX];

export function ehNegocio(valor: string): valor is Negocio {
  return (NEGOCIOS as readonly string[]).includes(valor);
}
