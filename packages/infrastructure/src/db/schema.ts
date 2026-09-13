import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const lembretesTable = pgTable("lembretes", {
  id: uuid("id").primaryKey(),
  titulo: text("titulo").notNull(),
  agendadoPara: timestamp("agendado_para", { withTimezone: true }).notNull(),
  timezone: text("timezone").notNull(),
  status: text("status").notNull(),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});

export const enviosTable = pgTable("envios", {
  id: uuid("id").primaryKey(),
  lembreteId: uuid("lembrete_id")
    .notNull()
    .references(() => lembretesTable.id),
  tentativa: integer("tentativa").notNull(),
  status: text("status").notNull(),
  mensagemProviderId: text("mensagem_provider_id"),
  erro: text("erro"),
  executadoEm: timestamp("executado_em", { withTimezone: true }).notNull().defaultNow(),
});
