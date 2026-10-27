import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addDays,
  businessDate,
  connect,
  createBranch,
  createCollection,
  createUser,
  insertCollectionSql,
  mondayWeeksAgo,
  pool,
  setBranchStatus,
  sqlState,
} from "./helpers/sql";

const CHECK_VIOLATION = "23514";

let branchId: string;
let otherBranchId: string;
let leadId: string;

beforeAll(async () => {
  branchId = await createBranch();
  otherBranchId = await createBranch();
  leadId = await createUser("BRANCH_LEAD", branchId);
});

afterAll(async () => {
  await pool.end();
});

describe("7-day lock (section 6.3)", () => {
  it("sets lockedAt to createdAt + 7 days on insert", async () => {
    const id = await createCollection({
      branchId,
      enteredById: leadId,
      amount: 100,
      collectedOn: await businessDate(),
    });
    const { rows } = await pool.query(
      `SELECT locked_at - created_at AS gap FROM collections WHERE id = $1`,
      [id],
    );
    expect(rows[0].gap).toMatchObject({ days: 7 });
  });

  it("ignores a lockedAt supplied by the caller", async () => {
    const { rows } = await pool.query(
      `INSERT INTO collections (branch_id, entered_by_id, amount, collected_on, purpose, locked_at)
       VALUES ($1, $2, 50, business_today(), 'GENERAL', now() + interval '1 year')
       RETURNING locked_at - created_at AS gap`,
      [branchId, leadId],
    );
    expect(rows[0].gap).toMatchObject({ days: 7 });
  });

  it("allows edits while the row is unlocked", async () => {
    const id = await createCollection({
      branchId,
      enteredById: leadId,
      amount: 100,
      collectedOn: await businessDate(),
    });
    expect(await sqlState(pool, `UPDATE collections SET amount = 120 WHERE id = $1`, [id])).toBe(
      null,
    );
  });

  // The handbook's example: an entry is still editable on day 6 and locked on day 8.
  it("keeps an entry editable on day 6 and locks it on day 8", async () => {
    const enteredDaysAgo = async (days: number) =>
      createCollection({
        branchId,
        enteredById: leadId,
        amount: 100,
        collectedOn: await businessDate(-days),
        createdAt: new Date(Date.now() - days * 24 * 3600 * 1000).toISOString(),
      });
    const daySix = await enteredDaysAgo(6);
    const dayEight = await enteredDaysAgo(8);
    expect(
      await sqlState(pool, `UPDATE collections SET amount = 110 WHERE id = $1`, [daySix]),
    ).toBe(null);
    expect(
      await sqlState(pool, `UPDATE collections SET amount = 110 WHERE id = $1`, [dayEight]),
    ).toBe("SL001");
  });

  it("rejects edits once 7 days have passed", async () => {
    const id = await createCollection({
      branchId,
      enteredById: leadId,
      amount: 100,
      collectedOn: await businessDate(-8),
      createdAt: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
    });
    expect(await sqlState(pool, `UPDATE collections SET amount = 90 WHERE id = $1`, [id])).toBe(
      "SL001",
    );
    expect(
      await sqlState(pool, `UPDATE collections SET description = 'changed' WHERE id = $1`, [id]),
    ).toBe("SL001");
  });

  it("still allows routing-only updates on a locked row", async () => {
    const id = await createCollection({
      branchId,
      enteredById: leadId,
      amount: 100,
      collectedOn: await businessDate(-9),
      createdAt: new Date(Date.now() - 9 * 24 * 3600 * 1000).toISOString(),
    });
    const reviewerId = await createUser("FINANCE_REVIEWER");
    expect(
      await sqlState(
        pool,
        `UPDATE collections SET routed_at = now(), routed_by_id = $2, routing_reference = 'TRX-1'
         WHERE id = $1`,
        [id, reviewerId],
      ),
    ).toBe(null);
    expect(
      await sqlState(pool, `UPDATE collections SET routed_at = now(), amount = 1 WHERE id = $1`, [
        id,
      ]),
    ).toBe("SL001");
  });

  it("requires routedAt and routedById together", async () => {
    const id = await createCollection({
      branchId,
      enteredById: leadId,
      amount: 10,
      collectedOn: await businessDate(),
    });
    expect(
      await sqlState(pool, `UPDATE collections SET routed_at = now() WHERE id = $1`, [id]),
    ).toBe(CHECK_VIOLATION);
  });

  it("rejects changes to identity and lock columns", async () => {
    const id = await createCollection({
      branchId,
      enteredById: leadId,
      amount: 10,
      collectedOn: await businessDate(),
    });
    expect(
      await sqlState(pool, `UPDATE collections SET branch_id = $2 WHERE id = $1`, [
        id,
        otherBranchId,
      ]),
    ).toBe("SL008");
    expect(
      await sqlState(
        pool,
        `UPDATE collections SET locked_at = now() + interval '30 days' WHERE id = $1`,
        [id],
      ),
    ).toBe("SL008");
  });
});

