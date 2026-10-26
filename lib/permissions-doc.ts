import { ROLE_LABELS } from "@/lib/labels";
import { ACTIONS, isPublic, scopeFor, type Action, type Role } from "@/lib/permissions";

/**
 * docs/permissions.md (sections 4 and 13): the role × action table, rendered from the
 * permission matrix so the two cannot disagree. `npm run docs:permissions` writes the file, and
 * tests/unit/permissions-doc.test.ts fails when the committed file differs.
 */

const ROLES: Role[] = [
  "SUPER_ADMIN",
  "FINANCE_REVIEWER",
  "CONTENT_EDITOR",
  "HR_LEAD",
  "BRANCH_LEAD",
];

/** Section headings for the action prefixes, in the matrix's order. */
const AREAS: Record<string, string> = {
  user: "Users",
  branch: "Branches",
  team: "Teams",
  application: "Volunteer applications",
  member: "Members",
  collection: "Collections",
  report: "Weekly reports",
  dashboard: "Dashboard",
  content: "Site content",
  event: "Events",
  contactMessage: "Contact messages",
  audit: "Audit log",
};

function cell(role: Role, action: Action): string {
  const scope = scopeFor(role, action);
  if (scope === "all") return "All";
  if (scope === "ownBranch") return "Own branch";
  return "—";
}

export function renderPermissionsDoc(): string {
  const byArea = new Map<string, Action[]>();
  for (const action of ACTIONS) {
    const area = action.split(".")[0]!;
    byArea.set(area, [...(byArea.get(area) ?? []), action]);
  }

  const lines = [
    "# Permissions",
    "",
    "<!-- Generated from lib/permissions.ts by `npm run docs:permissions`; do not edit by hand. -->",
    "",
    "Which role may perform each action, generated from the permission matrix in",
    "`lib/permissions.ts`. Every service checks the same matrix before it reads or writes; the",
    "admin screens use it only to hide controls.",
    "",
    "- **All**: on every branch's records.",
    "- **Own branch**: only on records of the user's own branch; another branch's record",
    "  answers 404, as if it did not exist.",
    "- **—**: refused (403).",
    "- **Public**: anonymous visitors may also perform the action.",
  ];
  for (const [area, actions] of byArea) {
    lines.push(
      "",
      `## ${AREAS[area] ?? area}`,
      "",
      `| Action | ${ROLES.map((role) => ROLE_LABELS[role]).join(" | ")} | Public |`,
      `| --- | ${ROLES.map(() => "---").join(" | ")} | --- |`,
      ...actions.map(
        (action) =>
          `| \`${action}\` | ${ROLES.map((role) => cell(role, action)).join(" | ")} | ${
            isPublic(action) ? "Yes" : ""
          } |`,
      ),
    );
  }
  return `${lines.join("\n")}\n`;
}
