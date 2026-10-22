/** Loads .env.local / .env for command-line scripts (Next.js loads them itself for the app). */
export function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      // file missing — fine
    }
  }
}
