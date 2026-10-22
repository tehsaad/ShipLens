import { execFileSync } from "node:child_process";
import { Client } from "pg";
import { getTestDatabaseUrl } from "./test-database";

/** Recreates the test schema from scratch and applies every migration once per run. */
export default async function setup(): Promise<void> {
  const url = getTestDatabaseUrl();
  const schema = new URL(url).searchParams.get("schema") ?? "public";

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.query(`CREATE SCHEMA "${schema}"`);
  } finally {
    await client.end();
  }

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, DATABASE_MIGRATION_URL: url },
  });
}
