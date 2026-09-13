import { and, asc, desc, eq, gte, inArray, lte, type SQL } from "drizzle-orm";
import { Dinheiro, Servico, ServicoId } from "@advice/domain";
import type { CustoOperacional, FiltroPeriodo, ServicoRepository } from "@advice/domain";
import { getDb } from "../db/client";
import { categoriasCustoTable, custosServicoTable, servicosTable } from "../db/schema";
import { agruparPorDono, custoParaLinha } from "./custos";

type LinhaServico = typeof servicosTable.$inferSelect;

export class DrizzleServicoRepository implements ServicoRepository {
  async salvar(servico: Servico): Promise<void> {
    const dados = servico.getDados();
    const id = servico.getId().toString();
    const linha = {
      id,
      descricao: dados.descricao,
      cliente: dados.cliente,
      valorRecebidoCentavos: dados.valorRecebido.emCentavos(),
      recebidoEm: dados.recebidoEm,
      observacao: dados.observacao,
      criadoEm: servico.getCriadoEm(),
      atualizadoEm: servico.getAtualizadoEm(),
    };

    await getDb().transaction(async (tx) => {
      await tx
        .insert(servicosTable)
        .values(linha)
        .onConflictDoUpdate({
          target: servicosTable.id,
          set: {
            descricao: linha.descricao,
            cliente: linha.cliente,
            valorRecebidoCentavos: linha.valorRecebidoCentavos,
            recebidoEm: linha.recebidoEm,
            observacao: linha.observacao,
            atualizadoEm: linha.atualizadoEm,
          },
        });

      await tx.delete(custosServicoTable).where(eq(custosServicoTable.servicoId, id));

      const linhasDeCusto = custoParaLinha("servicoId", id, dados.custos);
      if (linhasDeCusto.length > 0) {
        await tx.insert(custosServicoTable).values(linhasDeCusto);
      }
    });
  }

  async buscarPorId(id: ServicoId): Promise<Servico | null> {
    const [linha] = await getDb().select().from(servicosTable).where(eq(servicosTable.id, id.toString()));
    if (!linha) {
      return null;
    }
    const custos = await this.carregarCustos([linha.id]);
    return paraDominio(linha, custos.get(linha.id) ?? []);
  }

  async listar(filtro?: FiltroPeriodo): Promise<Servico[]> {
    const condicoes: SQL[] = [];
    if (filtro?.de) {
      condicoes.push(gte(servicosTable.recebidoEm, filtro.de));
    }
    if (filtro?.ate) {
      condicoes.push(lte(servicosTable.recebidoEm, filtro.ate));
    }

    const base = getDb().select().from(servicosTable);
    const linhas =
      condicoes.length > 0
        ? await base
            .where(and(...condicoes))
            .orderBy(desc(servicosTable.recebidoEm), desc(servicosTable.criadoEm))
        : await base.orderBy(desc(servicosTable.recebidoEm), desc(servicosTable.criadoEm));

    const custos = await this.carregarCustos(linhas.map((l) => l.id));
    return linhas.map((linha) => paraDominio(linha, custos.get(linha.id) ?? []));
  }

  async excluir(id: ServicoId): Promise<void> {
    await getDb().delete(servicosTable).where(eq(servicosTable.id, id.toString()));
  }

  private async carregarCustos(ids: string[]): Promise<Map<string, CustoOperacional[]>> {
    if (ids.length === 0) {
      return new Map();
    }

    const linhas = await getDb()
      .select({
        servicoId: custosServicoTable.servicoId,
        categoriaId: custosServicoTable.categoriaId,
        categoriaNome: categoriasCustoTable.nome,
        modo: custosServicoTable.modo,
        valor: custosServicoTable.valor,
      })
      .from(custosServicoTable)
      .innerJoin(categoriasCustoTable, eq(custosServicoTable.categoriaId, categoriasCustoTable.id))
      .where(inArray(custosServicoTable.servicoId, ids))
      .orderBy(asc(custosServicoTable.servicoId), asc(custosServicoTable.ordem));

    return agruparPorDono(linhas, (linha) => linha.servicoId);
  }
}

function paraDominio(linha: LinhaServico, custos: CustoOperacional[]): Servico {
  return Servico.restaurar({
    id: ServicoId.de(linha.id),
    descricao: linha.descricao,
    cliente: linha.cliente,
    valorRecebido: Dinheiro.deCentavos(linha.valorRecebidoCentavos),
    custos,
    recebidoEm: linha.recebidoEm,
    observacao: linha.observacao,
    criadoEm: linha.criadoEm,
    atualizadoEm: linha.atualizadoEm,
  });
}
