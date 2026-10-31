/**
 * The permission matrix: every named action and which roles may perform it.
 *
 * Source: docs/SPEC.md sections 3, 4 and 7, with decisions 2 and 3 in docs/OPEN-QUESTIONS.md.
 * Every server action and route handler calls `can` (or `authorize`) before doing work; hiding
 * UI is never the only control. docs/permissions.md is generated from this matrix.
 */
import { forbidden, notFound, unauthenticated } from "@/lib/errors";
import { Role } from "@/lib/generated/prisma/enums";

export { Role };

/**
 * How a role may use an action:
 * - "all": on any resource.
 * - "ownBranch": only on resources whose branchId equals the user's branchId (BRANCH_LEAD).
 */
export type Scope = "all" | "ownBranch";

type Grant = {
  /** Anonymous visitors (PUBLIC, decision 2) may perform the action without a session. */
  public?: true;
  roles: Partial<Record<Role, Scope>>;
};

const ALL: Scope = "all";
const OWN: Scope = "ownBranch";

export const PERMISSIONS = {
  // Users (section 7.2: SUPER_ADMIN)
  "user.read": { roles: { SUPER_ADMIN: ALL } },
  "user.create": { roles: { SUPER_ADMIN: ALL } },
  "user.update": { roles: { SUPER_ADMIN: ALL } },
  "user.deactivate": { roles: { SUPER_ADMIN: ALL } },
  "user.resetPassword": { roles: { SUPER_ADMIN: ALL } },

  // Branches (section 7.2: SUPER_ADMIN manages; other staff read for context)
  "branch.read": {
    roles: {
      SUPER_ADMIN: ALL,
      FINANCE_REVIEWER: ALL,
      CONTENT_EDITOR: ALL,
      HR_LEAD: ALL,
      BRANCH_LEAD: OWN,
    },
  },
  "branch.create": { roles: { SUPER_ADMIN: ALL } },
  "branch.update": { roles: { SUPER_ADMIN: ALL } },
  "branch.changeStatus": { roles: { SUPER_ADMIN: ALL } },
  "branch.readPublic": {
    public: true,
    roles: {
      SUPER_ADMIN: ALL,
      FINANCE_REVIEWER: ALL,
      CONTENT_EDITOR: ALL,
      HR_LEAD: ALL,
      BRANCH_LEAD: ALL,
    },
  },
  // Aggregate, network-wide impact figures for the public home page: counts of active
  // branches, cities and members, and the collections total. Aggregate only — no member
  // names, no per-branch or per-person amounts ever leave this surface.
  "impact.readPublic": {
    public: true,
    roles: {
      SUPER_ADMIN: ALL,
      FINANCE_REVIEWER: ALL,
      CONTENT_EDITOR: ALL,
      HR_LEAD: ALL,
      BRANCH_LEAD: ALL,
    },
  },

  // Teams (section 7.2: BRANCH_LEAD for own branch)
  "team.read": { roles: { SUPER_ADMIN: ALL, HR_LEAD: ALL, BRANCH_LEAD: OWN } },
  "team.create": { roles: { SUPER_ADMIN: ALL, BRANCH_LEAD: OWN } },
  "team.update": { roles: { SUPER_ADMIN: ALL, BRANCH_LEAD: OWN } },
  "team.assignMembers": { roles: { SUPER_ADMIN: ALL, BRANCH_LEAD: OWN } },

  // Applications (sections 3, 6.2, 8: applicant data only for HR_LEAD and SUPER_ADMIN)
  "application.submit": {
    public: true,
    roles: {
      SUPER_ADMIN: ALL,
      FINANCE_REVIEWER: ALL,
      CONTENT_EDITOR: ALL,
      HR_LEAD: ALL,
      BRANCH_LEAD: ALL,
    },
  },
  "application.read": { roles: { SUPER_ADMIN: ALL, HR_LEAD: ALL } },
  "application.decide": { roles: { SUPER_ADMIN: ALL, HR_LEAD: ALL } },
  "application.export": { roles: { SUPER_ADMIN: ALL, HR_LEAD: ALL } },

  // Members (section 7.2 and decision 3)
  "member.read": { roles: { SUPER_ADMIN: ALL, HR_LEAD: ALL, BRANCH_LEAD: OWN } },
  "member.updateContact": { roles: { SUPER_ADMIN: ALL, BRANCH_LEAD: OWN } },
  "member.changeStatus": { roles: { SUPER_ADMIN: ALL, HR_LEAD: ALL } },
  "member.changeBranch": { roles: { SUPER_ADMIN: ALL } },
  "member.export": { roles: { SUPER_ADMIN: ALL, HR_LEAD: ALL, BRANCH_LEAD: OWN } },

  // Collections (sections 3, 6.3, 7.2 and amendment A1)
  "collection.read": { roles: { SUPER_ADMIN: ALL, FINANCE_REVIEWER: ALL, BRANCH_LEAD: OWN } },
  "collection.create": { roles: { BRANCH_LEAD: OWN } },
  "collection.update": { roles: { BRANCH_LEAD: OWN } },
  "collection.correct": { roles: { BRANCH_LEAD: OWN } },
  "collection.route": { roles: { FINANCE_REVIEWER: ALL } },
  "collection.export": { roles: { SUPER_ADMIN: ALL, FINANCE_REVIEWER: ALL, BRANCH_LEAD: OWN } },

  // Weekly reports (sections 3, 6.4, 7.2, 7.3)
  "report.read": { roles: { SUPER_ADMIN: ALL, FINANCE_REVIEWER: ALL, BRANCH_LEAD: OWN } },
  "report.draft": { roles: { BRANCH_LEAD: OWN } },
  "report.submit": { roles: { BRANCH_LEAD: OWN } },
  "report.approve": { roles: { FINANCE_REVIEWER: ALL } },
  "report.return": { roles: { FINANCE_REVIEWER: ALL } },
  "report.export": { roles: { SUPER_ADMIN: ALL, FINANCE_REVIEWER: ALL, BRANCH_LEAD: OWN } },

  // Dashboard (section 7.2): HR_LEAD sees member and application KPIs only;
  // BRANCH_LEAD sees its own branch only.
  "dashboard.view": {
    roles: { SUPER_ADMIN: ALL, FINANCE_REVIEWER: ALL, HR_LEAD: ALL, BRANCH_LEAD: OWN },
  },
  "dashboard.viewFinance": {
    roles: { SUPER_ADMIN: ALL, FINANCE_REVIEWER: ALL, BRANCH_LEAD: OWN },
  },
  "dashboard.viewMembership": {
    roles: { SUPER_ADMIN: ALL, FINANCE_REVIEWER: ALL, HR_LEAD: ALL, BRANCH_LEAD: OWN },
  },
  "dashboard.exportUnrouted": {
    roles: { SUPER_ADMIN: ALL, FINANCE_REVIEWER: ALL, BRANCH_LEAD: OWN },
  },

  // Site content and events (sections 3, 7.2: CONTENT_EDITOR and SUPER_ADMIN)
  "content.read": { roles: { SUPER_ADMIN: ALL, CONTENT_EDITOR: ALL } },
  "content.create": { roles: { SUPER_ADMIN: ALL, CONTENT_EDITOR: ALL } },
  "content.update": { roles: { SUPER_ADMIN: ALL, CONTENT_EDITOR: ALL } },
  "content.publish": { roles: { SUPER_ADMIN: ALL, CONTENT_EDITOR: ALL } },
  "content.readPublished": {
    public: true,
    roles: {
      SUPER_ADMIN: ALL,
      FINANCE_REVIEWER: ALL,
      CONTENT_EDITOR: ALL,
      HR_LEAD: ALL,
      BRANCH_LEAD: ALL,
    },
  },
  "event.read": { roles: { SUPER_ADMIN: ALL, CONTENT_EDITOR: ALL } },
  "event.create": { roles: { SUPER_ADMIN: ALL, CONTENT_EDITOR: ALL } },
  "event.update": { roles: { SUPER_ADMIN: ALL, CONTENT_EDITOR: ALL } },
  "event.publish": { roles: { SUPER_ADMIN: ALL, CONTENT_EDITOR: ALL } },

  // Public results / achievements ("the portfolio"): SUPER_ADMIN, CONTENT_EDITOR and HR_LEAD
  // manage them network-wide; a BRANCH_LEAD manages only its own branch's results.
  "result.read": {
    roles: { SUPER_ADMIN: ALL, CONTENT_EDITOR: ALL, HR_LEAD: ALL, BRANCH_LEAD: OWN },
  },
  "result.create": {
    roles: { SUPER_ADMIN: ALL, CONTENT_EDITOR: ALL, HR_LEAD: ALL, BRANCH_LEAD: OWN },
  },
  "result.update": {
    roles: { SUPER_ADMIN: ALL, CONTENT_EDITOR: ALL, HR_LEAD: ALL, BRANCH_LEAD: OWN },
  },
  "result.publish": {
    roles: { SUPER_ADMIN: ALL, CONTENT_EDITOR: ALL, HR_LEAD: ALL, BRANCH_LEAD: OWN },
  },
  "result.readPublished": {
    public: true,
    roles: {
      SUPER_ADMIN: ALL,
      FINANCE_REVIEWER: ALL,
      CONTENT_EDITOR: ALL,
      HR_LEAD: ALL,
      BRANCH_LEAD: ALL,
    },
  },

  // Contact form (section 3: PUBLIC submits; SUPER_ADMIN has all data)
  "contactMessage.submit": {
    public: true,
    roles: {
      SUPER_ADMIN: ALL,
      FINANCE_REVIEWER: ALL,
      CONTENT_EDITOR: ALL,
      HR_LEAD: ALL,
      BRANCH_LEAD: ALL,
    },
  },
  "contactMessage.read": { roles: { SUPER_ADMIN: ALL } },
  "contactMessage.handle": { roles: { SUPER_ADMIN: ALL } },

  // Audit log (section 7.2: SUPER_ADMIN, read-only)
  "audit.read": { roles: { SUPER_ADMIN: ALL } },
} as const satisfies Record<string, Grant>;

