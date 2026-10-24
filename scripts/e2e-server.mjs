/**
 * Starts the production build for the Playwright suite (playwright.config.ts), in this order:
 *
 * 1. Recreate the E2E database schema, so every run starts from the same data.
 * 2. Apply the migrations and load the sample data, as the container does at start
 *    (scripts/docker-entrypoint.sh).
 * 3. Copy the static assets into the standalone build and start its server.
 *
 * Every setting is passed explicitly: E2E_DATABASE_URL is required and must name a throwaway
 * database, because its schema is dropped.
 */
import { execFileSync, spawn } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import pg from "pg";

function fail(message) {
  console.error(`e2e-server: ${message}`);
  process.exit(1);
}

const databaseUrl = process.env.E2E_DATABASE_URL;
if (!databaseUrl) fail("E2E_DATABASE_URL is required (a throwaway database; it is reset).");
const demoPassword = process.env.E2E_DEMO_PASSWORD;
if (!demoPassword) fail("E2E_DEMO_PASSWORD is required (playwright.config.ts sets it).");

for (const file of [".next/standalone/server.js", "build/seed.mjs"]) {
  if (!existsSync(file)) fail(`${file} is missing. Run \`npm run e2e:prepare\` first.`);
}

const schema = new URL(databaseUrl).searchParams.get("schema") ?? "public";
const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await client.query(`CREATE SCHEMA "${schema}"`);
} finally {
  await client.end();
}

const env = {
  PATH: process.env.PATH,
  NODE_ENV: "production",
  NEXT_TELEMETRY_DISABLED: "1",
  DATABASE_URL: databaseUrl,
  // A fixed value for the throwaway E2E server only; not a secret.
  AUTH_SECRET: "e2e-only-auth-secret-0123456789abcdefghij",
  AUTH_TRUST_HOST: "true",
  SEED_DEMO_PASSWORD: demoPassword,
  PORT: process.env.E2E_PORT ?? "3200",
  HOSTNAME: "127.0.0.1",
};

execFileSync(process.execPath, ["scripts/migrate.mjs", "prisma/migrations"], {
  stdio: "inherit",
  env,
});
execFileSync(process.execPath, ["build/seed.mjs"], { stdio: "inherit", env });

// The standalone output leaves out the static assets; the Dockerfile copies them the same way.
for (const [from, to] of [
  [".next/static", ".next/standalone/.next/static"],
  ["public", ".next/standalone/public"],
]) {
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}

const server = spawn(process.execPath, [".next/standalone/server.js"], { stdio: "inherit", env });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
server.on("exit", (code, signal) => process.exit(code ?? (signal ? 0 : 1)));
