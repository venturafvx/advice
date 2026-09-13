import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "../config/env";
import * as schema from "./schema";

type Sql = ReturnType<typeof postgres>;
type Db = ReturnType<typeof drizzle<typeof schema>>;

let sqlSingleton: Sql | undefined;
let dbSingleton: Db | undefined;

function getSql(): Sql {
  if (!sqlSingleton) {
    sqlSingleton = postgres(getEnv().DATABASE_URL, { max: 10 });
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
