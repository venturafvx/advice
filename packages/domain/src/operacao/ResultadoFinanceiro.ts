import { ModoDeCusto } from "./ModoDeCusto";
import { PONTOS_BASE_EM_CEM_PORCENTO } from "./Percentual";

/**
 * Entrada e saída deste módulo são **dados planos** (números), não value
 * objects, de propósito:
 *
 * 1. A mesma função roda no servidor (para persistir/listar) e no
 *    browser (simulador ao vivo do formulário). Um resultado de classe
 *    não atravessa a fronteira RSC → client sem serialização manual.
 * 2. Lucro pode ser negativo, e `Dinheiro` — corretamente — não aceita
 *    negativo. Aqui o domínio é "centavos com sinal".
 *
 * Os value objects (`Dinheiro`, `Percentual`) continuam guardando a
 * fronteira de escrita nos aggregates; este módulo é o cálculo puro
 * sobre números já validados.
 */

export interface EntradaDeCusto {
  /** Rótulo exibido no detalhamento — normalmente o nome da categoria. */
  readonly rotulo: string;
  readonly modo: ModoDeCusto;
  /** Centavos, ou pontos-base quando `modo` é percentual. */
  readonly valor: number;
}

export interface EntradaDeCalculo {
  readonly quantidade: number;
  readonly custoUnitarioCentavos: number;
  readonly precoVendaUnitarioCentavos: number;
  readonly custos: readonly EntradaDeCusto[];
}

export interface CustoCalculado {
  readonly rotulo: string;
  readonly modo: ModoDeCusto;
  readonly valor: number;
  /** Quanto essa linha custa de fato, já resolvido o modo. */
  readonly totalCentavos: number;
  /** Fração (0–1) da receita bruta que essa linha consome. */
  readonly fatiaDaReceita: number | null;
}

export interface ResultadoFinanceiro {
  /** Preço de venda × quantidade. */
  readonly receitaBrutaCentavos: number;
  /** CMV — o que a mercadoria custou (custo unitário × quantidade). */
  readonly custoMercadoriaCentavos: number;
  /** Receita − CMV. Ignora custos de operação, por definição. */
  readonly lucroBrutoCentavos: number;
  /** Lucro bruto ÷ receita. `null` quando não há receita. */
  readonly margemBruta: number | null;
  /** Soma de frete, etiquetagem, taxas — tudo que não é a mercadoria. */
  readonly custosOperacionaisCentavos: number;
  readonly custosDetalhados: readonly CustoCalculado[];
  /** CMV + custos operacionais: o desembolso total da operação. */
  readonly custoTotalCentavos: number;
  /** Receita − custo total. Pode ser negativo. */
  readonly lucroLiquidoCentavos: number;
  /** Lucro líquido ÷ receita. O número que responde "vale a pena?". */
  readonly margemLiquida: number | null;
  /** Lucro líquido ÷ custo total — retorno sobre o que foi investido. */
  readonly retornoSobreCusto: number | null;
  readonly lucroPorUnidadeCentavos: number;
  /**
   * Menor preço unitário que ainda fecha no zero a zero. `null` quando
   * os custos percentuais somam 100% ou mais — aí nenhum preço fecha.
   */
  readonly precoMinimoUnitarioCentavos: number | null;
  /**
   * Quantas unidades precisam ser vendidas, ao preço informado, para
   * cobrir os custos fixos do lote. `null` quando cada unidade dá
   * prejuízo — nesse caso vender mais só aumenta o rombo.
   */
  readonly unidadesParaEmpatar: number | null;
}

function fracaoDaReceita(valorCentavos: number, receitaCentavos: number): number | null {
  return receitaCentavos > 0 ? valorCentavos / receitaCentavos : null;
}

