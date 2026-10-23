/**
 * Applies prisma/migrations at container start (docs/SPEC.md section 12).
 *
 * The Prisma CLI adds about 250 MB to the image, which breaks the 300 MB budget, so the
 * runtime image applies the same migration files with `pg` instead. It records them in
 * Prisma's own `_prisma_migrations` table, with the same checksum (SHA-256 of
 * migration.sql), so `prisma migrate status` and `prisma migrate deploy` agree with it.
 *
 * - Runs under a PostgreSQL advisory lock, so two starting instances never race.
 * - Each migration runs in its own transaction together with its history row.
 * - Stops on an edited, failed or rolled-back migration instead of guessing.
 *
 * Usage: node scripts/migrate.mjs [migrations directory]
 * Connects with DATABASE_MIGRATION_URL when set, otherwise DATABASE_URL.
 */
import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

// Any constant shared by every instance of this app; "shiplens" in ASCII.
const ADVISORY_LOCK_KEY = 0x736869706c656e73n;

const HISTORY_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id"                  VARCHAR(36) PRIMARY KEY NOT NULL,
  "checksum"            VARCHAR(64) NOT NULL,
  "finished_at"         TIMESTAMPTZ,
  "migration_name"      VARCHAR(255) NOT NULL,
  "logs"                TEXT,
  "rolled_back_at"      TIMESTAMPTZ,
  "started_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0
)`;

async function listMigrations(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const names = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  return Promise.all(
    names.map(async (name) => {
      const sql = await readFile(path.join(directory, name, "migration.sql"), "utf8");
      return { name, sql, checksum: createHash("sha256").update(sql).digest("hex") };
    }),
  );
}

async function main() {
  const connectionString = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const directory = path.resolve(process.argv[2] ?? "prisma/migrations");
  const migrations = await listMigrations(directory);

  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10_000 });
  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [ADVISORY_LOCK_KEY.toString()]);
    await client.query(HISTORY_TABLE_DDL);
    const { rows } = await client.query(
      `SELECT "migration_name", "checksum", "finished_at", "rolled_back_at"
         FROM "_prisma_migrations"`,
    );
    const applied = new Map(rows.map((row) => [row.migration_name, row]));

    let count = 0;
    for (const migration of migrations) {
      const record = applied.get(migration.name);
      if (record) {
        if (!record.finished_at || record.rolled_back_at) {
          throw new Error(`Migration ${migration.name} failed earlier; resolve it manually`);
        }
        if (record.checksum !== migration.checksum) {
          throw new Error(`Migration ${migration.name} was edited after it was applied`);
        }
        continue;
      }
      await client.query("BEGIN");
      try {
        await client.query(migration.sql);
        await client.query(
          `INSERT INTO "_prisma_migrations"
             ("id", "checksum", "finished_at", "migration_name", "applied_steps_count")
           VALUES ($1, $2, now(), $3, 1)`,
          [randomUUID(), migration.checksum, migration.name],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${migration.name} failed`, { cause: error });
      }
      console.log(`Applied migration ${migration.name}`);
      count += 1;
    }
    console.log(count === 0 ? "Database schema is up to date" : `Applied ${count} migration(s)`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  // The message names the migration; the cause's SQLSTATE helps without echoing SQL text.
  const code = error?.cause?.code ? ` (SQLSTATE ${error.cause.code})` : "";
  console.error(`Migration failed: ${error instanceof Error ? error.message : error}${code}`);
  process.exitCode = 1;
});
