import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";
import { closeDb, getDb } from "./client";

const MIGRATIONS_FOLDER = path.join(__dirname, "..", "..", "drizzle");

export async function runMigrations(): Promise<void> {
  await migrate(getDb(), { migrationsFolder: MIGRATIONS_FOLDER });
}

// Permite rodar como script standalone: `node dist/db/migrate.js`
// (usado por `pnpm db:migrate` em dev nativo, fora do boot do worker).
if (require.main === module) {
  runMigrations()
    .then(async () => {
      console.log("[migrate] migrações aplicadas com sucesso");
      await closeDb();
    })
    .catch((erro: unknown) => {
      console.error("[migrate] falha ao aplicar migrações:", erro);
      process.exit(1);
    });
}
