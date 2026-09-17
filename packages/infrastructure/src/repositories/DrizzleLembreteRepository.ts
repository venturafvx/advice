import { and, desc, eq, ilike, inArray, lte, ne, type SQL } from "drizzle-orm";
import { AgendamentoInfo, Lembrete, LembreteId, Recorrencia, StatusLembrete } from "@advice/domain";
import type { FiltroLembretes, Frequencia, LembreteRepository, OpcoesHistorico } from "@advice/domain";
import { getDb } from "../db/client";
import { enviosTable, lembretesTable } from "../db/schema";

type LinhaLembrete = typeof lembretesTable.$inferSelect;

/**
 * `%` e `_` são curingas do LIKE. Sem escapar, um fundador que busca
 * "100%" receberia a tabela inteira e acharia que a busca está quebrada.
 * A barra invertida é o escape padrão do Postgres, então basta dobrá-la
 * antes de introduzir as outras.
 */
function escaparParaLike(termo: string): string {
  return termo.replace(/\\/g, "\\\\").replace(/[%_]/g, (curinga) => `\\${curinga}`);
}

function filtroDeTermo(termo: string | undefined): SQL | undefined {
  const limpo = termo?.trim();
  if (!limpo) return undefined;
  // `ILIKE '%…%'` faz varredura sequencial — consciente e adequado na
  // ordem de grandeza deste app (milhares de linhas: milissegundos).
  // Quando a tabela passar de ~100k ocorrências, a resposta é um índice
  // GIN com `pg_trgm` sobre `titulo`, não trocar a consulta.
  return ilike(lembretesTable.titulo, `%${escaparParaLike(limpo)}%`);
}

export class DrizzleLembreteRepository implements LembreteRepository {
  async salvar(lembrete: Lembrete): Promise<void> {
    const linha = this.paraLinha(lembrete);

    await getDb()
      .insert(lembretesTable)
      .values(linha)
      // Só o que muda no ciclo de vida de uma ocorrência: um upsert aqui
      // existe para a materialização idempotente da próxima ocorrência
      // (id determinístico), não para editar. Quem edita chama
      // `atualizar`, que é quem move a regra de recorrência.
      .onConflictDoUpdate({
        target: lembretesTable.id,
        set: { titulo: linha.titulo, agendadoPara: linha.agendadoPara, status: linha.status },
      });
  }

  async atualizar(lembrete: Lembrete): Promise<boolean> {
    const { id, ...campos } = this.paraLinha(lembrete);

    // UPDATE puro, sem INSERT de recuperação: um lembrete apagado
    // enquanto este trabalho acontecia tem de continuar apagado.
    // `criadoEm` fica de fora — é história, não estado.
    const atualizadas = await getDb()
      .update(lembretesTable)
      .set({
        titulo: campos.titulo,
        agendadoPara: campos.agendadoPara,
        timezone: campos.timezone,
        status: campos.status,
        serieId: campos.serieId,
        recorrenciaFrequencia: campos.recorrenciaFrequencia,
        recorrenciaHora: campos.recorrenciaHora,
        recorrenciaMinuto: campos.recorrenciaMinuto,
        recorrenciaDiasSemana: campos.recorrenciaDiasSemana,
        recorrenciaDiaMes: campos.recorrenciaDiaMes,
      })
      .where(eq(lembretesTable.id, id))
      .returning({ id: lembretesTable.id });

    return atualizadas.length > 0;
  }

  async buscarPorId(id: LembreteId): Promise<Lembrete | null> {
    const [linha] = await getDb().select().from(lembretesTable).where(eq(lembretesTable.id, id.toString()));
    return linha ? this.paraDominio(linha) : null;
  }

  async listar(filtro?: FiltroLembretes): Promise<Lembrete[]> {
    const condicoes = [
      filtro?.status ? eq(lembretesTable.status, filtro.status) : undefined,
      filtroDeTermo(filtro?.termo),
    ].filter((condicao): condicao is SQL => condicao !== undefined);

    const consulta = getDb().select().from(lembretesTable);
    const linhas = condicoes.length > 0 ? await consulta.where(and(...condicoes)) : await consulta;

    return linhas.map((linha) => this.paraDominio(linha));
  }

  async listarHistorico({ limite, termo }: OpcoesHistorico): Promise<Lembrete[]> {
    const condicoes = [ne(lembretesTable.status, StatusLembrete.PENDENTE), filtroDeTermo(termo)].filter(
      (condicao): condicao is SQL => condicao !== undefined,
    );

    const linhas = await getDb()
      .select()
      .from(lembretesTable)
      .where(and(...condicoes))
      .orderBy(desc(lembretesTable.agendadoPara))
      .limit(limite);

    return linhas.map((linha) => this.paraDominio(linha));
  }

