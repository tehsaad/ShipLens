import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getTestDatabaseUrl } from "./test-database";
import {
  businessDate,
  connect,
  createBranch,
  createCollection,
  createUser,
  mondayWeeksAgo,
  pool,
  setBranchStatus,
  sqlState,
} from "./helpers/sql";

const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";
const INSUFFICIENT_PRIVILEGE = "42501";

afterAll(async () => {
  await pool.end();
});

describe("audit log is append-only (section 5)", () => {
  it("rejects UPDATE, DELETE and TRUNCATE even for the table owner", async () => {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO audit_logs (action, entity_type) VALUES ('test.event', 'Test') RETURNING id`,
    );
    const id = rows[0]!.id;
    expect(await sqlState(pool, `UPDATE audit_logs SET action = 'x' WHERE id = $1`, [id])).toBe(
      "SL009",
    );
    expect(await sqlState(pool, `DELETE FROM audit_logs WHERE id = $1`, [id])).toBe("SL009");
    expect(await sqlState(pool, `TRUNCATE audit_logs`)).toBe("SL009");
  });

  describe("as the application role", () => {
    const roleName = `app_role_test_${randomBytes(4).toString("hex")}`;
    const password = randomBytes(18).toString("base64url");
    let appUrl: string;

    beforeAll(async () => {
      await pool.query(
        `CREATE ROLE "${roleName}" LOGIN PASSWORD '${password}' IN ROLE shiplens_app`,
      );
      const url = new URL(getTestDatabaseUrl());
      url.username = roleName;
      url.password = password;
      appUrl = url.toString();
    });

    afterAll(async () => {
      await pool.query(`DROP ROLE IF EXISTS "${roleName}"`);
    });

    it("can insert and read audit entries but has no UPDATE or DELETE privilege", async () => {
      const app = await connect(appUrl);
      try {
        const { rows } = await app.query<{ id: string }>(
          `INSERT INTO audit_logs (action, entity_type) VALUES ('app.event', 'Test') RETURNING id`,
        );
        const id = rows[0]!.id;
        const read = await app.query(`SELECT id FROM audit_logs WHERE id = $1`, [id]);
        expect(read.rowCount).toBe(1);
        expect(await sqlState(app, `UPDATE audit_logs SET action = 'x' WHERE id = $1`, [id])).toBe(
          INSUFFICIENT_PRIVILEGE,
        );
        expect(await sqlState(app, `DELETE FROM audit_logs WHERE id = $1`, [id])).toBe(
          INSUFFICIENT_PRIVILEGE,
        );
        expect(await sqlState(app, `TRUNCATE audit_logs`)).toBe(INSUFFICIENT_PRIVILEGE);
      } finally {
        await app.end();
      }
    });

    it("cannot delete collections or read the migration history", async () => {
      const branchId = await createBranch();
      const leadId = await createUser("BRANCH_LEAD", branchId);
      const id = await createCollection({
        branchId,
        enteredById: leadId,
        amount: 10,
        collectedOn: await businessDate(),
      });
      const app = await connect(appUrl);
      try {
        expect(await sqlState(app, `DELETE FROM collections WHERE id = $1`, [id])).toBe(
          INSUFFICIENT_PRIVILEGE,
        );
        expect(await sqlState(app, `SELECT 1 FROM _prisma_migrations`)).toBe(
          INSUFFICIENT_PRIVILEGE,
        );
        // Normal work still succeeds: generating a member code uses the sequence.
        const { rows } = await app.query<{ member_code: string }>(
          `INSERT INTO members (full_name, email, phone, branch_id, joined_at)
           VALUES ('App Role', 'app.role@example.test', '03001234567', $1, business_today())
           RETURNING member_code`,
          [branchId],
        );
        expect(rows[0]!.member_code).toMatch(/^MEM-\d{6}$/);
      } finally {
        await app.end();
      }
    });
  });
});

describe("weekly reports (section 6.4)", () => {
  it("locks an approved report against updates and deletion", async () => {
    const branchId = await createBranch();
    const monday = await mondayWeeksAgo(4);
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO weekly_reports (branch_id, week_start, status, approved_at)
       VALUES ($1, $2::date, 'APPROVED', now()) RETURNING id`,
      [branchId, monday],
    );
    const id = rows[0]!.id;
    expect(
      await sqlState(pool, `UPDATE weekly_reports SET lead_notes = 'edit' WHERE id = $1`, [id]),
    ).toBe("SL010");
    expect(await sqlState(pool, `DELETE FROM weekly_reports WHERE id = $1`, [id])).toBe("SL010");
  });

  it("requires weekStart to be a Monday and a comment when returned", async () => {
    const branchId = await createBranch();
    const monday = await mondayWeeksAgo(5);
    const { rows } = await pool.query<{ tuesday: string }>(
      `SELECT ($1::date + 1)::text AS tuesday`,
      [monday],
    );
    expect(
      await sqlState(
        pool,
        `INSERT INTO weekly_reports (branch_id, week_start) VALUES ($1, $2::date)`,
        [branchId, rows[0]!.tuesday],
      ),
    ).toBe(CHECK_VIOLATION);
    expect(
      await sqlState(
        pool,
        `INSERT INTO weekly_reports (branch_id, week_start, status) VALUES ($1, $2::date, 'RETURNED')`,
        [branchId, monday],
      ),
    ).toBe(CHECK_VIOLATION);
  });
});

