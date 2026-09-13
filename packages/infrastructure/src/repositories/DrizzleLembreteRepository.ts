import { and, eq, lte } from "drizzle-orm";
import { AgendamentoInfo, Lembrete, LembreteId, StatusLembrete } from "@advice/domain";
import type { FiltroLembretes, LembreteRepository } from "@advice/domain";
import { getDb } from "../db/client";
import { lembretesTable } from "../db/schema";

type LinhaLembrete = typeof lembretesTable.$inferSelect;

export class DrizzleLembreteRepository implements LembreteRepository {
  async salvar(lembrete: Lembrete): Promise<void> {
    const linha = {
      id: lembrete.getId().toString(),
      titulo: lembrete.getTitulo(),
      agendadoPara: lembrete.getAgendamento().paraData(),
      timezone: lembrete.getAgendamento().getTimezone(),
      status: lembrete.getStatus(),
      criadoEm: lembrete.getCriadoEm(),
    };

    await getDb()
      .insert(lembretesTable)
      .values(linha)
      .onConflictDoUpdate({
        target: lembretesTable.id,
        set: { titulo: linha.titulo, agendadoPara: linha.agendadoPara, status: linha.status },
      });
  }

  async buscarPorId(id: LembreteId): Promise<Lembrete | null> {
    const [linha] = await getDb().select().from(lembretesTable).where(eq(lembretesTable.id, id.toString()));
    return linha ? this.paraDominio(linha) : null;
  }

  async listar(filtro?: FiltroLembretes): Promise<Lembrete[]> {
    const linhas = filtro?.status
      ? await getDb().select().from(lembretesTable).where(eq(lembretesTable.status, filtro.status))
      : await getDb().select().from(lembretesTable);
    return linhas.map((linha) => this.paraDominio(linha));
  }

  async buscarPendentesVencidos(agora: Date): Promise<Lembrete[]> {
    const linhas = await getDb()
      .select()
      .from(lembretesTable)
      .where(and(eq(lembretesTable.status, StatusLembrete.PENDENTE), lte(lembretesTable.agendadoPara, agora)));
    return linhas.map((linha) => this.paraDominio(linha));
  }

  private paraDominio(linha: LinhaLembrete): Lembrete {
    return Lembrete.restaurar({
      id: LembreteId.de(linha.id),
      titulo: linha.titulo,
      agendamento: AgendamentoInfo.restaurar(linha.agendadoPara, linha.timezone),
      status: linha.status as StatusLembrete,
      criadoEm: linha.criadoEm,
    });
  }
}
