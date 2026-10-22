/**
 * Checks the live database connection (Hostinger MariaDB / MySQL).
 *   npm run db:check
 * Prints the server version, whether the tables exist and how many rows they hold.
 */
import { loadEnv } from "./env";
loadEnv();

import mysql from "mysql2/promise";
import { mysqlPoolOptions } from "../src/lib/data/mysql-store";
import { usesMysql } from "../src/lib/data/store";

async function main() {
  if (!usesMysql()) {
    console.log("DATABASE_URL / DB_HOST is not set — the app is using the local JSON file (.data/db.json).");
    return;
  }
  const opts = mysqlPoolOptions();
  const conn = await mysql.createConnection({ ...opts, connectTimeout: 15_000 } as mysql.ConnectionOptions);
  try {
    const [[v]] = (await conn.query("SELECT VERSION() AS v, DATABASE() AS db, @@time_zone AS tz")) as unknown as [{ v: string; db: string; tz: string }[]];
    console.log(`Connected: ${v.v} · database "${v.db}" · server time zone ${v.tz} (the app stores UTC itself).`);
    const [tables] = (await conn.query("SHOW TABLES")) as unknown as [Record<string, string>[]];
    const names = tables.map((t) => Object.values(t)[0]);
    const wanted = ["users", "companies", "contacts", "deals", "visits", "proposals", "audit_log", "sectors", "sub_sectors", "cities", "parent_groups"];
    const missing = wanted.filter((t) => !names.includes(t));
    if (missing.length) {
      console.log(`Missing tables: ${missing.join(", ")} — run: npm run db:migrate`);
    } else {
      for (const t of wanted) {
        const [[c]] = (await conn.query(`SELECT COUNT(*) AS n FROM \`${t}\``)) as unknown as [{ n: number }[]];
        console.log(`  ${t.padEnd(14)} ${c.n}`);
      }
      console.log("All tables present.");
    }
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error("Could not connect:", e instanceof Error ? e.message : e);
  console.error("Check the host, user, password and database name, and that Remote MySQL allows connections from this machine (Hostinger hPanel → Databases → Remote MySQL).");
  process.exit(1);
});