describe("no deletion (section 6.3)", () => {
  it("rejects deleting any collection, locked or not", async () => {
    const id = await createCollection({
      branchId,
      enteredById: leadId,
      amount: 10,
      collectedOn: await businessDate(),
    });
    expect(await sqlState(pool, `DELETE FROM collections WHERE id = $1`, [id])).toBe("SL007");
    expect(await sqlState(pool, `TRUNCATE collections CASCADE`)).toBe("SL007");
  });
});

describe("insert rules", () => {
  it("rejects a collection date in the future", async () => {
    const [text, values] = insertCollectionSql({
      branchId,
      enteredById: leadId,
      amount: 10,
      collectedOn: await businessDate(1),
    });
    expect(await sqlState(pool, text, values)).toBe("SL003");
  });

  it("rejects new collections for a closed branch", async () => {
    const closedBranchId = await createBranch("ACTIVE");
    const closedLeadId = await createUser("BRANCH_LEAD", closedBranchId);
    await setBranchStatus(closedBranchId, "CLOSED");
    const [text, values] = insertCollectionSql({
      branchId: closedBranchId,
      enteredById: closedLeadId,
      amount: 10,
      collectedOn: await businessDate(),
    });
    expect(await sqlState(pool, text, values)).toBe("SL004");
  });

  it("requires normal entries to be positive", async () => {
    for (const amount of [0, -5]) {
      const [text, values] = insertCollectionSql({
        branchId,
        enteredById: leadId,
        amount,
        collectedOn: await businessDate(),
      });
      expect(await sqlState(pool, text, values)).toBe(CHECK_VIOLATION);
    }
  });
});

describe("approved weeks (decision 8)", () => {
  it("rejects inserts dated Monday to Sunday of an approved week, but not the day before", async () => {
    const weekBranchId = await createBranch();
    const weekLeadId = await createUser("BRANCH_LEAD", weekBranchId);
    const monday = await mondayWeeksAgo(2);
    const sunday = addDays(monday, 6);
    const previousSunday = addDays(monday, -1);

    const existingId = await createCollection({
      branchId: weekBranchId,
      enteredById: weekLeadId,
      amount: 100,
      collectedOn: addDays(monday, 2),
    });
    await pool.query(
      `INSERT INTO weekly_reports (branch_id, week_start, status, approved_at)
       VALUES ($1, $2::date, 'APPROVED', now())`,
      [weekBranchId, monday],
    );

    for (const day of [monday, sunday]) {
      const [text, values] = insertCollectionSql({
        branchId: weekBranchId,
        enteredById: weekLeadId,
        amount: 10,
        collectedOn: day,
      });
      expect(await sqlState(pool, text, values), day).toBe("SL002");
    }

    const [text, values] = insertCollectionSql({
      branchId: weekBranchId,
      enteredById: weekLeadId,
      amount: 10,
      collectedOn: previousSunday,
    });
    expect(await sqlState(pool, text, values)).toBe(null);

    // Existing rows in the approved week are read-only, except for routing.
    expect(
      await sqlState(pool, `UPDATE collections SET amount = 1 WHERE id = $1`, [existingId]),
    ).toBe("SL002");
    const reviewerId = await createUser("FINANCE_REVIEWER");
    expect(
      await sqlState(
        pool,
        `UPDATE collections SET routed_at = now(), routed_by_id = $2 WHERE id = $1`,
        [existingId, reviewerId],
      ),
    ).toBe(null);
  });

  it("waits for a concurrent approval before accepting an insert", async () => {
    const raceBranchId = await createBranch();
    const raceLeadId = await createUser("BRANCH_LEAD", raceBranchId);
    const monday = await mondayWeeksAgo(3);
    await pool.query(
      `INSERT INTO weekly_reports (branch_id, week_start, status) VALUES ($1, $2::date, 'SUBMITTED')`,
      [raceBranchId, monday],
    );

    const approver = await connect();
    const inserter = await connect();
    try {
      await approver.query("BEGIN");
      await approver.query(
        `UPDATE weekly_reports SET status = 'APPROVED', approved_at = now()
         WHERE branch_id = $1 AND week_start = $2::date`,
        [raceBranchId, monday],
      );

      const [text, values] = insertCollectionSql({
        branchId: raceBranchId,
        enteredById: raceLeadId,
        amount: 10,
        collectedOn: addDays(monday, 1),
      });
      const pending = sqlState(inserter, text, values);
      let settled = false;
      void pending.then(() => (settled = true));
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(settled).toBe(false);

      await approver.query("COMMIT");
      expect(await pending).toBe("SL002");
    } finally {
      await approver.end();
      await inserter.end();
    }
  });
});