export function calcularResultado(entrada: EntradaDeCalculo): ResultadoFinanceiro {
  const quantidade = Math.max(1, Math.trunc(entrada.quantidade));
  const custoUnitario = Math.max(0, Math.trunc(entrada.custoUnitarioCentavos));
  const precoVenda = Math.max(0, Math.trunc(entrada.precoVendaUnitarioCentavos));

  const receitaBrutaCentavos = precoVenda * quantidade;
  const custoMercadoriaCentavos = custoUnitario * quantidade;
  const lucroBrutoCentavos = receitaBrutaCentavos - custoMercadoriaCentavos;

  // Os três acumuladores separados existem para o ponto de equilíbrio:
  // custo fixo, custo que escala com a quantidade e custo que escala com
  // o preço entram na equação de formas diferentes.
  let fixosCentavos = 0;
  let porUnidadeCentavos = 0;
  let fracaoPercentual = 0;

  const custosDetalhados: CustoCalculado[] = entrada.custos.map((custo) => {
    const valor = Math.max(0, Math.trunc(custo.valor));
    let totalCentavos: number;

    switch (custo.modo) {
      case ModoDeCusto.VALOR_FIXO:
        totalCentavos = valor;
        fixosCentavos += valor;
        break;
      case ModoDeCusto.POR_UNIDADE:
        totalCentavos = valor * quantidade;
        porUnidadeCentavos += valor;
        break;
      case ModoDeCusto.PERCENTUAL_DA_VENDA: {
        const fracao = Math.min(valor, PONTOS_BASE_EM_CEM_PORCENTO) / PONTOS_BASE_EM_CEM_PORCENTO;
        totalCentavos = Math.round(receitaBrutaCentavos * fracao);
        fracaoPercentual += fracao;
        break;
      }
    }

    return {
      rotulo: custo.rotulo,
      modo: custo.modo,
      valor,
      totalCentavos,
      fatiaDaReceita: fracaoDaReceita(totalCentavos, receitaBrutaCentavos),
    };
  });

  const custosOperacionaisCentavos = custosDetalhados.reduce((soma, c) => soma + c.totalCentavos, 0);
  const custoTotalCentavos = custoMercadoriaCentavos + custosOperacionaisCentavos;
  const lucroLiquidoCentavos = receitaBrutaCentavos - custoTotalCentavos;

  // Preço mínimo: resolve p em  p·q·(1 − %) = CMV + fixos + porUnidade·q.
  // `ceil` porque arredondar para baixo devolveria um preço que fecha
  // um centavo no vermelho — e o número existe justamente para ser o
  // piso seguro.
  const precoMinimoUnitarioCentavos =
    fracaoPercentual >= 1
      ? null
      : Math.ceil(
          (custoMercadoriaCentavos + fixosCentavos + porUnidadeCentavos * quantidade) /
            (quantidade * (1 - fracaoPercentual)),
        );

  // Ponto de equilíbrio em unidades: cada unidade contribui com
  // preço − taxas percentuais − custo da mercadoria − custos por
  // unidade. Os custos fixos do lote são cobertos por essa contribuição.
  const contribuicaoUnitaria = precoVenda * (1 - fracaoPercentual) - custoUnitario - porUnidadeCentavos;
  const unidadesParaEmpatar =
    contribuicaoUnitaria > 0 ? Math.max(1, Math.ceil(fixosCentavos / contribuicaoUnitaria)) : null;

  return {
    receitaBrutaCentavos,
    custoMercadoriaCentavos,
    lucroBrutoCentavos,
    margemBruta: fracaoDaReceita(lucroBrutoCentavos, receitaBrutaCentavos),
    custosOperacionaisCentavos,
    custosDetalhados,
    custoTotalCentavos,
    lucroLiquidoCentavos,
    margemLiquida: fracaoDaReceita(lucroLiquidoCentavos, receitaBrutaCentavos),
    retornoSobreCusto: custoTotalCentavos > 0 ? lucroLiquidoCentavos / custoTotalCentavos : null,
    lucroPorUnidadeCentavos: Math.round(lucroLiquidoCentavos / quantidade),
    precoMinimoUnitarioCentavos,
    unidadesParaEmpatar,
  };
}
