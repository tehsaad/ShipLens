/**
 * Deterministic sample data for docs/SPEC.md section 10. Every value and date is fixed, so
 * the seeded database (and therefore the dashboard) is the same on every run. Dates are
 * calendar dates relative to SEED_ANCHOR, the last day the sample data covers.
 */
import { createHash } from "node:crypto";
import { addDays, formatDateOnly, parseDateOnly } from "../../lib/dates";

/** The last date covered by the sample data (a Sunday). */
export const SEED_ANCHOR = "2026-10-18";

export const DEMO_DOMAIN = "demo.hamqadam.test";

/**
 * The demo accounts' domain under the project's competition name, before it became Hamqadam.
 * Accounts created then are moved to DEMO_DOMAIN by the seed (run.ts).
 */
export const LEGACY_DEMO_DOMAIN = "demo.shiplens.test";

/**
 * Stable UUID for a seed record, derived from its kind and key (UUID v5 layout). The salt
 * keeps the project's competition name on purpose: the live database's demo records carry
 * these ids, and a new salt would make the seed create every record a second time.
 */
export function seedId(kind: string, key: string | number): string {
  const bytes = createHash("sha1").update(`shiplens-seed:${kind}:${key}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const anchor = parseDateOnly(SEED_ANCHOR);
const daysBeforeAnchor = (days: number) => formatDateOnly(addDays(anchor, -days));
/** A timestamp on a calendar date, at the given hour in Asia/Karachi (UTC+5). */
const at = (date: string, karachiHour: number) =>
  new Date(`${date}T${String(karachiHour - 5).padStart(2, "0")}:00:00.000Z`);

// ---------------------------------------------------------------------------
// Branches: 6 (4 ACTIVE, 1 FORMING, 1 PAUSED)
// ---------------------------------------------------------------------------

export type SeedBranch = {
  id: string;
  code: string;
  name: string;
  city: string;
  status: "FORMING" | "ACTIVE" | "PAUSED";
  openedAt: string | null;
  contactEmail: string | null;
};

export const branches: SeedBranch[] = [
  ["BR-KAR-001", "Karachi Central", "Karachi", "ACTIVE", "2024-03-01"],
  ["BR-KAR-002", "Karachi East", "Karachi", "ACTIVE", "2024-09-15"],
  ["BR-LAH-001", "Lahore Main", "Lahore", "ACTIVE", "2024-05-10"],
  ["BR-ISL-001", "Islamabad", "Islamabad", "ACTIVE", "2025-01-20"],
  ["BR-PES-001", "Peshawar", "Peshawar", "PAUSED", "2024-11-05"],
  ["BR-MUL-001", "Multan", "Multan", "FORMING", null],
].map(([code, name, city, status, openedAt]) => ({
  id: seedId("branch", code!),
  code: code!,
  name: name!,
  city: city!,
  status: status as SeedBranch["status"],
  openedAt: openedAt ?? null,
  contactEmail: status === "FORMING" ? null : `${code!.toLowerCase()}@${DEMO_DOMAIN}`,
}));

/** Branches that run programmes in the sample data (everything except FORMING). */
const operatingBranches = branches.filter((branch) => branch.status !== "FORMING");
const activeBranches = branches.filter((branch) => branch.status === "ACTIVE");

// ---------------------------------------------------------------------------
// Users: one per role, plus one BRANCH_LEAD per branch (decision 11)
// ---------------------------------------------------------------------------

export type SeedUser = {
  id: string;
  email: string;
  name: string;
  role: "SUPER_ADMIN" | "FINANCE_REVIEWER" | "CONTENT_EDITOR" | "HR_LEAD" | "BRANCH_LEAD";
  branchId: string | null;
};

const staff: SeedUser[] = [
  ["super.admin", "Ayesha Siddiqui", "SUPER_ADMIN"],
  ["finance.reviewer", "Bilal Ahmed", "FINANCE_REVIEWER"],
  ["content.editor", "Sana Malik", "CONTENT_EDITOR"],
  ["hr.lead", "Usman Tariq", "HR_LEAD"],
].map(([local, name, role]) => ({
  id: seedId("user", local!),
  email: `${local}@${DEMO_DOMAIN}`,
  name: name!,
  role: role as SeedUser["role"],
  branchId: null,
}));

const leadNames = ["Farah Khan", "Imran Shah", "Nadia Hussain", "Omar Farooq", "Zainab Raza"];
const branchLeads: SeedUser[] = branches.map((branch, index) => {
  const local = `lead.${branch.code.slice(3).replace("-", "").toLowerCase()}`;
  return {
    id: seedId("user", local),
    email: `${local}@${DEMO_DOMAIN}`,
    name: leadNames[index] ?? "Hamza Qureshi",
    role: "BRANCH_LEAD",
    branchId: branch.id,
  };
});

export const users: SeedUser[] = [...staff, ...branchLeads];

/** The demo login for each role (section 10). The Branch Lead belongs to an ACTIVE branch. */
export const demoLogins = {
  SUPER_ADMIN: staff[0]!.email,
  FINANCE_REVIEWER: staff[1]!.email,
  CONTENT_EDITOR: staff[2]!.email,
  HR_LEAD: staff[3]!.email,
  BRANCH_LEAD: branchLeads[0]!.email,
} as const;

export const branchLeadFor = (branchId: string) =>
  branchLeads.find((lead) => lead.branchId === branchId)!;

const financeReviewer = staff[1]!;
const contentEditor = staff[2]!;
const hrLead = staff[3]!;

// ---------------------------------------------------------------------------
// Teams: two per operating branch
// ---------------------------------------------------------------------------

export type SeedTeam = { id: string; name: string; branchId: string };

const TEAM_NAMES = ["Fundraising", "Community Outreach"];
export const teams: SeedTeam[] = operatingBranches.flatMap((branch) =>
  TEAM_NAMES.map((name) => ({
    id: seedId("team", `${branch.code}:${name}`),
    name,
    branchId: branch.id,
  })),
);

// ---------------------------------------------------------------------------
// Members: 40 across the operating branches, 8 each
// ---------------------------------------------------------------------------

const MEMBER_NAMES = [
  "Ali Raza",
  "Hira Naveed",
  "Kamran Akhtar",
  "Maryam Javed",
  "Saad Iqbal",
  "Mehwish Anwar",
  "Asad Mehmood",
  "Rabia Saleem",
  "Fahad Nawaz",
  "Iqra Shafiq",
  "Danish Ali",
  "Amna Riaz",
  "Talha Yousaf",
  "Sidra Kamal",
  "Waqas Hameed",
  "Noor Fatima",
  "Junaid Aslam",
  "Ayesha Imran",
  "Hassan Mirza",
  "Komal Rashid",
  "Zeeshan Haider",
  "Areeba Khalid",
  "Adeel Butt",
  "Mahnoor Zafar",
  "Rizwan Ashraf",
  "Anum Sheikh",
  "Shahzaib Latif",
  "Tehreem Abbas",
  "Nabeel Sadiq",
  "Laiba Hassan",
  "Fawad Chaudhry",
  "Sana Qamar",
  "Haris Rafiq",
  "Zara Ahmed",
  "Moiz Ansari",
  "Hafsa Tariq",
  "Umer Saeed",
  "Minahil Asif",
  "Yasir Jamil",
  "Esha Waheed",
];

export type SeedMember = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  branchId: string;
  status: "ACTIVE" | "INACTIVE" | "ON_LEAVE";
  joinedAt: string;
  teamIds: { teamId: string; roleInTeam: string }[];
};

const emailLocal = (name: string) => name.toLowerCase().replace(/[^a-z]+/g, ".");

export const members: SeedMember[] = MEMBER_NAMES.map((fullName, index) => {
  const branch = operatingBranches[Math.floor(index / 8)]!;
  const branchTeams = teams.filter((team) => team.branchId === branch.id);
  const primary = branchTeams[index % 2]!;
  const teamIds = [{ teamId: primary.id, roleInTeam: "Volunteer" }];
  if (index % 4 === 0)
    teamIds.push({ teamId: branchTeams[(index + 1) % 2]!.id, roleInTeam: "Coordinator" });
  return {
    id: seedId("member", index),
    fullName,
    email: `${emailLocal(fullName)}@example.org`,
    phone: `0300${String(1_000_000 + index * 7_919).padStart(7, "0")}`,
    branchId: branch.id,
    status: index % 10 === 7 ? "INACTIVE" : index % 10 === 9 ? "ON_LEAVE" : "ACTIVE",
    joinedAt: daysBeforeAnchor(index * 9 + 5),
    teamIds,
  };
});

// ---------------------------------------------------------------------------
// Applications: 20 (8 ACCEPTED and linked to members, 4 DECLINED, 8 NEW)
// ---------------------------------------------------------------------------

export type SeedApplication = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  preferredBranchId: string;
  skills: string;
  availability: "WEEKDAYS" | "WEEKENDS" | "FLEXIBLE";
  motivation: string;
  status: "NEW" | "ACCEPTED" | "DECLINED";
  createdAt: Date;
  decidedById: string | null;
  decidedAt: Date | null;
  declineReason: string | null;
  memberId: string | null;
};

const AVAILABILITY = ["WEEKDAYS", "WEEKENDS", "FLEXIBLE"] as const;
const SKILLS = ["Teaching", "Event planning", "Accounting", "Social media", "First aid"];
const MOTIVATION =
  "I want to give my weekends to people in my city and learn how a branch runs its programmes.";
const APPLICANT_NAMES = [
  "Bushra Nadeem",
  "Arslan Pervez",
  "Mariam Sohail",
  "Taimoor Aziz",
  "Kinza Farhan",
  "Shoaib Akram",
  "Hina Altaf",
  "Daniyal Rauf",
  "Rida Mansoor",
  "Uzair Malik",
  "Sobia Ghani",
  "Hamid Raza",
];

export const applications: SeedApplication[] = Array.from({ length: 20 }, (_, index) => {
  const availability = AVAILABILITY[index % 3]!;
  const skills = SKILLS[index % SKILLS.length]!;
  if (index < 8) {
    const member = members[index * 5]!;
    const joined = parseDateOnly(member.joinedAt);
    return {
      id: seedId("application", index),
      fullName: member.fullName,
      email: member.email,
      phone: member.phone,
      preferredBranchId: member.branchId,
      skills,
      availability,
      motivation: MOTIVATION,
      status: "ACCEPTED",
      createdAt: at(formatDateOnly(addDays(joined, -10)), 11),
      decidedById: hrLead.id,
      decidedAt: at(formatDateOnly(addDays(joined, -1)), 15),
      declineReason: null,
      memberId: member.id,
    };
  }
  const name = APPLICANT_NAMES[index - 8]!;
  const declined = index < 12;
  const created = daysBeforeAnchor(declined ? 40 + index * 3 : index - 10);
  return {
    id: seedId("application", index),
    fullName: name,
    email: `${emailLocal(name)}@example.org`,
    phone: `0321${String(2_000_000 + index * 4_513).padStart(7, "0")}`,
    preferredBranchId: activeBranches[index % activeBranches.length]!.id,
    skills,
    availability,
    motivation: MOTIVATION,
    status: declined ? "DECLINED" : "NEW",
    createdAt: at(created, 10),
    decidedById: declined ? hrLead.id : null,
    decidedAt: declined ? at(formatDateOnly(addDays(parseDateOnly(created), 5)), 16) : null,
    declineReason: declined ? "No openings in the preferred branch this term." : null,
    memberId: null,
  };
});

// ---------------------------------------------------------------------------
// Collections: 120 across the 12 months ending at SEED_ANCHOR (10 per month)
// ---------------------------------------------------------------------------

export type SeedCollection = {
  id: string;
  branchId: string;
  amount: string;
  collectedOn: string;
  purpose: "GENERAL" | "EVENT" | "DONATION" | "OTHER";
  description: string;
  enteredById: string;
  createdAt: Date;
  routedAt: Date | null;
  routedById: string | null;
  routingReference: string | null;
};

const PURPOSES = ["GENERAL", "DONATION", "EVENT", "GENERAL", "OTHER"] as const;
const DESCRIPTIONS: Record<SeedCollection["purpose"], string> = {
  GENERAL: "Weekly collection",
  DONATION: "Donation box",
  EVENT: "Community event",
  OTHER: "Book sale",
};
/** The Peshawar branch is PAUSED from month 7 (June 2026) onward. */
const PAUSED_FROM_MONTH = 7;

export const collections: SeedCollection[] = Array.from({ length: 120 }, (_, index) => {
  const month = Math.floor(index / 10); // 0 = November 2025 ... 11 = October 2026
  const slot = index % 10;
  const branchPool = month < PAUSED_FROM_MONTH ? operatingBranches : activeBranches;
  const branch = branchPool[slot % branchPool.length]!;
  const monthStart = new Date(Date.UTC(2025, 10 + month, 1));
  const day = 1 + ((slot * 7 + month * 3) % 18);
  const collectedOn = formatDateOnly(addDays(monthStart, day - 1));
  const purpose = PURPOSES[index % PURPOSES.length]!;
  const routed = month <= 9 && index % 7 !== 3;
  return {
    id: seedId("collection", index),
    branchId: branch.id,
    amount: `${500 * (2 + ((index * 37) % 19))}.00`,
    collectedOn,
    purpose,
    description: DESCRIPTIONS[purpose],
    enteredById: branchLeadFor(branch.id).id,
    createdAt: at(formatDateOnly(addDays(parseDateOnly(collectedOn), 1)), 9),
    routedAt: routed ? at(formatDateOnly(addDays(parseDateOnly(collectedOn), 12)), 10) : null,
    routedById: routed ? financeReviewer.id : null,
    routingReference: routed
      ? `MA-${collectedOn.slice(0, 7)}-${String(index).padStart(3, "0")}`
      : null,
  };
});

// ---------------------------------------------------------------------------
// Weekly reports: 8 in mixed states
// ---------------------------------------------------------------------------

export type SeedReport = {
  id: string;
  branchId: string;
  weekStart: string;
  status: "DRAFT" | "SUBMITTED" | "RETURNED" | "APPROVED";
  leadNotes: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  reviewComment: string | null;
  approvedAt: Date | null;
  version: number;
};

// [index into activeBranches, weekStart, status]; every week chosen has collections.
const REPORT_PLAN: [number, string, SeedReport["status"]][] = [
  [0, "2026-09-07", "APPROVED"],
  [1, "2026-09-07", "APPROVED"],
  [2, "2026-09-07", "APPROVED"],
  [0, "2026-09-14", "SUBMITTED"],
  [3, "2026-09-28", "SUBMITTED"],
  [1, "2026-10-05", "RETURNED"],
  [0, "2026-10-12", "DRAFT"],
  [2, "2026-10-12", "DRAFT"],
];

export const reports: SeedReport[] = REPORT_PLAN.map(([branchIndex, weekStart, status]) => {
  const branch = activeBranches[branchIndex]!;
  const nextMonday = formatDateOnly(addDays(parseDateOnly(weekStart), 7));
  const reviewDay = formatDateOnly(addDays(parseDateOnly(weekStart), 9));
  const submitted = status !== "DRAFT";
  const reviewed = status === "APPROVED" || status === "RETURNED";
  return {
    id: seedId("report", `${branch.code}:${weekStart}`),
    branchId: branch.id,
    weekStart,
    status,
    leadNotes: submitted ? "All entries match the receipt book." : null,
    submittedAt: submitted ? at(nextMonday, 12) : null,
    reviewedAt: reviewed ? at(reviewDay, 14) : null,
    reviewComment:
      status === "RETURNED" ? "Please add the receipt numbers for the donation box entries." : null,
    approvedAt: status === "APPROVED" ? at(reviewDay, 14) : null,
    version: { DRAFT: 1, SUBMITTED: 2, RETURNED: 3, APPROVED: 3 }[status],
  };
});

export const reportSubmitterId = (report: SeedReport) =>
  report.submittedAt ? branchLeadFor(report.branchId).id : null;
export const reportReviewerId = (report: SeedReport) =>
  report.reviewedAt ? financeReviewer.id : null;

// ---------------------------------------------------------------------------
// Site content: 6 published entries, 2 events, 1 contact message
// ---------------------------------------------------------------------------

export type SeedContent = {
  id: string;
  type: "PAGE" | "PROGRAM" | "ANNOUNCEMENT";
  slug: string;
  locale: "en" | "ur";
  title: string;
  body: string;
  publishedAt: Date;
  updatedById: string;
};

export const contentEntries: SeedContent[] = (
  [
    [
      "PAGE",
      "about",
      "en",
      "About us",
      "We connect volunteer branches across Pakistan to one head office.",
    ],
    [
      "PAGE",
      "about",
      "ur",
      "ہمارے بارے میں",
      "ہم پاکستان بھر کی رضاکار شاخوں کو ایک ہیڈ آفس سے جوڑتے ہیں۔",
    ],
    ["PROGRAM", "program-one", "en", "Program One", "Weekend tutoring for school students."],
    ["PROGRAM", "program-one", "ur", "پروگرام ایک", "اسکول کے طلبہ کے لیے ہفتہ وار ٹیوشن۔"],
    ["PROGRAM", "program-two", "en", "Program Two", "Seasonal food and clothing drives."],
    [
      "ANNOUNCEMENT",
      "applications-open",
      "en",
      "Applications are open",
      "Apply to volunteer with a branch near you.",
    ],
  ] as const
).map(([type, slug, locale, title, body], index) => ({
  id: seedId("content", `${type}:${slug}:${locale}`),
  type,
  slug,
  locale,
  title,
  body,
  publishedAt: at(daysBeforeAnchor(60 - index), 10),
  updatedById: contentEditor.id,
}));

export const events = [
  {
    id: seedId("event", "iftar-drive-2026"),
    titleEn: "Community Iftar Drive",
    titleUr: "کمیونٹی افطار مہم",
    startsAt: at("2026-09-20", 17),
    endsAt: at("2026-09-20", 20),
    location: "Karachi Central community hall",
    branchId: activeBranches[0]!.id,
  },
  {
    id: seedId("event", "winter-clothing-2026"),
    titleEn: "Winter Clothing Collection",
    titleUr: null,
    startsAt: at("2026-11-15", 10),
    endsAt: at("2026-11-15", 16),
    location: "Lahore Main branch office",
    branchId: activeBranches[2]!.id,
  },
];

export const contactMessage = {
  id: seedId("contact", "first-enquiry"),
  name: "Rehan Saleem",
  email: "rehan.saleem@example.org",
  message: "Does the Islamabad branch need volunteers for the winter drive?",
  receivedAt: at("2026-10-10", 13),
};
