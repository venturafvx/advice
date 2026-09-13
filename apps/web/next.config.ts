import path from "node:path";
import { config } from "dotenv";

// Mesma razão do `apps/worker/src/index.ts`: o Next só lê `.env` do
// próprio diretório do app, e o `.env` deste monorepo vive na raiz.
// Sem isto, `pnpm dev:web` sobe mas toda rota que toca o banco explode
// no `getEnv()` (ZodError: DATABASE_URL undefined).
//
// Em produção (Docker) as variáveis vêm do `env_file` do compose e este
// arquivo não existe — config() vira no-op. `next.config.ts` roda em
// Node antes do servidor bootar, então o process.env já está populado
// quando a primeira request chega.
config({ path: path.resolve(__dirname, "..", "..", ".env") });

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
