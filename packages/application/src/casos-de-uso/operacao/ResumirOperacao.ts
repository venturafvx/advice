import type { CompraRepository, FiltroPeriodo, ServicoRepository } from "@advice/domain";
import type { CompraDto, ServicoDto } from "./dtos";
import { compraParaDto, servicoParaDto } from "./mapeadores";

export interface LinhaDeResumo {
  operacoes: number;
  receitaBrutaCentavos: number;
  custoMercadoriaCentavos: number;
  custosOperacionaisCentavos: number;
  custoTotalCentavos: number;
  lucroLiquidoCentavos: number;
  margemLiquida: number | null;
}

export interface CustoPorCategoria {
  rotulo: string;
  totalCentavos: number;
  fatiaDosCustos: number;
}

export interface ResumoDaOperacao {
  /**
   * Mercadoria: receita **projetada**. O preço de venda de uma compra é
   * uma intenção, não um extrato — somá-la com a receita de serviço sem
   * dizer isso seria mentir num painel financeiro.
   */
  mercadoria: LinhaDeResumo;
  /** Serviços: receita **realizada** — o dinheiro já entrou. */
  servicos: LinhaDeResumo;
  /** Soma dos dois. Projeção consolidada, não caixa. */
  consolidado: LinhaDeResumo;
  custosPorCategoria: CustoPorCategoria[];
  unidadesEmEstoque: number;
  /** Dinheiro efetivamente desembolsado nas compras (CMV + custos). */
  capitalEmMercadoriaCentavos: number;
  compras: CompraDto[];
  servicosRegistrados: ServicoDto[];
}

export interface ResumirOperacaoDeps {
  compraRepository: CompraRepository;
  servicoRepository: ServicoRepository;
}

const LINHA_ZERADA: LinhaDeResumo = {
  operacoes: 0,
  receitaBrutaCentavos: 0,
  custoMercadoriaCentavos: 0,
  custosOperacionaisCentavos: 0,
  custoTotalCentavos: 0,
  lucroLiquidoCentavos: 0,
  margemLiquida: null,
};

function somar(linha: LinhaDeResumo, outra: LinhaDeResumo): LinhaDeResumo {
  const receitaBrutaCentavos = linha.receitaBrutaCentavos + outra.receitaBrutaCentavos;
  const lucroLiquidoCentavos = linha.lucroLiquidoCentavos + outra.lucroLiquidoCentavos;

  return {
    operacoes: linha.operacoes + outra.operacoes,
    receitaBrutaCentavos,
    custoMercadoriaCentavos: linha.custoMercadoriaCentavos + outra.custoMercadoriaCentavos,
    custosOperacionaisCentavos: linha.custosOperacionaisCentavos + outra.custosOperacionaisCentavos,
    custoTotalCentavos: linha.custoTotalCentavos + outra.custoTotalCentavos,
    lucroLiquidoCentavos,
    // Margem consolidada é lucro somado ÷ receita somada — nunca a média
    // das margens, que daria peso igual a uma operação de R$ 50 e a uma
    // de R$ 5.000.
    margemLiquida: receitaBrutaCentavos > 0 ? lucroLiquidoCentavos / receitaBrutaCentavos : null,
  };
}

/**
 * Lê tudo em memória e agrega em JS, de propósito: o volume desta
 * operação é de dezenas a poucos milhares de linhas, e o cálculo de
 * margem vive no domínio (`calcularResultado`). Reimplementá-lo em SQL
 * criaria uma segunda fonte da verdade para o número mais importante do
 * produto — a hora de mover a agregação para o banco é quando o volume
 * doer, não antes.
 */
export async function resumirOperacao(
  deps: ResumirOperacaoDeps,
  filtro?: FiltroPeriodo,
): Promise<ResumoDaOperacao> {
  const [comprasRaw, servicosRaw] = await Promise.all([
    deps.compraRepository.listar(filtro),
    deps.servicoRepository.listar(filtro),
  ]);

  const compras = comprasRaw.map(compraParaDto);
  const servicosRegistrados = servicosRaw.map(servicoParaDto);

  const custosPorRotulo = new Map<string, number>();
  const acumular = (rotulo: string, centavos: number): void => {
    custosPorRotulo.set(rotulo, (custosPorRotulo.get(rotulo) ?? 0) + centavos);
  };

  let mercadoria = { ...LINHA_ZERADA };
  let unidadesEmEstoque = 0;

  for (const compra of compras) {
    const r = compra.resultado;
    mercadoria = somar(mercadoria, {
      ...LINHA_ZERADA,
      operacoes: 1,
      receitaBrutaCentavos: r.receitaBrutaCentavos,
      custoMercadoriaCentavos: r.custoMercadoriaCentavos,
      custosOperacionaisCentavos: r.custosOperacionaisCentavos,
      custoTotalCentavos: r.custoTotalCentavos,
      lucroLiquidoCentavos: r.lucroLiquidoCentavos,
    });
    unidadesEmEstoque += compra.quantidade;
    r.custosDetalhados.forEach((c) => acumular(c.rotulo, c.totalCentavos));
  }

  let servicos = { ...LINHA_ZERADA };
  for (const servico of servicosRegistrados) {
    const r = servico.resultado;
    servicos = somar(servicos, {
      ...LINHA_ZERADA,
      operacoes: 1,
      receitaBrutaCentavos: r.receitaBrutaCentavos,
      custoMercadoriaCentavos: r.custoMercadoriaCentavos,
      custosOperacionaisCentavos: r.custosOperacionaisCentavos,
      custoTotalCentavos: r.custoTotalCentavos,
      lucroLiquidoCentavos: r.lucroLiquidoCentavos,
    });
    r.custosDetalhados.forEach((c) => acumular(c.rotulo, c.totalCentavos));
  }

  const totalDeCustos = [...custosPorRotulo.values()].reduce((soma, valor) => soma + valor, 0);
  const custosPorCategoria: CustoPorCategoria[] = [...custosPorRotulo.entries()]
    .map(([rotulo, totalCentavos]) => ({
      rotulo,
      totalCentavos,
      fatiaDosCustos: totalDeCustos > 0 ? totalCentavos / totalDeCustos : 0,
    }))
    .sort((a, b) => b.totalCentavos - a.totalCentavos);

  return {
    mercadoria,
    servicos,
    consolidado: somar(mercadoria, servicos),
    custosPorCategoria,
    unidadesEmEstoque,
    capitalEmMercadoriaCentavos: mercadoria.custoTotalCentavos,
    compras,
    servicosRegistrados,
  };
}
