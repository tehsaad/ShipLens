import { randomInt } from "node:crypto";
import { Client, Pool, type PoolClient } from "pg";
import { getTestDatabaseUrl } from "../test-database";

export const pool = new Pool({ connectionString: getTestDatabaseUrl(), max: 5 });

/** Opens a dedicated connection, for tests that need two concurrent transactions. */
export async function connect(connectionString = getTestDatabaseUrl()): Promise<Client> {
  const client = new Client({ connectionString });
  await client.connect();
  return client;
}

export type Queryable = Pick<Pool | PoolClient | Client, "query">;

/** Runs a statement and returns the SQLSTATE it fails with, or null when it succeeds. */
export async function sqlState(
  db: Queryable,
  text: string,
  values: unknown[] = [],
): Promise<string | null> {
  try {
    await db.query(text, values);
    return null;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) return String(error.code);
    throw error;
  }
}

const usedCodes = new Set<string>();

/** Unique branch code in the BR-<CITY3>-<NNN> format. */
function uniqueBranchCode(): string {
  for (;;) {
    const letters = Array.from({ length: 3 }, () => String.fromCharCode(65 + randomInt(26))).join(
      "",
    );
    const code = `BR-${letters}-${String(randomInt(1000)).padStart(3, "0")}`;
    if (!usedCodes.has(code)) {
      usedCodes.add(code);
      return code;
    }
  }
}

export async function createBranch(
  status: "FORMING" | "ACTIVE" | "PAUSED" | "CLOSED" = "ACTIVE",
): Promise<string> {
  const code = uniqueBranchCode();
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO branches (code, name, city, status) VALUES ($1, $2, $3, $4) RETURNING id`,
    [code, `Branch ${code}`, "Test City", status],
  );
  return rows[0]!.id;
}

export async function setBranchStatus(branchId: string, status: string): Promise<void> {
  await pool.query(`UPDATE branches SET status = $2::"BranchStatus" WHERE id = $1`, [
    branchId,
    status,
  ]);
}

export async function createUser(
  role: string = "SUPER_ADMIN",
  branchId: string | null = null,
): Promise<string> {
  const email = `user-${Date.now()}-${randomInt(1_000_000)}@example.test`;
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (email, name, password_hash, role, branch_id)
     VALUES ($1, 'Test User', 'not-a-real-hash', $2::"Role", $3) RETURNING id`,
    [email, role, branchId],
  );
  return rows[0]!.id;
}

type CollectionInput = {
  branchId: string;
  enteredById: string;
  amount: string | number;
  collectedOn: string;
  createdAt?: string;
  correctsCollectionId?: string;
  correctionNote?: string;
};

export function insertCollectionSql(input: CollectionInput): [string, unknown[]] {
  return [
    `INSERT INTO collections
       (branch_id, entered_by_id, amount, collected_on, purpose, created_at,
        corrects_collection_id, correction_note)
     VALUES ($1, $2, $3, $4::date, 'GENERAL', coalesce($5::timestamptz, now()), $6, $7)
     RETURNING id`,
    [
      input.branchId,
      input.enteredById,
      input.amount,
      input.collectedOn,
      input.createdAt ?? null,
      input.correctsCollectionId ?? null,
      input.correctionNote ?? null,
    ],
  ];
}

export async function createCollection(input: CollectionInput, db: Queryable = pool) {
  const [text, values] = insertCollectionSql(input);
  const { rows } = await db.query<{ id: string }>(text, values);
  return rows[0]!.id;
}

/** Today's business date (Asia/Karachi) shifted by `days`, as YYYY-MM-DD. */
export async function businessDate(days = 0): Promise<string> {
  const { rows } = await pool.query<{ d: string }>(
    `SELECT (business_today() + $1::int)::text AS d`,
    [days],
  );
  return rows[0]!.d;
}

/** Monday of the week `weeksAgo` weeks before the current business week, as YYYY-MM-DD. */
export async function mondayWeeksAgo(weeksAgo: number): Promise<string> {
  const { rows } = await pool.query<{ d: string }>(
    `SELECT (week_start_of(business_today()) - 7 * $1::int)::text AS d`,
    [weeksAgo],
  );
  return rows[0]!.d;
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
