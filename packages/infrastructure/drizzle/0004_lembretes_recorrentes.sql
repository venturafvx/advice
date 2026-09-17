-- Lembretes recorrentes ("todo dia às 07:00").
--
-- Aditiva por construção: toda coluna nasce NULL e todo lembrete que já
-- existe continua sendo exatamente o que era — um aviso avulso. Nenhuma
-- linha é reescrita, nenhum backfill, nenhum downtime.
--
-- A repetição não reabre o lembrete: cada disparo é uma ocorrência com
-- id, histórico e estado terminal próprios, ligada às irmãs por
-- `serie_id`. O CHECK garante que uma linha é ou avulsa (tudo nulo) ou
-- recorrente e completa, com só os campos que a frequência usa.

ALTER TABLE "lembretes" ADD COLUMN "serie_id" uuid;--> statement-breakpoint
ALTER TABLE "lembretes" ADD COLUMN "recorrencia_frequencia" text;--> statement-breakpoint
ALTER TABLE "lembretes" ADD COLUMN "recorrencia_hora" integer;--> statement-breakpoint
ALTER TABLE "lembretes" ADD COLUMN "recorrencia_minuto" integer;--> statement-breakpoint
ALTER TABLE "lembretes" ADD COLUMN "recorrencia_dias_semana" integer[];--> statement-breakpoint
ALTER TABLE "lembretes" ADD COLUMN "recorrencia_dia_mes" integer;--> statement-breakpoint
CREATE INDEX "lembretes_pendentes_idx" ON "lembretes" USING btree ("agendado_para") WHERE "lembretes"."status" = 'PENDENTE';--> statement-breakpoint
CREATE INDEX "lembretes_serie_idx" ON "lembretes" USING btree ("serie_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lembretes_serie_ocorrencia_unica" ON "lembretes" USING btree ("serie_id","agendado_para") WHERE "lembretes"."serie_id" is not null;--> statement-breakpoint
ALTER TABLE "lembretes" ADD CONSTRAINT "lembretes_recorrencia_coerente" CHECK ((
        "lembretes"."recorrencia_frequencia" is null
        and "lembretes"."serie_id" is null
        and "lembretes"."recorrencia_hora" is null
        and "lembretes"."recorrencia_minuto" is null
        and "lembretes"."recorrencia_dias_semana" is null
        and "lembretes"."recorrencia_dia_mes" is null
      ) or (
        "lembretes"."recorrencia_frequencia" in ('DIARIA', 'SEMANAL', 'MENSAL')
        and "lembretes"."serie_id" is not null
        and "lembretes"."recorrencia_hora" between 0 and 23
        and "lembretes"."recorrencia_minuto" between 0 and 59
        and (
          (
            "lembretes"."recorrencia_frequencia" = 'DIARIA'
            and "lembretes"."recorrencia_dias_semana" is null
            and "lembretes"."recorrencia_dia_mes" is null
          ) or (
            "lembretes"."recorrencia_frequencia" = 'SEMANAL'
            and "lembretes"."recorrencia_dia_mes" is null
            and array_length("lembretes"."recorrencia_dias_semana", 1) between 1 and 7
            and "lembretes"."recorrencia_dias_semana" <@ ARRAY[0, 1, 2, 3, 4, 5, 6]
          ) or (
            "lembretes"."recorrencia_frequencia" = 'MENSAL'
            and "lembretes"."recorrencia_dias_semana" is null
            and "lembretes"."recorrencia_dia_mes" between 1 and 31
          )
        )
      ));