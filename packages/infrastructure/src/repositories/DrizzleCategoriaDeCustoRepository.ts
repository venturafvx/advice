import { asc, eq, sql } from "drizzle-orm";
import { CategoriaDeCusto, CategoriaDeCustoId } from "@advice/domain";
import type { CategoriaDeCustoRepository, FiltroCategorias, ModoDeCusto } from "@advice/domain";
import { getDb } from "../db/client";
import { categoriasCustoTable } from "../db/schema";

type LinhaCategoria = typeof categoriasCustoTable.$inferSelect;

export class DrizzleCategoriaDeCustoRepository implements CategoriaDeCustoRepository {
  async salvar(categoria: CategoriaDeCusto): Promise<void> {
    const linha = {
      id: categoria.getId().toString(),
      nome: categoria.getNome(),
      modoPadrao: categoria.getModoPadrao(),
      valorPadrao: categoria.getValorPadrao(),
      arquivada: categoria.estaArquivada(),
      criadoEm: categoria.getCriadoEm(),
    };

    await getDb()
      .insert(categoriasCustoTable)
      .values(linha)
      .onConflictDoUpdate({
        target: categoriasCustoTable.id,
        set: {
          nome: linha.nome,
          modoPadrao: linha.modoPadrao,
          valorPadrao: linha.valorPadrao,
          arquivada: linha.arquivada,
        },
      });
  }

  async buscarPorId(id: CategoriaDeCustoId): Promise<CategoriaDeCusto | null> {
    const [linha] = await getDb()
      .select()
      .from(categoriasCustoTable)
      .where(eq(categoriasCustoTable.id, id.toString()));
    return linha ? paraDominio(linha) : null;
  }

  async buscarPorNome(nome: string): Promise<CategoriaDeCusto | null> {
    // `lower(nome)` casa exatamente com o índice único da tabela — a
    // busca usa o índice em vez de varrer.
    const [linha] = await getDb()
      .select()
      .from(categoriasCustoTable)
      .where(sql`lower(${categoriasCustoTable.nome}) = lower(${nome.trim()})`);
    return linha ? paraDominio(linha) : null;
  }

  async listar(filtro?: FiltroCategorias): Promise<CategoriaDeCusto[]> {
    const base = getDb().select().from(categoriasCustoTable);
    const linhas = filtro?.incluirArquivadas
      ? await base.orderBy(asc(categoriasCustoTable.nome))
      : await base.where(eq(categoriasCustoTable.arquivada, false)).orderBy(asc(categoriasCustoTable.nome));
    return linhas.map(paraDominio);
  }
}

function paraDominio(linha: LinhaCategoria): CategoriaDeCusto {
  return CategoriaDeCusto.restaurar({
    id: CategoriaDeCustoId.de(linha.id),
    nome: linha.nome,
    modoPadrao: linha.modoPadrao as ModoDeCusto,
    valorPadrao: linha.valorPadrao,
    arquivada: linha.arquivada,
    criadoEm: linha.criadoEm,
  });
}
