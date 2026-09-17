-- Separa a Operação em dois negócios: Fabio Junior Decor (papel de
-- parede — venda do material e serviço de aplicação) e Venturax
-- (revenda em marketplace).
--
-- Mesmas tabelas, mesmas regras de cálculo, uma coluna de recorte. Duas
-- tabelas de compras seriam duas cópias de toda invariante de dinheiro
-- e dois caminhos para a margem divergir — o número pelo qual este
-- contexto existe.
--
-- A coluna nasce nula, é preenchida e só então vira NOT NULL. Fazer em
-- um passo só (`ADD COLUMN ... NOT NULL` sem default) falharia em
-- qualquer tabela que já tenha linha, e as duas já têm.
--
-- O backfill não é arbitrário: até aqui, toda compra registrada era
-- mercadoria de marketplace e todo serviço era papel de parede — é
-- exatamente a divisão que este commit está formalizando. Ver o
-- glossário em CLAUDE.md e docs/DOMAIN.md.

ALTER TABLE "compras" ADD COLUMN "negocio" text;
--> statement-breakpoint
ALTER TABLE "servicos" ADD COLUMN "negocio" text;
--> statement-breakpoint
UPDATE "compras" SET "negocio" = 'VENTURAX' WHERE "negocio" IS NULL;
--> statement-breakpoint
UPDATE "servicos" SET "negocio" = 'FABIOJUNIORDECOR' WHERE "negocio" IS NULL;
--> statement-breakpoint
ALTER TABLE "compras" ALTER COLUMN "negocio" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "servicos" ALTER COLUMN "negocio" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "compras" ADD CONSTRAINT "compras_negocio_valido" CHECK ("compras"."negocio" in ('FABIOJUNIORDECOR', 'VENTURAX'));
--> statement-breakpoint
ALTER TABLE "servicos" ADD CONSTRAINT "servicos_negocio_valido" CHECK ("servicos"."negocio" in ('FABIOJUNIORDECOR', 'VENTURAX'));
--> statement-breakpoint
-- O índice antigo era só por data; toda listagem do painel agora filtra
-- por negócio primeiro. O composto atende as duas na mesma varredura.
DROP INDEX IF EXISTS "compras_comprado_em_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "servicos_recebido_em_idx";
--> statement-breakpoint
CREATE INDEX "compras_negocio_comprado_em_idx" ON "compras" USING btree ("negocio","comprado_em");
--> statement-breakpoint
CREATE INDEX "servicos_negocio_recebido_em_idx" ON "servicos" USING btree ("negocio","recebido_em");
