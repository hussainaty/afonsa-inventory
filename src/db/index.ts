import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;

/**
 * Production: DATABASE_URL points at Postgres (Supabase transaction pooler, port 6543),
 * which does not support prepared statements, hence `prepare: false`.
 * Local dev/tests without DATABASE_URL: an embedded PGlite database
 * (run `npm run db:migrate` once to create the tables).
 */
export function createDb(url = process.env.DATABASE_URL): DB {
  if (url) {
    const client = postgres(url, { prepare: false, max: 5, idle_timeout: 20 });
    return drizzlePostgres(client, { schema });
  }
  if (process.env.VERCEL) throw new Error("DATABASE_URL is required on Vercel");
  const dataDir = process.env.PGLITE_DATA_DIR ?? ".data/pglite";
  if (dataDir !== "memory") mkdirSync(dataDir, { recursive: true });
  const client = dataDir === "memory" ? new PGlite() : new PGlite(dataDir);
  return drizzlePglite(client, { schema }) as unknown as DB;
}

const globalForDb = globalThis as unknown as { __inventoryDb?: DB };
export const db: DB = (globalForDb.__inventoryDb ??= createDb());

export { schema };
