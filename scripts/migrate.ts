/**
 * Creates / updates the MySQL (MariaDB) tables from ./drizzle.
 *   npm run db:migrate
 * Needs DATABASE_URL (or DB_HOST/DB_USER/DB_PASSWORD/DB_NAME). The local JSON store needs no migrations.
 */
import { loadEnv } from "./env";
loadEnv();

import path from "node:path";
import { closeStore, store, usesMysql } from "../src/lib/data/store";

export async function runMigrations(): Promise<boolean> {
  if (!usesMysql()) return false;
  const { migrate } = await import("drizzle-orm/mysql2/migrator");
  const s = store() as import("../src/lib/data/mysql-store").MysqlStore;
  await migrate(s.db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return true;
}

if (require.main === module) {
  runMigrations()
    .then(async (ran) => {
      console.log(ran ? "MySQL migrations applied." : "No DATABASE_URL / DB_HOST set — local JSON store needs no migrations.");
      await closeStore();
    })
    .catch(async (e) => {
      console.error(e);
      await closeStore();
      process.exit(1);
    });
}