describe("corrections (amendment A1)", () => {
  async function original(amount = 100) {
    return createCollection({
      branchId,
      enteredById: leadId,
      amount,
      collectedOn: await businessDate(),
    });
  }

  async function correct(originalId: string, amount: number, note: string | null = "Recount") {
    const [text, values] = insertCollectionSql({
      branchId,
      enteredById: leadId,
      amount,
      collectedOn: await businessDate(),
      correctsCollectionId: originalId,
      ...(note === null ? {} : { correctionNote: note }),
    });
    return sqlState(pool, text, values);
  }

  it("allows negative corrections down to, but not below, zero in total", async () => {
    const id = await original(100);
    expect(await correct(id, -60)).toBe(null);
    expect(await correct(id, -50)).toBe("SL006");
    expect(await correct(id, -40)).toBe(null);
    expect(await correct(id, -0.01)).toBe("SL006");
    expect(await correct(id, 25)).toBe(null);
  });

  it("requires a reason and a non-zero amount", async () => {
    const id = await original();
    expect(await correct(id, -10, null)).toBe(CHECK_VIOLATION);
    expect(await correct(id, -10, "   ")).toBe(CHECK_VIOLATION);
    expect(await correct(id, 0)).toBe(CHECK_VIOLATION);
  });

  it("rejects a reason on a normal entry", async () => {
    const [text, values] = insertCollectionSql({
      branchId,
      enteredById: leadId,
      amount: 10,
      collectedOn: await businessDate(),
      correctionNote: "not a correction",
    });
    expect(await sqlState(pool, text, values)).toBe(CHECK_VIOLATION);
  });

  it("rejects corrections across branches and corrections of corrections", async () => {
    const otherLeadId = await createUser("BRANCH_LEAD", otherBranchId);
    const foreignId = await createCollection({
      branchId: otherBranchId,
      enteredById: otherLeadId,
      amount: 100,
      collectedOn: await businessDate(),
    });
    expect(await correct(foreignId, -10)).toBe("SL005");

    const id = await original();
    await correct(id, -10);
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM collections WHERE corrects_collection_id = $1 LIMIT 1`,
      [id],
    );
    expect(await correct(rows[0]!.id, -1)).toBe("SL005");
  });

  it("re-checks the total when an original or a correction is edited", async () => {
    const id = await original(100);
    await correct(id, -80);
    expect(await sqlState(pool, `UPDATE collections SET amount = 70 WHERE id = $1`, [id])).toBe(
      "SL006",
    );
    expect(await sqlState(pool, `UPDATE collections SET amount = 80 WHERE id = $1`, [id])).toBe(
      null,
    );
    expect(
      await sqlState(
        pool,
        `UPDATE collections SET amount = -81 WHERE corrects_collection_id = $1`,
        [id],
      ),
    ).toBe("SL006");
  });

  it("checks concurrent corrections one at a time", async () => {
    const id = await original(100);
    const first = await connect();
    const second = await connect();
    try {
      await first.query("BEGIN");
      await second.query("BEGIN");
      const [text1, values1] = insertCollectionSql({
        branchId,
        enteredById: leadId,
        amount: -60,
        collectedOn: await businessDate(),
        correctsCollectionId: id,
        correctionNote: "First recount",
      });
      expect(await sqlState(first, text1, values1)).toBe(null);

      const [text2, values2] = insertCollectionSql({
        branchId,
        enteredById: leadId,
        amount: -60,
        collectedOn: await businessDate(),
        correctsCollectionId: id,
        correctionNote: "Second recount",
      });
      const pending = sqlState(second, text2, values2);
      let settled = false;
      void pending.then(() => (settled = true));
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(settled).toBe(false);

      await first.query("COMMIT");
      expect(await pending).toBe("SL006");
      await second.query("ROLLBACK");
    } finally {
      await first.end();
      await second.end();
    }

    const { rows } = await pool.query<{ total: string }>(
      `SELECT sum(amount)::text AS total FROM collections WHERE id = $1 OR corrects_collection_id = $1`,
      [id],
    );
    expect(rows[0]!.total).toBe("40.00");
  });
});
