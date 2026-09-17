-- Contexto: Hábitos — a intenção que se repete (`habitos`) e o que de
-- fato aconteceu em cada dia (`registros_habito`).
--
-- As tabelas já nascem com RLS ligada e sem policy nenhuma, no mesmo
-- arquivo em que são criadas. Separar em duas migrations (como foi
-- feito na 0001 e na 0003, por razão histórica) deixaria uma janela em
-- que elas existem abertas pela API REST do Supabase — e a janela é
-- exatamente o intervalo entre dois passos do migrador. Mesma razão da
-- 0001: a chave `anon` é pública por design; RLS sem policy nega tudo
-- por ali e não muda nada para a aplicação, que conecta como owner das
-- tabelas (owner ignora RLS; não usamos FORCE).
--
-- Nunca criar policy "permissiva pra facilitar" aqui.

CREATE TABLE "habitos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"motivacao" text,
	"frequencia" text NOT NULL,
	"dias_semana" integer[],
	"vezes_por_semana" integer,
	"arquivado" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "habitos_nome_nao_vazio" CHECK (btrim("habitos"."nome") <> ''),
	CONSTRAINT "habitos_frequencia_coerente" CHECK ((
        "habitos"."frequencia" = 'DIARIA'
        and "habitos"."dias_semana" is null
        and "habitos"."vezes_por_semana" is null
      ) or (
        "habitos"."frequencia" = 'DIAS_DA_SEMANA'
        and "habitos"."vezes_por_semana" is null
        and "habitos"."dias_semana" is not null
        and cardinality("habitos"."dias_semana") between 1 and 7
        and "habitos"."dias_semana" <@ ARRAY[0, 1, 2, 3, 4, 5, 6]
      ) or (
        "habitos"."frequencia" = 'VEZES_POR_SEMANA'
        and "habitos"."dias_semana" is null
        and "habitos"."vezes_por_semana" is not null
        and "habitos"."vezes_por_semana" between 1 and 7
      )),
	CONSTRAINT "habitos_frequencia_valida" CHECK ("habitos"."frequencia" in ('DIARIA', 'DIAS_DA_SEMANA', 'VEZES_POR_SEMANA'))
);
--> statement-breakpoint
CREATE TABLE "registros_habito" (
	"id" uuid PRIMARY KEY NOT NULL,
	"habito_id" uuid NOT NULL,
	"dia" date NOT NULL,
	"situacao" text NOT NULL,
	"observacao" text,
	"pensamento" text,
	"registrado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registros_habito_situacao_valida" CHECK ("registros_habito"."situacao" in ('FEITO', 'QUEBRADO')),
	CONSTRAINT "registros_habito_texto_nao_vazio" CHECK (("registros_habito"."observacao" is null or btrim("registros_habito"."observacao") <> '')
        and ("registros_habito"."pensamento" is null or btrim("registros_habito"."pensamento") <> ''))
);
--> statement-breakpoint
ALTER TABLE "registros_habito" ADD CONSTRAINT "registros_habito_habito_id_habitos_id_fk" FOREIGN KEY ("habito_id") REFERENCES "public"."habitos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "habitos_nome_unico_ativo" ON "habitos" USING btree (lower(btrim("nome"))) WHERE "habitos"."arquivado" = false;--> statement-breakpoint
CREATE INDEX "habitos_ativos_idx" ON "habitos" USING btree ("criado_em") WHERE "habitos"."arquivado" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "registros_habito_dia_unico" ON "registros_habito" USING btree ("habito_id","dia");--> statement-breakpoint
CREATE INDEX "registros_habito_dia_idx" ON "registros_habito" USING btree ("dia");--> statement-breakpoint
ALTER TABLE "habitos" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "registros_habito" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$
DECLARE
  papel text;
  tabela text;
BEGIN
  FOREACH papel IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = papel) THEN
      FOREACH tabela IN ARRAY ARRAY['habitos', 'registros_habito'] LOOP
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', tabela, papel);
      END LOOP;
    END IF;
  END LOOP;
END $$;
