import { and, asc, desc, eq, gte, inArray, lte, type SQL } from "drizzle-orm";
import { Compra, CompraId, Dinheiro } from "@advice/domain";
import type { CompraRepository, CustoOperacional, FiltroPeriodo } from "@advice/domain";
import { getDb } from "../db/client";
import { categoriasCustoTable, comprasTable, custosCompraTable } from "../db/schema";
import { agruparPorDono, custoParaLinha } from "./custos";

type LinhaCompra = typeof comprasTable.$inferSelect;

export class DrizzleCompraRepository implements CompraRepository {
  /**
   * Compra e suas linhas de custo são um aggregate só: ou as duas
   * escritas acontecem, ou nenhuma. A transação existe para isso —
   * sem ela, uma falha no meio deixaria a compra sem custos e a margem
   * exibida no painel seria falsa.
   *
   * As linhas são substituídas por completo (delete + insert) em vez de
   * um diff: são poucas, têm ordem própria, e um diff introduziria
   * estado intermediário sem ganho nenhum nesta escala.
   */
  async salvar(compra: Compra): Promise<void> {
    const dados = compra.getDados();
    const id = compra.getId().toString();
    const linha = {
      id,
      descricao: dados.descricao,
      quantidade: dados.quantidade,
      custoUnitarioCentavos: dados.custoUnitario.emCentavos(),
      precoVendaUnitarioCentavos: dados.precoVendaUnitario.emCentavos(),
      compradoEm: dados.compradoEm,
      observacao: dados.observacao,
      criadoEm: compra.getCriadoEm(),
      atualizadoEm: compra.getAtualizadoEm(),
    };

    await getDb().transaction(async (tx) => {
      await tx
        .insert(comprasTable)
        .values(linha)
        .onConflictDoUpdate({
          target: comprasTable.id,
          set: {
            descricao: linha.descricao,
            quantidade: linha.quantidade,
            custoUnitarioCentavos: linha.custoUnitarioCentavos,
            precoVendaUnitarioCentavos: linha.precoVendaUnitarioCentavos,
            compradoEm: linha.compradoEm,
            observacao: linha.observacao,
            atualizadoEm: linha.atualizadoEm,
          },
        });

      await tx.delete(custosCompraTable).where(eq(custosCompraTable.compraId, id));

      const linhasDeCusto = custoParaLinha("compraId", id, dados.custos);
      if (linhasDeCusto.length > 0) {
        await tx.insert(custosCompraTable).values(linhasDeCusto);
      }
    });
  }

  async buscarPorId(id: CompraId): Promise<Compra | null> {
    const [linha] = await getDb().select().from(comprasTable).where(eq(comprasTable.id, id.toString()));
    if (!linha) {
      return null;
    }
    const custos = await this.carregarCustos([linha.id]);
    return paraDominio(linha, custos.get(linha.id) ?? []);
  }

  async listar(filtro?: FiltroPeriodo): Promise<Compra[]> {
    const condicoes: SQL[] = [];
    if (filtro?.de) {
      condicoes.push(gte(comprasTable.compradoEm, filtro.de));
    }
    if (filtro?.ate) {
      condicoes.push(lte(comprasTable.compradoEm, filtro.ate));
    }

    const base = getDb().select().from(comprasTable);
    const linhas =
      condicoes.length > 0
        ? await base
            .where(and(...condicoes))
            .orderBy(desc(comprasTable.compradoEm), desc(comprasTable.criadoEm))
        : await base.orderBy(desc(comprasTable.compradoEm), desc(comprasTable.criadoEm));

    // Uma query para os custos de todas as compras, não uma por compra.
    const custos = await this.carregarCustos(linhas.map((l) => l.id));
    return linhas.map((linha) => paraDominio(linha, custos.get(linha.id) ?? []));
  }

  async excluir(id: CompraId): Promise<void> {
    // `custos_compra` cai junto pelo ON DELETE CASCADE.
    await getDb().delete(comprasTable).where(eq(comprasTable.id, id.toString()));
  }

  private async carregarCustos(ids: string[]): Promise<Map<string, CustoOperacional[]>> {
    if (ids.length === 0) {
      return new Map();
    }

    const linhas = await getDb()
      .select({
        compraId: custosCompraTable.compraId,
        categoriaId: custosCompraTable.categoriaId,
        categoriaNome: categoriasCustoTable.nome,
        modo: custosCompraTable.modo,
        valor: custosCompraTable.valor,
      })
      .from(custosCompraTable)
      .innerJoin(categoriasCustoTable, eq(custosCompraTable.categoriaId, categoriasCustoTable.id))
      .where(inArray(custosCompraTable.compraId, ids))
      .orderBy(asc(custosCompraTable.compraId), asc(custosCompraTable.ordem));

    return agruparPorDono(linhas, (linha) => linha.compraId);
  }
}

function paraDominio(linha: LinhaCompra, custos: CustoOperacional[]): Compra {
  return Compra.restaurar({
    id: CompraId.de(linha.id),
    descricao: linha.descricao,
    quantidade: linha.quantidade,
    custoUnitario: Dinheiro.deCentavos(linha.custoUnitarioCentavos),
    precoVendaUnitario: Dinheiro.deCentavos(linha.precoVendaUnitarioCentavos),
    custos,
    compradoEm: linha.compradoEm,
    observacao: linha.observacao,
    criadoEm: linha.criadoEm,
    atualizadoEm: linha.atualizadoEm,
  });
}