describe("members (sections 5 and 6.1)", () => {
  it("generates sequential MEM-###### codes that cannot be changed", async () => {
    const branchId = await createBranch();
    const insert = `INSERT INTO members (full_name, email, phone, branch_id, joined_at)
                    VALUES ('A Member', 'member@example.test', '03001234567', $1, business_today())
                    RETURNING id, member_code`;
    const first = await pool.query<{ id: string; member_code: string }>(insert, [branchId]);
    const second = await pool.query<{ member_code: string }>(insert, [branchId]);
    const a = Number(first.rows[0]!.member_code.slice(4));
    const b = Number(second.rows[0]!.member_code.slice(4));
    expect(first.rows[0]!.member_code).toMatch(/^MEM-\d{6}$/);
    expect(b).toBeGreaterThan(a);
    expect(
      await sqlState(pool, `UPDATE members SET member_code = 'MEM-999999' WHERE id = $1`, [
        first.rows[0]!.id,
      ]),
    ).toBe("SL008");
  });

  it("rejects new members for a closed branch", async () => {
    const branchId = await createBranch();
    await setBranchStatus(branchId, "CLOSED");
    expect(
      await sqlState(
        pool,
        `INSERT INTO members (full_name, email, phone, branch_id, joined_at)
         VALUES ('Late Member', 'late@example.test', '03001234567', $1, business_today())`,
        [branchId],
      ),
    ).toBe("SL004");
  });
});

describe("applications (sections 5 and 6.2)", () => {
  const motivation = "I want to help my community and learn how the branch works week by week.";

  async function apply(branchId: string, email: string) {
    return sqlState(
      pool,
      `INSERT INTO applications
         (full_name, email, phone, preferred_branch_id, skills, availability, motivation, consent_given)
       VALUES ('Applicant', $1, '03001234567', $2, 'Teaching', 'WEEKENDS', $3, true)`,
      [email, branchId, motivation],
    );
  }

  it("allows only one open application per email, case-insensitively", async () => {
    const branchId = await createBranch();
    expect(await apply(branchId, "Open.Applicant@example.test")).toBe(null);
    expect(await apply(branchId, "open.applicant@example.test")).toBe(UNIQUE_VIOLATION);
    await pool.query(
      `UPDATE applications SET status = 'DECLINED', decline_reason = 'Not a fit right now'
       WHERE lower(email) = 'open.applicant@example.test'`,
    );
    expect(await apply(branchId, "open.applicant@example.test")).toBe(null);
  });

  it("requires consent, a 50-character motivation and a decline reason", async () => {
    const branchId = await createBranch();
    expect(
      await sqlState(
        pool,
        `INSERT INTO applications
           (full_name, email, phone, preferred_branch_id, skills, availability, motivation, consent_given)
         VALUES ('A', 'no-consent@example.test', '0300', $1, '', 'WEEKENDS', $2, false)`,
        [branchId, motivation],
      ),
    ).toBe(CHECK_VIOLATION);
    expect(
      await sqlState(
        pool,
        `INSERT INTO applications
           (full_name, email, phone, preferred_branch_id, skills, availability, motivation, consent_given)
         VALUES ('A', 'short@example.test', '0300', $1, '', 'WEEKENDS', 'Too short', true)`,
        [branchId],
      ),
    ).toBe(CHECK_VIOLATION);
    await apply(branchId, "decline-me@example.test");
    expect(
      await sqlState(
        pool,
        `UPDATE applications SET status = 'DECLINED' WHERE email = 'decline-me@example.test'`,
      ),
    ).toBe(CHECK_VIOLATION);
  });
});

describe("users (section 5)", () => {
  it("requires lowercase emails and a branch for branch leads", async () => {
    expect(
      await sqlState(
        pool,
        `INSERT INTO users (email, name, password_hash, role) VALUES ('Mixed@Example.test', 'X', 'h', 'HR_LEAD')`,
      ),
    ).toBe(CHECK_VIOLATION);
    expect(
      await sqlState(
        pool,
        `INSERT INTO users (email, name, password_hash, role) VALUES ('lead@example.test', 'X', 'h', 'BRANCH_LEAD')`,
      ),
    ).toBe(CHECK_VIOLATION);
  });

  it("defaults mustChangePassword to true (decision 5)", async () => {
    const id = await createUser("HR_LEAD");
    const { rows } = await pool.query(`SELECT must_change_password FROM users WHERE id = $1`, [id]);
    expect(rows[0].must_change_password).toBe(true);
  });
});
