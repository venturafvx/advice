import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

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

// ---------------------------------------------------------------------
// Contexto: Operação (Venturax)
//
// Todo valor monetário é `bigint` de **centavos**; percentual é `bigint`
// de **pontos-base**. Nenhuma coluna `numeric`/`double` de dinheiro — a
// régua é a mesma do domínio (`Dinheiro`, `Percentual`), e assim não há
// conversão para float em nenhum ponto do caminho.
//
// Os CHECKs replicam invariantes que o domínio já garante. Redundância
// deliberada: o domínio protege a aplicação, o banco protege o dado de
// qualquer caminho que não passe pela aplicação (psql, migration futura,
// script de importação).
// ---------------------------------------------------------------------

const MODOS_DE_CUSTO_SQL = sql`('VALOR_FIXO', 'POR_UNIDADE', 'PERCENTUAL_DA_VENDA')`;

export const categoriasCustoTable = pgTable(
  "categorias_custo",
  {
    id: uuid("id").primaryKey(),
    nome: text("nome").notNull(),
    modoPadrao: text("modo_padrao").notNull(),
    valorPadrao: bigint("valor_padrao", { mode: "number" }),
    arquivada: boolean("arquivada").notNull().default(false),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Unicidade case-insensitive: "Frete" e "frete" são a mesma
    // categoria, e duas delas quebrariam qualquer relatório por tipo de
    // custo — que é a razão de a categoria ser entidade.
    uniqueIndex("categorias_custo_nome_unico").on(sql`lower(${t.nome})`),
    check("categorias_custo_modo_valido", sql`${t.modoPadrao} in ${MODOS_DE_CUSTO_SQL}`),
    check(
      "categorias_custo_valor_padrao_nao_negativo",
      sql`${t.valorPadrao} is null or ${t.valorPadrao} >= 0`,
    ),
  ],
);

export const comprasTable = pgTable(
  "compras",
  {
    id: uuid("id").primaryKey(),
    descricao: text("descricao").notNull(),
    quantidade: integer("quantidade").notNull(),
    custoUnitarioCentavos: bigint("custo_unitario_centavos", { mode: "number" }).notNull(),
    precoVendaUnitarioCentavos: bigint("preco_venda_unitario_centavos", { mode: "number" }).notNull(),
    compradoEm: timestamp("comprado_em", { withTimezone: true }).notNull(),
    observacao: text("observacao"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Toda listagem do painel filtra e ordena por data da compra.
    index("compras_comprado_em_idx").on(t.compradoEm),
    check("compras_quantidade_positiva", sql`${t.quantidade} > 0`),
    check("compras_custo_nao_negativo", sql`${t.custoUnitarioCentavos} >= 0`),
    check("compras_preco_nao_negativo", sql`${t.precoVendaUnitarioCentavos} >= 0`),
  ],
);

export const custosCompraTable = pgTable(
  "custos_compra",
  {
    id: uuid("id").primaryKey(),
    compraId: uuid("compra_id")
      .notNull()
      // Cascade: as linhas de custo são parte do aggregate Compra, não
      // existem sem ela.
      .references(() => comprasTable.id, { onDelete: "cascade" }),
    categoriaId: uuid("categoria_id")
      .notNull()
      // Restrict: categoria com histórico nunca some — arquiva-se.
      .references(() => categoriasCustoTable.id, { onDelete: "restrict" }),
    modo: text("modo").notNull(),
    valor: bigint("valor", { mode: "number" }).notNull(),
    ordem: integer("ordem").notNull(),
  },
  (t) => [
    index("custos_compra_compra_id_idx").on(t.compraId),
    index("custos_compra_categoria_id_idx").on(t.categoriaId),
    check("custos_compra_modo_valido", sql`${t.modo} in ${MODOS_DE_CUSTO_SQL}`),
    check("custos_compra_valor_nao_negativo", sql`${t.valor} >= 0`),
  ],
);

export const servicosTable = pgTable(
  "servicos",
  {
    id: uuid("id").primaryKey(),
    descricao: text("descricao").notNull(),
    cliente: text("cliente"),
    valorRecebidoCentavos: bigint("valor_recebido_centavos", { mode: "number" }).notNull(),
    recebidoEm: timestamp("recebido_em", { withTimezone: true }).notNull(),
    observacao: text("observacao"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("servicos_recebido_em_idx").on(t.recebidoEm),
    check("servicos_valor_nao_negativo", sql`${t.valorRecebidoCentavos} >= 0`),
  ],
);

export const custosServicoTable = pgTable(
  "custos_servico",
  {
    id: uuid("id").primaryKey(),
    servicoId: uuid("servico_id")
      .notNull()
      .references(() => servicosTable.id, { onDelete: "cascade" }),
    categoriaId: uuid("categoria_id")
      .notNull()
      .references(() => categoriasCustoTable.id, { onDelete: "restrict" }),
    modo: text("modo").notNull(),
    valor: bigint("valor", { mode: "number" }).notNull(),
    ordem: integer("ordem").notNull(),
  },
  (t) => [
    index("custos_servico_servico_id_idx").on(t.servicoId),
    index("custos_servico_categoria_id_idx").on(t.categoriaId),
    // Serviço não tem lote: POR_UNIDADE não se aplica (mesma invariante
    // do aggregate `Servico`).
    check("custos_servico_modo_valido", sql`${t.modo} in ('VALOR_FIXO', 'PERCENTUAL_DA_VENDA')`),
    check("custos_servico_valor_nao_negativo", sql`${t.valor} >= 0`),
  ],
);
