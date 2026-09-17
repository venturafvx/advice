import { and, desc, eq, gte, isNotNull, or } from "drizzle-orm";
import { DiaCivil, HabitoId, RegistroDeHabito, RegistroDeHabitoId } from "@advice/domain";
import type { RegistroDeHabitoRepository, SituacaoDoDia } from "@advice/domain";
import { getDb } from "../db/client";
import { registrosHabitoTable } from "../db/schema";

type LinhaRegistro = typeof registrosHabitoTable.$inferSelect;

export class DrizzleRegistroDeHabitoRepository implements RegistroDeHabitoRepository {
  /**
   * Upsert com alvo no par (hábito, dia) — não no id.
   *
   * É o que sustenta "um registro por hábito por dia" mesmo com dois
   * cliques no mesmo botão ou duas abas abertas: a segunda escrita
   * corrige a primeira em vez de criar um segundo veredicto sobre o
   * mesmo dia. `registrado_em` não entra no `set`: quando o dia foi
   * declarado pela primeira vez é história.
   */
  async registrarDia(registro: RegistroDeHabito): Promise<void> {
    const linha = paraLinha(registro);

    await getDb()
      .insert(registrosHabitoTable)
      .values(linha)
      .onConflictDoUpdate({
        target: [registrosHabitoTable.habitoId, registrosHabitoTable.dia],
        set: {
          situacao: linha.situacao,
          observacao: linha.observacao,
          pensamento: linha.pensamento,
          atualizadoEm: linha.atualizadoEm,
        },
      });
  }

  async buscarPorHabitoEDia(habitoId: HabitoId, dia: DiaCivil): Promise<RegistroDeHabito | null> {
    const [linha] = await getDb()
      .select()
      .from(registrosHabitoTable)
      .where(
        and(
          eq(registrosHabitoTable.habitoId, habitoId.toString()),
          eq(registrosHabitoTable.dia, dia.toString()),
        ),
      );

    return linha ? paraDominio(linha) : null;
  }

  async listarDesde(dia: DiaCivil): Promise<RegistroDeHabito[]> {
    const linhas = await getDb()
      .select()
      .from(registrosHabitoTable)
      .where(gte(registrosHabitoTable.dia, dia.toString()))
      .orderBy(desc(registrosHabitoTable.dia));

    return linhas.map(paraDominio);
  }

  async listarQuebrasComRelato(limite: number): Promise<RegistroDeHabito[]> {
    const linhas = await getDb()
      .select()
      .from(registrosHabitoTable)
      .where(
        and(
          eq(registrosHabitoTable.situacao, "QUEBRADO"),
          // Quebra sem nada escrito não tem o que ler: o diário existe
          // para o relato, não para a contagem (que sai do desempenho).
          or(isNotNull(registrosHabitoTable.observacao), isNotNull(registrosHabitoTable.pensamento)),
        ),
      )
      .orderBy(desc(registrosHabitoTable.dia), desc(registrosHabitoTable.registradoEm))
      .limit(limite);

    return linhas.map(paraDominio);
  }

  async apagarDoDia(habitoId: HabitoId, dia: DiaCivil): Promise<boolean> {
    const apagadas = await getDb()
      .delete(registrosHabitoTable)
      .where(
        and(
          eq(registrosHabitoTable.habitoId, habitoId.toString()),
          eq(registrosHabitoTable.dia, dia.toString()),
        ),
      )
      .returning({ id: registrosHabitoTable.id });

    return apagadas.length > 0;
  }
}

function paraLinha(registro: RegistroDeHabito) {
  return {
    id: registro.getId().toString(),
    habitoId: registro.getHabitoId().toString(),
    // `DiaCivil` já é `YYYY-MM-DD`, que é exatamente o que a coluna
    // `date` espera. Nenhuma conversão de fuso acontece neste caminho —
    // e é de propósito.
    dia: registro.getDia().toString(),
    situacao: registro.getSituacao(),
    observacao: registro.getObservacao(),
    pensamento: registro.getPensamento(),
    registradoEm: registro.getRegistradoEm(),
    atualizadoEm: registro.getAtualizadoEm(),
  };
}

function paraDominio(linha: LinhaRegistro): RegistroDeHabito {
  return RegistroDeHabito.restaurar({
    id: RegistroDeHabitoId.de(linha.id),
    habitoId: HabitoId.de(linha.habitoId),
    dia: DiaCivil.de(linha.dia),
    situacao: linha.situacao as SituacaoDoDia,
    observacao: linha.observacao,
    pensamento: linha.pensamento,
    registradoEm: linha.registradoEm,
    atualizadoEm: linha.atualizadoEm,
  });
}
