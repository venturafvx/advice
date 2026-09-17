import { and, asc, eq, sql } from "drizzle-orm";
import { Cadencia, Habito, HabitoId } from "@advice/domain";
import type { FiltroHabitos, FrequenciaDoHabito, HabitoRepository } from "@advice/domain";
import { getDb } from "../db/client";
import { habitosTable } from "../db/schema";

type LinhaHabito = typeof habitosTable.$inferSelect;

export class DrizzleHabitoRepository implements HabitoRepository {
  async salvar(habito: Habito): Promise<void> {
    const linha = paraLinha(habito);

    await getDb()
      .insert(habitosTable)
      .values(linha)
      .onConflictDoUpdate({
        target: habitosTable.id,
        set: {
          nome: linha.nome,
          motivacao: linha.motivacao,
          frequencia: linha.frequencia,
          diasSemana: linha.diasSemana,
          vezesPorSemana: linha.vezesPorSemana,
          arquivado: linha.arquivado,
          atualizadoEm: linha.atualizadoEm,
          // `criadoEm` fica de fora: é história, não estado.
        },
      });
  }

  async buscarPorId(id: HabitoId): Promise<Habito | null> {
    const [linha] = await getDb().select().from(habitosTable).where(eq(habitosTable.id, id.toString()));
    return linha ? paraDominio(linha) : null;
  }

  async buscarPorNome(nome: string): Promise<Habito | null> {
    // A comparação é a mesma expressão do índice único parcial
    // (`lower(btrim(nome))` entre os ativos) — escrita diferente daria
    // uma resposta diferente da do banco, e o erro legível apareceria
    // em casos em que a constraint não dispara (ou o contrário).
    const [linha] = await getDb()
      .select()
      .from(habitosTable)
      .where(
        and(
          sql`lower(btrim(${habitosTable.nome})) = lower(btrim(${nome}))`,
          eq(habitosTable.arquivado, false),
        ),
      );

    return linha ? paraDominio(linha) : null;
  }

  async listar(filtro?: FiltroHabitos): Promise<Habito[]> {
    const base = getDb().select().from(habitosTable);
    // Ordem de criação: a lista de hábitos é curta e estável, e ordenar
    // por desempenho faria a tela se reorganizar sob o dedo a cada tique.
    const linhas = filtro?.incluirArquivados
      ? await base.orderBy(asc(habitosTable.criadoEm))
      : await base.where(eq(habitosTable.arquivado, false)).orderBy(asc(habitosTable.criadoEm));

    return linhas.map(paraDominio);
  }

  async excluir(id: HabitoId): Promise<boolean> {
    // `registros_habito` cai junto pelo ON DELETE CASCADE.
    const apagadas = await getDb()
      .delete(habitosTable)
      .where(eq(habitosTable.id, id.toString()))
      .returning({ id: habitosTable.id });

    return apagadas.length > 0;
  }
}

function paraLinha(habito: Habito) {
  const cadencia = habito.getCadencia().paraProps();
  return {
    id: habito.getId().toString(),
    nome: habito.getNome(),
    motivacao: habito.getMotivacao(),
    frequencia: cadencia.frequencia,
    // Lista vazia vira NULL: o CHECK do banco exige que a coluna só
    // exista para DIAS_DA_SEMANA, e `{}` não é "não se aplica".
    diasSemana: cadencia.diasDaSemana.length > 0 ? [...cadencia.diasDaSemana] : null,
    vezesPorSemana: cadencia.vezesPorSemana,
    arquivado: habito.estaArquivado(),
    criadoEm: habito.getCriadoEm(),
    atualizadoEm: habito.getAtualizadoEm(),
  };
}

function paraDominio(linha: LinhaHabito): Habito {
  return Habito.restaurar({
    id: HabitoId.de(linha.id),
    nome: linha.nome,
    motivacao: linha.motivacao,
    // O CHECK do banco garante a coerência do conjunto; a `Cadencia`
    // revalida ao restaurar, então um valor estranho para no domínio.
    cadencia: Cadencia.de({
      frequencia: linha.frequencia as FrequenciaDoHabito,
      diasDaSemana: linha.diasSemana ?? [],
      vezesPorSemana: linha.vezesPorSemana,
    }),
    arquivado: linha.arquivado,
    criadoEm: linha.criadoEm,
    atualizadoEm: linha.atualizadoEm,
  });
}
