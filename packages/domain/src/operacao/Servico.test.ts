import { describe, expect, it } from "vitest";
import { DomainError } from "../erros/DomainError";
import { CategoriaDeCustoId } from "./CategoriaDeCustoId";
import { CustoOperacional } from "./CustoOperacional";
import { Dinheiro } from "./Dinheiro";
import { ModoDeCusto } from "./ModoDeCusto";
import { Negocio } from "./Negocio";
import { Servico, type DadosDoServico } from "./Servico";

const AGORA = new Date("2026-09-13T12:00:00Z");
const CATEGORIA = CategoriaDeCustoId.de("22222222-2222-4222-8222-222222222222");

function dados(sobrescrever: Partial<DadosDoServico> = {}): DadosDoServico {
  return {
    negocio: Negocio.FABIOJUNIORDECOR,
    descricao: "Papel de parede — sala, 18m²",
    cliente: "Ana",
    valorRecebido: Dinheiro.deCentavos(350_000),
    custos: [CustoOperacional.criar(CATEGORIA, "Material", ModoDeCusto.VALOR_FIXO, 120_000)],
    recebidoEm: AGORA,
    observacao: null,
    ...sobrescrever,
  };
}

describe("Servico", () => {
  it("trata o valor recebido como receita bruta e desconta os custos", () => {
    const resultado = Servico.criar(dados(), AGORA).calcularResultado();

    expect(resultado.receitaBrutaCentavos).toBe(350_000);
    expect(resultado.custoMercadoriaCentavos).toBe(0);
    expect(resultado.lucroLiquidoCentavos).toBe(230_000);
    expect(resultado.margemLiquida).toBeCloseTo(230_000 / 350_000, 10);
  });

  it("guarda o negócio a que pertence", () => {
    expect(Servico.criar(dados(), AGORA).getDados().negocio).toBe(Negocio.FABIOJUNIORDECOR);
  });

  it("rejeita negócio desconhecido", () => {
    const invalido = { negocio: "OUTRA_EMPRESA" as unknown as DadosDoServico["negocio"] };
    expect(() => Servico.criar(dados(invalido), AGORA)).toThrow(DomainError);
  });

  it("rejeita custo por unidade — serviço não tem lote", () => {
    const porUnidade = CustoOperacional.criar(CATEGORIA, "Etiquetagem", ModoDeCusto.POR_UNIDADE, 80);
    expect(() => Servico.criar(dados({ custos: [porUnidade] }), AGORA)).toThrow(DomainError);
  });

  it("aceita serviço sem cliente identificado", () => {
    const servico = Servico.criar(dados({ cliente: "  " }), AGORA);
    expect(servico.getDados().cliente).toBeNull();
  });

  it("rejeita descrição vazia e data inválida", () => {
    expect(() => Servico.criar(dados({ descricao: "" }), AGORA)).toThrow(DomainError);
    expect(() => Servico.criar(dados({ recebidoEm: new Date("x") }), AGORA)).toThrow(DomainError);
  });
});
