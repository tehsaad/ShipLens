import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { ACTIONS, authorize, decide, type Action, type Actor, type Role } from "@/lib/permissions";

/**
 * Expected grants, written out independently of lib/permissions.ts from docs/SPEC.md
 * sections 3, 4 and 7 and decisions 2 and 3. Columns:
 *   PUB = anonymous visitor, SA = SUPER_ADMIN, FR = FINANCE_REVIEWER, CE = CONTENT_EDITOR,
 *   BL = BRANCH_LEAD, HR = HR_LEAD.
 * Cells: "A" = any resource, "O" = own branch only, "-" = not allowed.
 * For PUB, "A" means allowed without signing in.
 */
type Cell = "A" | "O" | "-";
//                                         PUB  SA   FR   CE   BL   HR
const EXPECTED: Record<Action, [Cell, Cell, Cell, Cell, Cell, Cell]> = {
  "user.read": /*                   */ ["-", "A", "-", "-", "-", "-"],
  "user.create": /*                 */ ["-", "A", "-", "-", "-", "-"],
  "user.update": /*                 */ ["-", "A", "-", "-", "-", "-"],
  "user.deactivate": /*             */ ["-", "A", "-", "-", "-", "-"],
  "user.resetPassword": /*          */ ["-", "A", "-", "-", "-", "-"],
  "branch.read": /*                 */ ["-", "A", "A", "A", "O", "A"],
  "branch.create": /*               */ ["-", "A", "-", "-", "-", "-"],
  "branch.update": /*               */ ["-", "A", "-", "-", "-", "-"],
  "branch.changeStatus": /*         */ ["-", "A", "-", "-", "-", "-"],
  "branch.readPublic": /*           */ ["A", "A", "A", "A", "A", "A"],
  "team.read": /*                   */ ["-", "A", "-", "-", "O", "A"],
  "team.create": /*                 */ ["-", "A", "-", "-", "O", "-"],
  "team.update": /*                 */ ["-", "A", "-", "-", "O", "-"],
  "team.assignMembers": /*          */ ["-", "A", "-", "-", "O", "-"],
  "application.submit": /*          */ ["A", "A", "A", "A", "A", "A"],
  "application.read": /*            */ ["-", "A", "-", "-", "-", "A"],
  "application.decide": /*          */ ["-", "A", "-", "-", "-", "A"],
  "application.export": /*          */ ["-", "A", "-", "-", "-", "A"],
  "member.read": /*                 */ ["-", "A", "-", "-", "O", "A"],
  "member.updateContact": /*        */ ["-", "A", "-", "-", "O", "-"],
  "member.changeStatus": /*         */ ["-", "A", "-", "-", "-", "A"],
  "member.changeBranch": /*         */ ["-", "A", "-", "-", "-", "-"],
  "member.export": /*               */ ["-", "A", "-", "-", "O", "A"],
  "collection.read": /*             */ ["-", "A", "A", "-", "O", "-"],
  "collection.create": /*           */ ["-", "-", "-", "-", "O", "-"],
  "collection.update": /*           */ ["-", "-", "-", "-", "O", "-"],
  "collection.correct": /*          */ ["-", "-", "-", "-", "O", "-"],
  "collection.route": /*            */ ["-", "-", "A", "-", "-", "-"],
  "collection.export": /*           */ ["-", "A", "A", "-", "O", "-"],
  "report.read": /*                 */ ["-", "A", "A", "-", "O", "-"],
  "report.draft": /*                */ ["-", "-", "-", "-", "O", "-"],
  "report.submit": /*               */ ["-", "-", "-", "-", "O", "-"],
  "report.approve": /*              */ ["-", "-", "A", "-", "-", "-"],
  "report.return": /*               */ ["-", "-", "A", "-", "-", "-"],
  "report.export": /*               */ ["-", "A", "A", "-", "O", "-"],
  "dashboard.view": /*              */ ["-", "A", "A", "-", "O", "A"],
  "dashboard.viewFinance": /*       */ ["-", "A", "A", "-", "O", "-"],
  "dashboard.viewMembership": /*    */ ["-", "A", "A", "-", "O", "A"],
  "dashboard.exportUnrouted": /*    */ ["-", "A", "A", "-", "O", "-"],
  "content.read": /*                */ ["-", "A", "-", "A", "-", "-"],
  "content.create": /*              */ ["-", "A", "-", "A", "-", "-"],
  "content.update": /*              */ ["-", "A", "-", "A", "-", "-"],
  "content.publish": /*             */ ["-", "A", "-", "A", "-", "-"],
  "content.readPublished": /*       */ ["A", "A", "A", "A", "A", "A"],
  "event.read": /*                  */ ["-", "A", "-", "A", "-", "-"],
  "event.create": /*                */ ["-", "A", "-", "A", "-", "-"],
  "event.update": /*                */ ["-", "A", "-", "A", "-", "-"],
  "event.publish": /*               */ ["-", "A", "-", "A", "-", "-"],
  "contactMessage.submit": /*       */ ["A", "A", "A", "A", "A", "A"],
  "contactMessage.read": /*         */ ["-", "A", "-", "-", "-", "-"],
  "contactMessage.handle": /*       */ ["-", "A", "-", "-", "-", "-"],
  "audit.read": /*                  */ ["-", "A", "-", "-", "-", "-"],
};