  async buscarPendentesVencidos(agora: Date): Promise<Lembrete[]> {
    const linhas = await getDb()
      .select()
      .from(lembretesTable)
      .where(
        and(eq(lembretesTable.status, StatusLembrete.PENDENTE), lte(lembretesTable.agendadoPara, agora)),
      );
    return linhas.map((linha) => this.paraDominio(linha));
  }

  /**
   * Os Envios vão junto, na mesma transação. Não é escolha de
   * conveniência: a FK de `envios` aponta para `lembretes`, então ou os
   * dois somem atomicamente ou o banco recusa a exclusão — e um estado
   * intermediário visível (envios órfãos) não chega a existir.
   */
  async excluir(id: LembreteId): Promise<boolean> {
    return getDb().transaction(async (tx) => {
      await tx.delete(enviosTable).where(eq(enviosTable.lembreteId, id.toString()));

      const apagados = await tx
        .delete(lembretesTable)
        .where(eq(lembretesTable.id, id.toString()))
        .returning({ id: lembretesTable.id });

      return apagados.length > 0;
    });
  }

  async excluirHistorico(): Promise<number> {
    const terminal = ne(lembretesTable.status, StatusLembrete.PENDENTE);

    return getDb().transaction(async (tx) => {
      // Subconsulta em vez de duas viagens ao banco: a lista de ids
      // pode ser grande (uma série diária vira milhares de linhas) e não
      // tem por que passar pela aplicação para voltar igual.
      await tx
        .delete(enviosTable)
        .where(
          inArray(
            enviosTable.lembreteId,
            tx.select({ id: lembretesTable.id }).from(lembretesTable).where(terminal),
          ),
        );

      const apagados = await tx.delete(lembretesTable).where(terminal).returning({ id: lembretesTable.id });
      return apagados.length;
    });
  }

  private paraLinha(lembrete: Lembrete) {
    const recorrencia = lembrete.getRecorrencia();

    return {
      id: lembrete.getId().toString(),
      titulo: lembrete.getTitulo(),
      agendadoPara: lembrete.getAgendamento().paraData(),
      timezone: lembrete.getAgendamento().getTimezone(),
      status: lembrete.getStatus(),
      criadoEm: lembrete.getCriadoEm(),
      serieId: lembrete.getSerieId()?.toString() ?? null,
      recorrenciaFrequencia: recorrencia?.getFrequencia() ?? null,
      recorrenciaHora: recorrencia?.getHora() ?? null,
      recorrenciaMinuto: recorrencia?.getMinuto() ?? null,
      // Array vazio violaria o CHECK de SEMANAL e não significa nada nas
      // outras frequências: ausência é NULL.
      recorrenciaDiasSemana: recorrencia?.getDiasDaSemana().length
        ? [...recorrencia.getDiasDaSemana()]
        : null,
      recorrenciaDiaMes: recorrencia?.getDiaDoMes() ?? null,
    };
  }

  private paraDominio(linha: LinhaLembrete): Lembrete {
    return Lembrete.restaurar({
      id: LembreteId.de(linha.id),
      titulo: linha.titulo,
      agendamento: AgendamentoInfo.restaurar(linha.agendadoPara, linha.timezone),
      status: linha.status as StatusLembrete,
      criadoEm: linha.criadoEm,
      recorrencia: this.recorrenciaDaLinha(linha),
      serieId: linha.serieId ? LembreteId.de(linha.serieId) : null,
    });
  }

  /**
   * A reconstrução passa por `Recorrencia.de`, que revalida. É de
   * propósito: o banco é uma fronteira como qualquer outra, e uma linha
   * inconsistente (importação manual, migration futura) tem de estourar
   * na leitura, não virar um agendamento errado.
   */
  private recorrenciaDaLinha(linha: LinhaLembrete): Recorrencia | null {
    if (!linha.recorrenciaFrequencia) return null;

    return Recorrencia.de({
      frequencia: linha.recorrenciaFrequencia as Frequencia,
      hora: linha.recorrenciaHora ?? 0,
      minuto: linha.recorrenciaMinuto ?? 0,
      diasDaSemana: linha.recorrenciaDiasSemana ?? [],
      diaDoMes: linha.recorrenciaDiaMes,
    });
  }
}
