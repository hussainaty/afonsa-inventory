import { createRequire } from "node:module";
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
    const client = postgres(url, { prepare: false, max: 5, idle_timeout: 20, connect_timeout: 10 });
    return drizzlePostgres(client, { schema });
  }
  if (process.env.VERCEL) throw new Error("DATABASE_URL is required on Vercel");
  // Development only: loaded on demand so the WebAssembly engine never loads in production.
  const load = createRequire(import.meta.url);
  const { mkdirSync } = load("node:fs") as typeof import("node:fs");
  const { PGlite } = load("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
  const { drizzle } = load("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite");
  const dataDir = process.env.PGLITE_DATA_DIR ?? ".data/pglite";
  if (dataDir !== "memory") mkdirSync(/*turbopackIgnore: true*/ dataDir, { recursive: true });
  const client = dataDir === "memory" ? new PGlite() : new PGlite(dataDir);
  return drizzle(client, { schema }) as unknown as DB;
}

const globalForDb = globalThis as unknown as { __inventoryDb?: DB };

/**
 * Connects on first use, not on import: `next build` and preview builds never
 * open a database, and a missing DATABASE_URL fails the request, not the build.
 */
export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const real = (globalForDb.__inventoryDb ??= createDb());
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
