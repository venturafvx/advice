import { describe, expect, it } from "vitest";
import { DomainError } from "../erros/DomainError";
import { CategoriaDeCustoId } from "./CategoriaDeCustoId";
import { Compra, type DadosDaCompra } from "./Compra";
import { CustoOperacional } from "./CustoOperacional";
import { Dinheiro } from "./Dinheiro";
import { ModoDeCusto } from "./ModoDeCusto";
import { Negocio } from "./Negocio";

const AGORA = new Date("2026-09-13T12:00:00Z");
const CATEGORIA = CategoriaDeCustoId.de("11111111-1111-4111-8111-111111111111");

function dados(sobrescrever: Partial<DadosDaCompra> = {}): DadosDaCompra {
  return {
    negocio: Negocio.VENTURAX,
    descricao: "Caixa de 10 luminárias",
    quantidade: 10,
    custoUnitario: Dinheiro.deCentavos(2_000),
    precoVendaUnitario: Dinheiro.deCentavos(5_000),
    custos: [CustoOperacional.criar(CATEGORIA, "Frete", ModoDeCusto.VALOR_FIXO, 4_000)],
    compradoEm: AGORA,
    observacao: null,
    ...sobrescrever,
  };
}

describe("Compra", () => {
  it("nasce válida e calcula o próprio resultado", () => {
    const compra = Compra.criar(dados(), AGORA);
    const resultado = compra.calcularResultado();

    expect(compra.getDados().descricao).toBe("Caixa de 10 luminárias");
    expect(resultado.receitaBrutaCentavos).toBe(50_000);
    expect(resultado.lucroLiquidoCentavos).toBe(50_000 - 20_000 - 4_000);
  });

  it("normaliza descrição e observação em branco", () => {
    const compra = Compra.criar(dados({ descricao: "  Lote A  ", observacao: "   " }), AGORA);

    expect(compra.getDados().descricao).toBe("Lote A");
    expect(compra.getDados().observacao).toBeNull();
  });

  it("guarda o negócio a que pertence", () => {
    expect(Compra.criar(dados(), AGORA).getDados().negocio).toBe(Negocio.VENTURAX);
    expect(Compra.criar(dados({ negocio: Negocio.FABIOJUNIORDECOR }), AGORA).getDados().negocio).toBe(
      Negocio.FABIOJUNIORDECOR,
    );
  });

  it("rejeita negócio desconhecido — inclusive vindo do banco por restauração", () => {
    const invalido = { negocio: "OUTRA_EMPRESA" as unknown as DadosDaCompra["negocio"] };
    expect(() => Compra.criar(dados(invalido), AGORA)).toThrow(DomainError);
  });

  it("rejeita descrição vazia", () => {
    expect(() => Compra.criar(dados({ descricao: "   " }), AGORA)).toThrow(DomainError);
  });

  it("rejeita quantidade fracionária, zero ou negativa", () => {
    expect(() => Compra.criar(dados({ quantidade: 0 }), AGORA)).toThrow(DomainError);
    expect(() => Compra.criar(dados({ quantidade: -3 }), AGORA)).toThrow(DomainError);
    expect(() => Compra.criar(dados({ quantidade: 1.5 }), AGORA)).toThrow(DomainError);
  });

  it("rejeita data de compra inválida", () => {
    expect(() => Compra.criar(dados({ compradoEm: new Date("nao-e-data") }), AGORA)).toThrow(DomainError);
  });

  it("guarda cópia dos custos — mutar a lista de origem não altera o aggregate", () => {
    const custos = [CustoOperacional.criar(CATEGORIA, "Frete", ModoDeCusto.VALOR_FIXO, 4_000)];
    const compra = Compra.criar(dados({ custos }), AGORA);

    custos.push(CustoOperacional.criar(CATEGORIA, "Extra", ModoDeCusto.VALOR_FIXO, 99_900));

    expect(compra.getDados().custos).toHaveLength(1);
  });

  it("atualiza carimbando a data de alteração e preservando a de criação", () => {
    const compra = Compra.criar(dados(), AGORA);
    const depois = new Date(AGORA.getTime() + 86_400_000);

    compra.atualizar(dados({ precoVendaUnitario: Dinheiro.deCentavos(6_000) }), depois);

    expect(compra.calcularResultado().receitaBrutaCentavos).toBe(60_000);
    expect(compra.getCriadoEm()).toEqual(AGORA);
    expect(compra.getAtualizadoEm()).toEqual(depois);
  });
});
