CREATE TABLE "categorias_custo" (
	"id" uuid PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"modo_padrao" text NOT NULL,
	"valor_padrao" bigint,
	"arquivada" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categorias_custo_modo_valido" CHECK ("categorias_custo"."modo_padrao" in ('VALOR_FIXO', 'POR_UNIDADE', 'PERCENTUAL_DA_VENDA')),
	CONSTRAINT "categorias_custo_valor_padrao_nao_negativo" CHECK ("categorias_custo"."valor_padrao" is null or "categorias_custo"."valor_padrao" >= 0)
);
--> statement-breakpoint
CREATE TABLE "compras" (
	"id" uuid PRIMARY KEY NOT NULL,
	"descricao" text NOT NULL,
	"quantidade" integer NOT NULL,
	"custo_unitario_centavos" bigint NOT NULL,
	"preco_venda_unitario_centavos" bigint NOT NULL,
	"comprado_em" timestamp with time zone NOT NULL,
	"observacao" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "compras_quantidade_positiva" CHECK ("compras"."quantidade" > 0),
	CONSTRAINT "compras_custo_nao_negativo" CHECK ("compras"."custo_unitario_centavos" >= 0),
	CONSTRAINT "compras_preco_nao_negativo" CHECK ("compras"."preco_venda_unitario_centavos" >= 0)
);
--> statement-breakpoint
CREATE TABLE "custos_compra" (
	"id" uuid PRIMARY KEY NOT NULL,
	"compra_id" uuid NOT NULL,
	"categoria_id" uuid NOT NULL,
	"modo" text NOT NULL,
	"valor" bigint NOT NULL,
	"ordem" integer NOT NULL,
	CONSTRAINT "custos_compra_modo_valido" CHECK ("custos_compra"."modo" in ('VALOR_FIXO', 'POR_UNIDADE', 'PERCENTUAL_DA_VENDA')),
	CONSTRAINT "custos_compra_valor_nao_negativo" CHECK ("custos_compra"."valor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "custos_servico" (
	"id" uuid PRIMARY KEY NOT NULL,
	"servico_id" uuid NOT NULL,
	"categoria_id" uuid NOT NULL,
	"modo" text NOT NULL,
	"valor" bigint NOT NULL,
	"ordem" integer NOT NULL,
	CONSTRAINT "custos_servico_modo_valido" CHECK ("custos_servico"."modo" in ('VALOR_FIXO', 'PERCENTUAL_DA_VENDA')),
	CONSTRAINT "custos_servico_valor_nao_negativo" CHECK ("custos_servico"."valor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "servicos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"descricao" text NOT NULL,
	"cliente" text,
	"valor_recebido_centavos" bigint NOT NULL,
	"recebido_em" timestamp with time zone NOT NULL,
	"observacao" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "servicos_valor_nao_negativo" CHECK ("servicos"."valor_recebido_centavos" >= 0)
);
--> statement-breakpoint
ALTER TABLE "custos_compra" ADD CONSTRAINT "custos_compra_compra_id_compras_id_fk" FOREIGN KEY ("compra_id") REFERENCES "public"."compras"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custos_compra" ADD CONSTRAINT "custos_compra_categoria_id_categorias_custo_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias_custo"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custos_servico" ADD CONSTRAINT "custos_servico_servico_id_servicos_id_fk" FOREIGN KEY ("servico_id") REFERENCES "public"."servicos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custos_servico" ADD CONSTRAINT "custos_servico_categoria_id_categorias_custo_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias_custo"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categorias_custo_nome_unico" ON "categorias_custo" USING btree (lower("nome"));--> statement-breakpoint
CREATE INDEX "compras_comprado_em_idx" ON "compras" USING btree ("comprado_em");--> statement-breakpoint
CREATE INDEX "custos_compra_compra_id_idx" ON "custos_compra" USING btree ("compra_id");--> statement-breakpoint
CREATE INDEX "custos_compra_categoria_id_idx" ON "custos_compra" USING btree ("categoria_id");--> statement-breakpoint
CREATE INDEX "custos_servico_servico_id_idx" ON "custos_servico" USING btree ("servico_id");--> statement-breakpoint
CREATE INDEX "custos_servico_categoria_id_idx" ON "custos_servico" USING btree ("categoria_id");--> statement-breakpoint
CREATE INDEX "servicos_recebido_em_idx" ON "servicos" USING btree ("recebido_em");