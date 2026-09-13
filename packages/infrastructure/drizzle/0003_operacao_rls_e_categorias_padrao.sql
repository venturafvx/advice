-- Fecha a porta do PostgREST nas tabelas do contexto de Operação e
-- semeia as categorias de custo com que a operação já começa a valer.
--
-- Mesma razão da 0001: no Supabase o schema `public` é exposto como API
-- REST autenticada pela chave `anon`, que é pública por design. Estas
-- tabelas guardam a estrutura de custo e a margem do negócio — o dado
-- mais sensível do sistema. RLS ligada sem nenhuma policy nega tudo por
-- ali e não muda nada para a aplicação, que conecta como owner das
-- tabelas (owner ignora RLS; não usamos FORCE).
--
-- Nunca criar policy "permissiva pra facilitar" aqui.

ALTER TABLE "categorias_custo" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "compras" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "custos_compra" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "servicos" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "custos_servico" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$
DECLARE
  papel text;
  tabela text;
BEGIN
  FOREACH papel IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = papel) THEN
      FOREACH tabela IN ARRAY ARRAY['categorias_custo', 'compras', 'custos_compra', 'servicos', 'custos_servico'] LOOP
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', tabela, papel);
      END LOOP;
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint
-- Categorias iniciais: os custos que a operação já tem hoje, com o modo
-- de incidência certo em cada uma — frete é fixo no lote, etiquetagem é
-- por peça, comissão da Amazon é percentual da venda. Servem de padrão
-- no formulário; o fundador cria quantas mais quiser.
--
-- `ON CONFLICT DO NOTHING` contra o índice único de `lower(nome)`:
-- a migration é idempotente e nunca sobrescreve um padrão já ajustado.
INSERT INTO "categorias_custo" ("id", "nome", "modo_padrao", "valor_padrao", "arquivada")
VALUES
  (gen_random_uuid(), 'Frete',        'VALOR_FIXO',          NULL,  false),
  (gen_random_uuid(), 'Etiquetagem',  'POR_UNIDADE',         NULL,  false),
  (gen_random_uuid(), 'Taxa Amazon',  'PERCENTUAL_DA_VENDA', 1500,  false),
  (gen_random_uuid(), 'Embalagem',    'POR_UNIDADE',         NULL,  false),
  (gen_random_uuid(), 'Imposto',      'PERCENTUAL_DA_VENDA', NULL,  false),
  (gen_random_uuid(), 'Material',     'VALOR_FIXO',          NULL,  false),
  (gen_random_uuid(), 'Deslocamento', 'VALOR_FIXO',          NULL,  false)
ON CONFLICT DO NOTHING;
