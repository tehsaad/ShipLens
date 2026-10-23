/** English labels for enum values on the admin screens (moved to messages/ in Phase 4). */
export const ROLE_LABELS = {
  SUPER_ADMIN: "Super Admin",
  FINANCE_REVIEWER: "Finance Reviewer",
  CONTENT_EDITOR: "Content Editor",
  BRANCH_LEAD: "Branch Lead",
  HR_LEAD: "HR Lead",
} as const;

export const BRANCH_STATUS_LABELS = {
  FORMING: "Forming",
  ACTIVE: "Active",
  PAUSED: "Paused",
  CLOSED: "Closed",
} as const;

export const APPLICATION_STATUS_LABELS = {
  NEW: "New",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
} as const;

export const MEMBER_STATUS_LABELS = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  ON_LEAVE: "On leave",
} as const;

export const AVAILABILITY_LABELS = {
  WEEKDAYS: "Weekdays",
  WEEKENDS: "Weekends",
  FLEXIBLE: "Flexible",
} as const;

export const PURPOSE_LABELS = {
  GENERAL: "General",
  EVENT: "Event",
  DONATION: "Donation",
  OTHER: "Other",
} as const;

export const REPORT_STATUS_LABELS = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  RETURNED: "Returned",
  APPROVED: "Approved",
} as const;

export const CONTENT_TYPE_LABELS = {
  PAGE: "Page",
  PROGRAM: "Program",
  ANNOUNCEMENT: "Announcement",
} as const;

export const LOCALE_LABELS = { en: "English", ur: "Urdu" } as const;
