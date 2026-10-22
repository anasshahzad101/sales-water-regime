/**
 * Runs before `npm run dev`: if there is no database configured and no local data yet,
 * creates .data/db.json with sample (fictional) companies and demo activity so the app works at once.
 */
import { loadEnv } from "./env";
loadEnv();

import { execSync } from "node:child_process";
import fs from "node:fs";
import { JSON_DB_FILE } from "../src/lib/data/json-store";
import { usesMysql } from "../src/lib/data/store";

if (!usesMysql() && !fs.existsSync(JSON_DB_FILE)) {
  console.log("No local data yet — loading sample companies and demo activity (first run only)…");
  execSync("npx tsx scripts/seed.ts --demo", { stdio: "inherit" });
}
