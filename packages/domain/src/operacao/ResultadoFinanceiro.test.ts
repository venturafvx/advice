import { describe, expect, it } from "vitest";
import { ModoDeCusto } from "./ModoDeCusto";
import { calcularResultado, type EntradaDeCusto } from "./ResultadoFinanceiro";

/**
 * Caso de referência, em reais, conferido na mão:
 *
 *   10 peças compradas a R$ 20,00     → CMV      R$ 200,00
 *   vendidas a R$ 50,00               → receita  R$ 500,00
 *   frete fixo                        →          R$  40,00
 *   etiquetagem R$ 0,80/un × 10       →          R$   8,00
 *   taxa Amazon 15% de R$ 500,00      →          R$  75,00
 *                                       custos   R$ 123,00
 *   lucro bruto  = 500 − 200          =          R$ 300,00  (60,0%)
 *   lucro líquido= 500 − 200 − 123    =          R$ 177,00  (35,4%)
 */
const CUSTOS_REFERENCIA: EntradaDeCusto[] = [
  { rotulo: "Frete", modo: ModoDeCusto.VALOR_FIXO, valor: 4_000 },
  { rotulo: "Etiquetagem", modo: ModoDeCusto.POR_UNIDADE, valor: 80 },
  { rotulo: "Taxa Amazon", modo: ModoDeCusto.PERCENTUAL_DA_VENDA, valor: 1_500 },
];

const REFERENCIA = {
  quantidade: 10,
  custoUnitarioCentavos: 2_000,
  precoVendaUnitarioCentavos: 5_000,
  custos: CUSTOS_REFERENCIA,
};

describe("calcularResultado", () => {
  it("resolve os três modos de custo e chega no lucro líquido correto", () => {
    const r = calcularResultado(REFERENCIA);

    expect(r.receitaBrutaCentavos).toBe(50_000);
    expect(r.custoMercadoriaCentavos).toBe(20_000);
    expect(r.lucroBrutoCentavos).toBe(30_000);
    expect(r.margemBruta).toBeCloseTo(0.6, 10);

    expect(r.custosDetalhados.map((c) => c.totalCentavos)).toEqual([4_000, 800, 7_500]);
    expect(r.custosOperacionaisCentavos).toBe(12_300);
    expect(r.custoTotalCentavos).toBe(32_300);

    expect(r.lucroLiquidoCentavos).toBe(17_700);
    expect(r.margemLiquida).toBeCloseTo(0.354, 10);
    expect(r.retornoSobreCusto).toBeCloseTo(17_700 / 32_300, 10);
    expect(r.lucroPorUnidadeCentavos).toBe(1_770);
  });

  it("distingue margem bruta de líquida — o custo de operação só entra na líquida", () => {
    const semCustos = calcularResultado({ ...REFERENCIA, custos: [] });

    expect(semCustos.lucroBrutoCentavos).toBe(calcularResultado(REFERENCIA).lucroBrutoCentavos);
    expect(semCustos.lucroLiquidoCentavos).toBe(semCustos.lucroBrutoCentavos);
    expect(semCustos.margemLiquida).toEqual(semCustos.margemBruta);
  });

  it("aponta prejuízo com lucro negativo em vez de travar em zero", () => {
    const r = calcularResultado({ ...REFERENCIA, precoVendaUnitarioCentavos: 2_000 });

    // Receita 200,00; CMV 200,00; custos 40 + 8 + 15% de 200 = 78,00.
    expect(r.receitaBrutaCentavos).toBe(20_000);
    expect(r.lucroLiquidoCentavos).toBe(-7_800);
    expect(r.margemLiquida).toBeCloseTo(-0.39, 10);
    expect(r.lucroPorUnidadeCentavos).toBe(-780);
  });

  it("calcula o preço mínimo que zera a operação", () => {
    const r = calcularResultado(REFERENCIA);
    // (20000 + 4000 + 80×10) / (10 × 0,85) = 24800 / 8,5 = 2917,65 → 2918
    expect(r.precoMinimoUnitarioCentavos).toBe(2_918);

    const noPrecoMinimo = calcularResultado({
      ...REFERENCIA,
      precoVendaUnitarioCentavos: r.precoMinimoUnitarioCentavos ?? 0,
    });
    expect(noPrecoMinimo.lucroLiquidoCentavos).toBeGreaterThanOrEqual(0);

    const umCentavoAbaixo = calcularResultado({
      ...REFERENCIA,
      precoVendaUnitarioCentavos: (r.precoMinimoUnitarioCentavos ?? 0) - 1,
    });
    expect(umCentavoAbaixo.lucroLiquidoCentavos).toBeLessThan(0);
  });

  it("não promete preço mínimo quando os percentuais somam 100%", () => {
    const r = calcularResultado({
      ...REFERENCIA,
      custos: [{ rotulo: "Taxa absurda", modo: ModoDeCusto.PERCENTUAL_DA_VENDA, valor: 10_000 }],
    });

    expect(r.precoMinimoUnitarioCentavos).toBeNull();
    expect(r.unidadesParaEmpatar).toBeNull();
  });

  it("diz quantas unidades cobrem o custo fixo do lote", () => {
    const r = calcularResultado(REFERENCIA);
    // Contribuição por unidade: 5000×0,85 − 2000 − 80 = 2170.
    // Frete fixo 4000 / 2170 = 1,84 → 2 unidades.
    expect(r.unidadesParaEmpatar).toBe(2);
  });

  it("não promete ponto de equilíbrio quando cada unidade dá prejuízo", () => {
    const r = calcularResultado({ ...REFERENCIA, precoVendaUnitarioCentavos: 2_000 });
    expect(r.unidadesParaEmpatar).toBeNull();
  });

  it("trata receita zero sem dividir por zero", () => {
    const r = calcularResultado({ ...REFERENCIA, precoVendaUnitarioCentavos: 0 });

    expect(r.margemBruta).toBeNull();
    expect(r.margemLiquida).toBeNull();
    expect(r.custosDetalhados.every((c) => c.fatiaDaReceita === null)).toBe(true);
    expect(r.lucroLiquidoCentavos).toBe(-24_800);
  });

  it("serve também para serviço — quantidade 1 e sem custo de mercadoria", () => {
    const r = calcularResultado({
      quantidade: 1,
      custoUnitarioCentavos: 0,
      precoVendaUnitarioCentavos: 350_000,
      custos: [
        { rotulo: "Material", modo: ModoDeCusto.VALOR_FIXO, valor: 120_000 },
        { rotulo: "Imposto", modo: ModoDeCusto.PERCENTUAL_DA_VENDA, valor: 600 },
      ],
    });

    expect(r.receitaBrutaCentavos).toBe(350_000);
    expect(r.custoMercadoriaCentavos).toBe(0);
    expect(r.lucroBrutoCentavos).toBe(350_000);
    expect(r.margemBruta).toBe(1);
    expect(r.custosOperacionaisCentavos).toBe(120_000 + 21_000);
    expect(r.lucroLiquidoCentavos).toBe(209_000);
  });
});
