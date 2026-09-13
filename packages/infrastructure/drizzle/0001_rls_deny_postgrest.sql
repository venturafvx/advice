-- Fecha a porta do PostgREST.
--
-- No Supabase o schema `public` é exposto como API REST autenticada pela
-- chave `anon` — que é pública por design (vai no bundle do browser).
-- Sem RLS, qualquer um que descubra o project ref consegue LER e
-- ESCREVER em `lembretes` e `envios` pela REST, sem passar pelo domínio.
--
-- Esta aplicação não usa PostgREST: web e worker falam Postgres direto
-- pela connection string, como owner das tabelas — e o owner ignora RLS
-- por padrão (não usamos FORCE). Então habilitar RLS sem nenhuma policy
-- é exatamente o que queremos: nega tudo para `anon`/`authenticated` e
-- não muda nada para a aplicação.
--
-- Em Postgres puro (Docker local) os papéis `anon`/`authenticated` não
-- existem; o DO block torna a migration idempotente nos dois ambientes.

ALTER TABLE "lembretes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "envios" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$
DECLARE
  papel text;
BEGIN
  FOREACH papel IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = papel) THEN
      EXECUTE format('REVOKE ALL ON TABLE public.lembretes FROM %I', papel);
      EXECUTE format('REVOKE ALL ON TABLE public.envios FROM %I', papel);
    END IF;
  END LOOP;
END $$;
