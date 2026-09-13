import path from "node:path";
import { config } from "dotenv";

// Em produção (Docker) as variáveis vêm do env_file do compose e este
// arquivo simplesmente não existe — config() não faz nada. Em dev
// nativo (`pnpm dev:worker`), carrega o `.env` da raiz do monorepo.
config({ path: path.resolve(__dirname, "..", "..", "..", ".env") });

import { schedule } from "node-cron";
import { processarLembretesPendentes } from "@advice/application";
import {
  DrizzleEnvioRepository,
  DrizzleLembreteRepository,
  EvolutionApiNotificador,
  runMigrations,
} from "@advice/infrastructure";

const lembreteRepository = new DrizzleLembreteRepository();
const envioRepository = new DrizzleEnvioRepository();
const notificador = new EvolutionApiNotificador();

async function tick(): Promise<void> {
  const resultado = await processarLembretesPendentes({ lembreteRepository, envioRepository, notificador });

  if (resultado.processados > 0) {
    console.log(
      `[scheduler] processados=${resultado.processados} enviados=${resultado.enviados} ` +
        `falharam_definitivamente=${resultado.falharamDefinitivamente} tentativas_com_falha=${resultado.tentativasComFalha}`,
    );
  }
}

async function main(): Promise<void> {
  // O worker é o único processo com uma única réplica garantida — é ele
  // quem aplica migrations no boot (idempotente). O `web` nunca migra,
  // para não correr risco de duas réplicas migrando ao mesmo tempo caso
  // o Swarm escale `web` para mais de 1 réplica no futuro.
  await runMigrations();
  console.log("[worker] migrações aplicadas");

  schedule(
    "* * * * *",
    async () => {
      try {
        await tick();
      } catch (erro) {
        console.error("[scheduler] erro inesperado no ciclo:", erro);
      }
    },
    { timezone: "America/Sao_Paulo", noOverlap: true, name: "processar-lembretes-pendentes" },
  );

  console.log("[worker] scheduler iniciado — verificando lembretes pendentes a cada minuto");
}

main().catch((erro: unknown) => {
  console.error("[worker] falha fatal ao iniciar:", erro);
  process.exit(1);
});
