import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "../config/env";
import * as schema from "./schema";

type Sql = ReturnType<typeof postgres>;
type Db = ReturnType<typeof drizzle<typeof schema>>;

let sqlSingleton: Sql | undefined;
let dbSingleton: Db | undefined;

/**
 * O pooler do Supabase (Supavisor) em *transaction mode* escuta na 6543
 * e devolve a conexão ao pool a cada statement — prepared statements
 * nomeados, que vivem na sessão, quebram nesse modo. A porta é o sinal
 * canônico e documentado do modo; conexão direta e *session mode*
 * (5432) mantêm a sessão e ficam com prepared statements ligados.
 */
function usaTransactionPooler(url: string): boolean {
  try {
    return new URL(url).port === "6543";
  } catch {
    return false;
  }
}

function getSql(): Sql {
  if (!sqlSingleton) {
    const url = getEnv().DATABASE_URL;
    sqlSingleton = postgres(url, {
      // Dois processos (web + worker) × 5 = 10 conexões no total, bem
      // abaixo do limite do pooler. Esta app faz ~1 operação por minuto;
      // pool maior que isso só desperdiça slot de um recurso escasso.
      max: 5,
      prepare: !usaTransactionPooler(url),
      // Poolers derrubam conexão ociosa do lado deles sem avisar; soltar
      // antes evita erro na próxima query reusando socket morto.
      idle_timeout: 30,
      connect_timeout: 10,
    });
  }
  return sqlSingleton;
}

export function getDb(): Db {
  if (!dbSingleton) {
    dbSingleton = drizzle(getSql(), { schema });
  }
  return dbSingleton;
}

export async function closeDb(): Promise<void> {
  if (sqlSingleton) {
    await sqlSingleton.end();
  }
}
