import { defineConfig } from "drizzle-kit";

// Generates MySQL/MariaDB migrations into ./drizzle (no database connection needed).
export default defineConfig({
  dialect: "mysql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
});
