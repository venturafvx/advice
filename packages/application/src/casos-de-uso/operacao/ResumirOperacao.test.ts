import { describe, expect, it } from "vitest";
import {
  CategoriaDeCustoId,
  Compra,
  CustoOperacional,
  Dinheiro,
  ModoDeCusto,
  Negocio,
  Servico,
} from "@advice/domain";
import type { CompraRepository, FiltroOperacao, ServicoRepository } from "@advice/domain";
import { resumirOperacao, resumirPorNegocio } from "./ResumirOperacao";

const AGORA = new Date("2026-09-17T12:00:00Z");
const CATEGORIA = CategoriaDeCustoId.de("11111111-1111-4111-8111-111111111111");

function compra(negocio: Negocio, quantidade: number, precoUnitario: number): Compra {
  return Compra.criar(
    {
      negocio,
      descricao: `Lote ${negocio}`,
      quantidade,
      custoUnitario: Dinheiro.deCentavos(1_000),
      precoVendaUnitario: Dinheiro.deCentavos(precoUnitario),
      custos: [CustoOperacional.criar(CATEGORIA, "Frete", ModoDeCusto.VALOR_FIXO, 2_000)],
      compradoEm: AGORA,
      observacao: null,
    },
    AGORA,
  );
}

function servico(negocio: Negocio, recebido: number): Servico {
  return Servico.criar(
    {
      negocio,
      descricao: `Serviço ${negocio}`,
      cliente: null,
      valorRecebido: Dinheiro.deCentavos(recebido),
      custos: [],
      recebidoEm: AGORA,
      observacao: null,
    },
    AGORA,
  );
}

/**
 * Repositórios em memória que respeitam o filtro de negócio — é
 * exatamente o contrato que o Drizzle implementa, e é o que estes
 * testes precisam exercitar.
 */
function repositorios(compras: Compra[], servicos: Servico[]): {
  compraRepository: CompraRepository;
  servicoRepository: ServicoRepository;
  consultas: FiltroOperacao[];
} {
  const consultas: FiltroOperacao[] = [];

  const compraRepository: CompraRepository = {
    salvar: async () => undefined,
    buscarPorId: async () => null,
    excluir: async () => undefined,
    listar: async (filtro?: FiltroOperacao) => {
      if (filtro) consultas.push(filtro);
      return filtro?.negocio ? compras.filter((c) => c.getDados().negocio === filtro.negocio) : compras;
    },
  };

  const servicoRepository: ServicoRepository = {
    salvar: async () => undefined,
    buscarPorId: async () => null,
    excluir: async () => undefined,
    listar: async (filtro?: FiltroOperacao) =>
      filtro?.negocio ? servicos.filter((s) => s.getDados().negocio === filtro.negocio) : servicos,
  };

  return { compraRepository, servicoRepository, consultas };
}

describe("resumirPorNegocio", () => {
  it("separa os dois negócios — nenhum número de um entra no outro", async () => {
    const deps = repositorios(
      [compra(Negocio.VENTURAX, 10, 5_000), compra(Negocio.FABIOJUNIORDECOR, 2, 30_000)],
      [servico(Negocio.FABIOJUNIORDECOR, 350_000)],
    );

    const resumos = await resumirPorNegocio(deps);

    const venturax = resumos[Negocio.VENTURAX];
    expect(venturax.compras).toHaveLength(1);
    expect(venturax.servicosRegistrados).toHaveLength(0);
    // 10 × R$ 50,00 de receita projetada, e nada de serviço.
    expect(venturax.mercadoria.receitaBrutaCentavos).toBe(50_000);
    expect(venturax.servicos.receitaBrutaCentavos).toBe(0);

    const fabio = resumos[Negocio.FABIOJUNIORDECOR];
    expect(fabio.compras).toHaveLength(1);
    expect(fabio.servicosRegistrados).toHaveLength(1);
    expect(fabio.mercadoria.receitaBrutaCentavos).toBe(60_000);
    expect(fabio.servicos.receitaBrutaCentavos).toBe(350_000);
  });

  it("devolve linha zerada para o negócio sem movimento, em vez de omiti-lo", async () => {
    const deps = repositorios([compra(Negocio.VENTURAX, 1, 1_000)], []);

    const resumos = await resumirPorNegocio(deps);
    const vazio = resumos[Negocio.FABIOJUNIORDECOR];

    expect(vazio.consolidado.operacoes).toBe(0);
    expect(vazio.consolidado.receitaBrutaCentavos).toBe(0);
    // Sem receita não existe margem — `null`, não zero, que seria "0%".
    expect(vazio.consolidado.margemLiquida).toBeNull();
  });

  it("chega ao mesmo resultado que resumirOperacao filtrado — uma fonte da verdade só", async () => {
    const compras = [compra(Negocio.VENTURAX, 10, 5_000), compra(Negocio.FABIOJUNIORDECOR, 2, 30_000)];
    const servicos = [servico(Negocio.FABIOJUNIORDECOR, 350_000)];

    const porNegocio = await resumirPorNegocio(repositorios(compras, servicos));
    const filtrado = await resumirOperacao(repositorios(compras, servicos), {
      negocio: Negocio.FABIOJUNIORDECOR,
    });

    expect(porNegocio[Negocio.FABIOJUNIORDECOR].consolidado).toEqual(filtrado.consolidado);
    expect(porNegocio[Negocio.FABIOJUNIORDECOR].custosPorCategoria).toEqual(filtrado.custosPorCategoria);
  });
});

describe("resumirOperacao", () => {
  it("repassa o negócio ao repositório — o recorte é do banco, não da memória", async () => {
    const deps = repositorios([compra(Negocio.VENTURAX, 1, 1_000)], []);

    await resumirOperacao(deps, { negocio: Negocio.VENTURAX });

    expect(deps.consultas[0]?.negocio).toBe(Negocio.VENTURAX);
  });
});