export type Action = keyof typeof PERMISSIONS;

export const ACTIONS = Object.keys(PERMISSIONS) as Action[];

/** The fields of the signed-in user that permission checks rely on. */
export type Actor = {
  id: string;
  role: Role;
  branchId: string | null;
};

/** The branch a resource belongs to, when it belongs to one. */
export type ScopedResource = { branchId: string | null };

/**
 * The result of a permission check:
 * - "allowed"
 * - "unauthenticated": no session and the action is not public
 * - "forbidden": the role may not perform the action (respond 403)
 * - "outOfScope": the role may, but not on this branch's resource (respond 404, section 4)
 */
export type Decision = "allowed" | "unauthenticated" | "forbidden" | "outOfScope";

export function decide(actor: Actor | null, action: Action, resource?: ScopedResource): Decision {
  const grant: Grant = PERMISSIONS[action];
  if (!actor) return grant.public ? "allowed" : "unauthenticated";

  const scope = grant.roles[actor.role];
  if (!scope) return "forbidden";
  if (scope === "all") return "allowed";

  // ownBranch: the actor must have a branch, and a given resource must belong to it.
  if (!actor.branchId) return "forbidden";
  if (resource && resource.branchId !== actor.branchId) return "outOfScope";
  return "allowed";
}

export function can(actor: Actor | null, action: Action, resource?: ScopedResource): boolean {
  return decide(actor, action, resource) === "allowed";
}

/**
 * Throws unless the action is allowed. Another branch's resource is reported as not found,
 * so a branch lead cannot learn that it exists (section 4).
 */
export function authorize(actor: Actor | null, action: Action, resource?: ScopedResource): void {
  switch (decide(actor, action, resource)) {
    case "allowed":
      return;
    case "unauthenticated":
      throw unauthenticated();
    case "forbidden":
      throw forbidden();
    case "outOfScope":
      throw notFound();
  }
}

/** The scope a role holds for an action, or null when it holds none. */
export function scopeFor(role: Role, action: Action): Scope | null {
  const grant: Grant = PERMISSIONS[action];
  return grant.roles[role] ?? null;
}

export function isPublic(action: Action): boolean {
  const grant: Grant = PERMISSIONS[action];
  return grant.public === true;
}
