import type { ModoDeCusto, ResultadoFinanceiro } from "@advice/domain";

/**
 * DTOs do contexto de Operação.
 *
 * Datas saem como **string ISO 8601**, não `Date`. A razão é concreta:
 * estas leituras atravessam a fronteira Server Component → Client
 * Component do Next, onde um `Date` exige serialização manual em cada
 * página (foi o que aconteceu com `LembreteResumo`). A string ISO é o
 * formato canônico de data na fronteira e atravessa sem cerimônia.
 */

export interface CustoDto {
  categoriaId: string;
  categoriaNome: string;
  modo: ModoDeCusto;
  /** Centavos, ou pontos-base quando `modo` é percentual. */
  valor: number;
}

export interface CompraDto {
  id: string;
  descricao: string;
  quantidade: number;
  custoUnitarioCentavos: number;
  precoVendaUnitarioCentavos: number;
  compradoEm: string;
  observacao: string | null;
  custos: CustoDto[];
  resultado: ResultadoFinanceiro;
}

export interface ServicoDto {
  id: string;
  descricao: string;
  cliente: string | null;
  valorRecebidoCentavos: number;
  recebidoEm: string;
  observacao: string | null;
  custos: CustoDto[];
  resultado: ResultadoFinanceiro;
}

export interface CategoriaDeCustoDto {
  id: string;
  nome: string;
  modoPadrao: ModoDeCusto;
  valorPadrao: number | null;
  arquivada: boolean;
}

/** Uma linha de custo como chega dos formulários e da API. */
export interface CustoEntrada {
  categoriaId: string;
  modo: ModoDeCusto;
  valor: number;
}
