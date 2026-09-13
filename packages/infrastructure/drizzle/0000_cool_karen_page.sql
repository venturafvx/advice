CREATE TABLE "envios" (
	"id" uuid PRIMARY KEY NOT NULL,
	"lembrete_id" uuid NOT NULL,
	"tentativa" integer NOT NULL,
	"status" text NOT NULL,
	"mensagem_provider_id" text,
	"erro" text,
	"executado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lembretes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"titulo" text NOT NULL,
	"agendado_para" timestamp with time zone NOT NULL,
	"timezone" text NOT NULL,
	"status" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "envios" ADD CONSTRAINT "envios_lembrete_id_lembretes_id_fk" FOREIGN KEY ("lembrete_id") REFERENCES "public"."lembretes"("id") ON DELETE no action ON UPDATE no action;