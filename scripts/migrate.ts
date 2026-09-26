import "dotenv/config";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "../src/db";

// Applies SQL migrations from ./drizzle. The journal lives in the app's own
// "inventory" schema so a shared database's other schemas are never touched.
async function main() {
  const url = process.env.DATABASE_URL;
  const db = createDb(url);
  const opts = { migrationsFolder: "drizzle", migrationsSchema: "inventory" };
  if (url) await migratePostgres(db, opts);
  else await migratePglite(db as never, opts);
  console.log(`Migrations applied (${url ? "postgres" : "pglite"}).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
