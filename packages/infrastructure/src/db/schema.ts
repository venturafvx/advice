import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const FREQUENCIAS_SQL = sql`('DIARIA', 'SEMANAL', 'MENSAL')`;

export const lembretesTable = pgTable(
  "lembretes",
  {
    id: uuid("id").primaryKey(),
    titulo: text("titulo").notNull(),
    agendadoPara: timestamp("agendado_para", { withTimezone: true }).notNull(),
    timezone: text("timezone").notNull(),
    status: text("status").notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),

    // --- Recorrência -------------------------------------------------
    // Colunas explícitas em vez de um `jsonb`: a regra tem forma fixa e
    // pequena, e assim o banco consegue defendê-la com CHECK. Um blob
    // opaco só poderia ser validado pela aplicação — e o banco também é
    // alcançável por psql e por script de importação.
    //
    // `serie_id` é a identidade da repetição atravessando todas as suas
    // ocorrências; aponta para a primeira delas. Sem FK de propósito: a
    // ocorrência-origem é um registro histórico como outro qualquer e
    // não deve ganhar poder de veto sobre a limpeza das demais.
    serieId: uuid("serie_id"),
    recorrenciaFrequencia: text("recorrencia_frequencia"),
    recorrenciaHora: integer("recorrencia_hora"),
    recorrenciaMinuto: integer("recorrencia_minuto"),
    recorrenciaDiasSemana: integer("recorrencia_dias_semana").array(),
    recorrenciaDiaMes: integer("recorrencia_dia_mes"),
  },
  (t) => [
    // A varredura do scheduler roda a cada minuto e só enxerga
    // PENDENTE. Índice parcial: com recorrência a tabela cresce sem
    // teto (uma série diária = 365 linhas/ano), mas a fila de pendentes
    // continua do tamanho de um punhado.
    index("lembretes_pendentes_idx").on(t.agendadoPara).where(sql`${t.status} = 'PENDENTE'`),
    index("lembretes_serie_idx").on(t.serieId),
    // Duas ocorrências da mesma série no mesmo instante seriam a mesma
    // mensagem duas vezes. O id determinístico já torna a regravação
    // idempotente; isto é a garantia estrutural por trás dela.
    uniqueIndex("lembretes_serie_ocorrencia_unica")
      .on(t.serieId, t.agendadoPara)
      .where(sql`${t.serieId} is not null`),
    // Ou é avulso (tudo nulo), ou é recorrente e completo — nunca meio
    // termo. Cada frequência carrega só os campos que lhe dizem respeito.
    check(
      "lembretes_recorrencia_coerente",
      sql`(
        ${t.recorrenciaFrequencia} is null
        and ${t.serieId} is null
        and ${t.recorrenciaHora} is null
        and ${t.recorrenciaMinuto} is null
        and ${t.recorrenciaDiasSemana} is null
        and ${t.recorrenciaDiaMes} is null
      ) or (
        ${t.recorrenciaFrequencia} in ${FREQUENCIAS_SQL}
        and ${t.serieId} is not null
        and ${t.recorrenciaHora} between 0 and 23
        and ${t.recorrenciaMinuto} between 0 and 59
        and (
          (
            ${t.recorrenciaFrequencia} = 'DIARIA'
            and ${t.recorrenciaDiasSemana} is null
            and ${t.recorrenciaDiaMes} is null
          ) or (
            ${t.recorrenciaFrequencia} = 'SEMANAL'
            and ${t.recorrenciaDiaMes} is null
            and array_length(${t.recorrenciaDiasSemana}, 1) between 1 and 7
            and ${t.recorrenciaDiasSemana} <@ ARRAY[0, 1, 2, 3, 4, 5, 6]
          ) or (
            ${t.recorrenciaFrequencia} = 'MENSAL'
            and ${t.recorrenciaDiasSemana} is null
            and ${t.recorrenciaDiaMes} between 1 and 31
          )
        )
      )`,
    ),
  ],
);

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
// Contexto: Operação
//
// Duas operações do fundador vivem aqui, separadas pela coluna
// `negocio`: Fabio Junior Decor (papel de parede — venda e aplicação) e
// Venturax (revenda em marketplace). Mesmas tabelas, mesmas regras de
// cálculo, recortes distintos.
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
// Duas operações distintas dividem estas tabelas. O negócio é NOT NULL
// e checado: uma linha sem dono entraria em silêncio nos dois painéis e
// estragaria os dois números.
const NEGOCIOS_SQL = sql`('FABIOJUNIORDECOR', 'VENTURAX')`;

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
    negocio: text("negocio").notNull(),
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
    // Toda listagem do painel filtra por negócio e ordena por data da
    // compra — o índice composto atende as duas na mesma varredura, na
    // ordem em que o predicado é aplicado.
    index("compras_negocio_comprado_em_idx").on(t.negocio, t.compradoEm),
    check("compras_negocio_valido", sql`${t.negocio} in ${NEGOCIOS_SQL}`),
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
    negocio: text("negocio").notNull(),
    descricao: text("descricao").notNull(),
    cliente: text("cliente"),
    valorRecebidoCentavos: bigint("valor_recebido_centavos", { mode: "number" }).notNull(),
    recebidoEm: timestamp("recebido_em", { withTimezone: true }).notNull(),
    observacao: text("observacao"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("servicos_negocio_recebido_em_idx").on(t.negocio, t.recebidoEm),
    check("servicos_negocio_valido", sql`${t.negocio} in ${NEGOCIOS_SQL}`),
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

// ---------------------------------------------------------------------
// Contexto: Hábitos
//
// Um hábito é uma intenção que se repete; um registro é o que de fato
// aconteceu num dia. São coisas diferentes e por isso são duas tabelas:
// mudar a regra ("passar de 3x por semana para todo dia") não pode
// reescrever o que já foi feito ou quebrado.
//
// A unidade do registro é o **dia civil**, não o instante. Por isso
// `dia` é `date` e não `timestamptz`: "fiz hoje" é uma afirmação sobre
// o calendário de São Paulo, e derivar essa data de um timestamp no
// momento da leitura faria o mesmo registro mudar de dia conforme o
// fuso de quem lê — e destruiria a unicidade "um registro por hábito
// por dia", que é a invariante central deste contexto.
//
// Ausência de linha é ausência de registro — nunca "quebrou". Quebrar é
// um ato declarado pelo fundador, com o que passou pela cabeça na hora;
// inferir quebra do silêncio transformaria um dia sem uso do app numa
// falha no histórico.
// ---------------------------------------------------------------------

const FREQUENCIAS_HABITO_SQL = sql`('DIARIA', 'DIAS_DA_SEMANA', 'VEZES_POR_SEMANA')`;
const SITUACOES_HABITO_SQL = sql`('FEITO', 'QUEBRADO')`;

export const habitosTable = pgTable(
  "habitos",
  {
    id: uuid("id").primaryKey(),
    nome: text("nome").notNull(),
    // O porquê do hábito, escrito uma vez, lido no momento de fraqueza.
    // É o que a página mostra ao lado do registro de quebra.
    motivacao: text("motivacao"),

    // --- Frequência --------------------------------------------------
    // Colunas explícitas, como na recorrência de `lembretes`: a regra
    // tem forma fixa e pequena, e assim o CHECK do banco consegue
    // defendê-la. Três formas, porque são três perguntas diferentes:
    // "todo dia", "nestes dias" e "tantas vezes na semana, quando der".
    frequencia: text("frequencia").notNull(),
    // 0 = domingo … 6 = sábado (mesma convenção de `lembretes`).
    diasSemana: integer("dias_semana").array(),
    vezesPorSemana: integer("vezes_por_semana"),

    // Hábito sai de circulação, não é apagado: os registros antigos
    // continuam apontando para ele e o histórico não pode perder o nome
    // do que foi feito. Mesma regra de `categorias_custo`.
    arquivado: boolean("arquivado").notNull().default(false),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Unicidade case-insensitive **entre os ativos**: dois "Academia" na
    // mesma lista seriam dois lugares para ticar a mesma coisa. Um
    // arquivado não atrapalha — e não impede recriar o hábito depois.
    //
    // `btrim` junto do `lower` porque " Academia " é o mesmo hábito para
    // quem olha a tela. O domínio já apara o nome; o índice defende o
    // caminho que não passa por ele (psql, script de importação).
    uniqueIndex("habitos_nome_unico_ativo")
      .on(sql`lower(btrim(${t.nome}))`)
      .where(sql`${t.arquivado} = false`),
    // A lista da página é sempre "os ativos, na ordem em que nasceram".
    index("habitos_ativos_idx").on(t.criadoEm).where(sql`${t.arquivado} = false`),
    check("habitos_nome_nao_vazio", sql`btrim(${t.nome}) <> ''`),
    // Cada frequência carrega só os campos que lhe dizem respeito —
    // nunca meio termo. Um hábito "DIARIA" com `vezes_por_semana` seria
    // duas regras contraditórias na mesma linha.
    //
    // Os `is not null` não são redundantes: em SQL um CHECK que resulta
    // em NULL é aceito, e `null between 1 and 7` resulta em NULL. Sem
    // eles, "DIAS_DA_SEMANA sem dia nenhum" entra em silêncio — testado,
    // entrava mesmo. Pela mesma razão a contagem é `cardinality` e não
    // `array_length(_, 1)`: esta devolve NULL para `ARRAY[]::int[]`
    // (não 0), e o array vazio passava pelo CHECK.
    check(
      "habitos_frequencia_coerente",
      sql`(
        ${t.frequencia} = 'DIARIA'
        and ${t.diasSemana} is null
        and ${t.vezesPorSemana} is null
      ) or (
        ${t.frequencia} = 'DIAS_DA_SEMANA'
        and ${t.vezesPorSemana} is null
        and ${t.diasSemana} is not null
        and cardinality(${t.diasSemana}) between 1 and 7
        and ${t.diasSemana} <@ ARRAY[0, 1, 2, 3, 4, 5, 6]
      ) or (
        ${t.frequencia} = 'VEZES_POR_SEMANA'
        and ${t.diasSemana} is null
        and ${t.vezesPorSemana} is not null
        and ${t.vezesPorSemana} between 1 and 7
      )`,
    ),
    check("habitos_frequencia_valida", sql`${t.frequencia} in ${FREQUENCIAS_HABITO_SQL}`),
  ],
);

export const registrosHabitoTable = pgTable(
  "registros_habito",
  {
    id: uuid("id").primaryKey(),
    habitoId: uuid("habito_id")
      .notNull()
      // Cascade: o registro não significa nada sem o hábito. É
      // aggregate próprio (como `Envio` é para `Lembrete`, e pela mesma
      // razão: um hábito diário produz 365 por ano), mas a vida dele
      // termina junto. Na prática hábito se arquiva; quem apaga de
      // verdade está apagando o engano inteiro, registros incluídos.
      .references(() => habitosTable.id, { onDelete: "cascade" }),
    // `date`, não `timestamptz`: ver o comentário do bloco acima.
    dia: date("dia").notNull(),
    situacao: text("situacao").notNull(),
    // O que aconteceu — o gatilho, a circunstância.
    observacao: text("observacao"),
    // O que passou pela cabeça na hora de quebrar. Separado de
    // `observacao` de propósito: o fato e o pensamento são leituras
    // diferentes, e colapsar os dois num campo só perderia justamente a
    // parte que serve para reconhecer o padrão da próxima vez.
    pensamento: text("pensamento"),
    registradoEm: timestamp("registrado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Um dia, uma verdade. Ticar de novo corrige o registro do dia; não
    // cria um segundo. É esta linha que torna a escrita idempotente.
    uniqueIndex("registros_habito_dia_unico").on(t.habitoId, t.dia),
    // O painel abre em "hoje", varrendo todos os hábitos de uma vez —
    // predicado por `dia`, que o índice composto acima não atende.
    index("registros_habito_dia_idx").on(t.dia),
    check("registros_habito_situacao_valida", sql`${t.situacao} in ${SITUACOES_HABITO_SQL}`),
    // String vazia não é ausência de texto: dois jeitos de dizer "não
    // escrevi nada" viram dois caminhos em toda consulta futura.
    check(
      "registros_habito_texto_nao_vazio",
      sql`(${t.observacao} is null or btrim(${t.observacao}) <> '')
        and (${t.pensamento} is null or btrim(${t.pensamento}) <> '')`,
    ),
  ],
);
