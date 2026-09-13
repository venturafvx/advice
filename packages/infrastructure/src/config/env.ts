import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  EVOLUTION_API_BASE_URL: z.string().url(),
  EVOLUTION_API_KEY: z.string().min(1),
  EVOLUTION_INSTANCE_NAME: z.string().min(1),
  WHATSAPP_DESTINO: z.string().min(8),
});

export type Env = z.infer<typeof envSchema>;

let cache: Env | undefined;

/**
 * Validação de env é lazy (só na primeira chamada), nunca no import do
 * módulo. O Next.js executa o grafo de módulos das rotas durante o
 * build (`next build`) para coletar metadados, sem as env vars de
 * runtime disponíveis — validar no import quebraria o build.
 */
export function getEnv(): Env {
  if (!cache) {
    cache = envSchema.parse(process.env);
  }
  return cache;
}