const ROLE_COLUMNS: Role[] = [
  "SUPER_ADMIN",
  "FINANCE_REVIEWER",
  "CONTENT_EDITOR",
  "BRANCH_LEAD",
  "HR_LEAD",
];

const OWN_BRANCH = "11111111-1111-4111-8111-111111111111";
const OTHER_BRANCH = "22222222-2222-4222-8222-222222222222";

function actorFor(role: Role): Actor {
  return {
    id: "00000000-0000-4000-8000-000000000000",
    role,
    branchId: role === "BRANCH_LEAD" ? OWN_BRANCH : null,
  };
}

describe("permission matrix", () => {
  it("defines exactly the expected actions", () => {
    expect([...ACTIONS].sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  describe.each(Object.entries(EXPECTED) as [Action, Cell[]][])("%s", (action, cells) => {
    it("matches the expected anonymous access", () => {
      expect(decide(null, action)).toBe(cells[0] === "A" ? "allowed" : "unauthenticated");
    });

    it.each(ROLE_COLUMNS.map((role, index) => [role, cells[index + 1]!] as const))(
      "%s → %s",
      (role, cell) => {
        const actor = actorFor(role);
        const own = decide(actor, action, { branchId: OWN_BRANCH });
        const other = decide(actor, action, { branchId: OTHER_BRANCH });
        const unscoped = decide(actor, action);

        if (cell === "-") {
          expect([own, other, unscoped]).toEqual(["forbidden", "forbidden", "forbidden"]);
        } else if (cell === "A") {
          expect([own, other, unscoped]).toEqual(["allowed", "allowed", "allowed"]);
        } else {
          expect([own, other, unscoped]).toEqual(["allowed", "outOfScope", "allowed"]);
        }
      },
    );
  });
});

describe("rules stated in the specification", () => {
  const fr = actorFor("FINANCE_REVIEWER");
  const ce = actorFor("CONTENT_EDITOR");
  const bl = actorFor("BRANCH_LEAD");
  const hr = actorFor("HR_LEAD");
  const denied = (actor: Actor, action: Action) => decide(actor, action) === "forbidden";

  it("FINANCE_REVIEWER cannot edit collections or members, or publish content", () => {
    for (const action of [
      "collection.create",
      "collection.update",
      "collection.correct",
      "member.updateContact",
      "member.changeStatus",
      "content.publish",
      "event.publish",
    ] as const) {
      expect(denied(fr, action), action).toBe(true);
    }
  });

  it("CONTENT_EDITOR has no access to members, applications, collections or reports", () => {
    const blocked = ACTIONS.filter((action) =>
      /^(member|application|collection|report)\./.test(action),
    ).filter((action) => action !== "application.submit");
    expect(blocked.length).toBeGreaterThan(0);
    for (const action of blocked) expect(denied(ce, action), action).toBe(true);
  });

  it("BRANCH_LEAD cannot approve or return reports", () => {
    expect(denied(bl, "report.approve")).toBe(true);
    expect(denied(bl, "report.return")).toBe(true);
  });

  it("HR_LEAD has no finance or report access", () => {
    const blocked = ACTIONS.filter((action) =>
      /^(collection|report)\.|^dashboard\.(viewFinance|exportUnrouted)$/.test(action),
    );
    for (const action of blocked) expect(denied(hr, action), action).toBe(true);
  });

  it("only HR_LEAD and SUPER_ADMIN can see applicant data", () => {
    for (const role of ROLE_COLUMNS) {
      const expected = role === "HR_LEAD" || role === "SUPER_ADMIN" ? "allowed" : "forbidden";
      expect(decide(actorFor(role), "application.read"), role).toBe(expected);
    }
  });

  it("a branch lead without a branch is denied branch-scoped actions", () => {
    const orphan: Actor = { ...bl, branchId: null };
    expect(decide(orphan, "collection.create")).toBe("forbidden");
    expect(decide(orphan, "member.read", { branchId: null })).toBe("forbidden");
  });

  it("a resource without a branch is out of scope for a branch lead", () => {
    expect(decide(bl, "member.read", { branchId: null })).toBe("outOfScope");
  });
});

describe("authorize", () => {
  function statusOf(fn: () => void): number | null {
    try {
      fn();
      return null;
    } catch (error) {
      if (error instanceof AppError) return error.status;
      throw error;
    }
  }

  it("returns 404 for another branch's resource and 403 for a missing role", () => {
    const bl = actorFor("BRANCH_LEAD");
    expect(statusOf(() => authorize(bl, "collection.read", { branchId: OWN_BRANCH }))).toBe(null);
    expect(statusOf(() => authorize(bl, "collection.read", { branchId: OTHER_BRANCH }))).toBe(404);
    expect(statusOf(() => authorize(bl, "report.approve"))).toBe(403);
    expect(statusOf(() => authorize(null, "audit.read"))).toBe(401);
    expect(statusOf(() => authorize(null, "application.submit"))).toBe(null);
  });
});
