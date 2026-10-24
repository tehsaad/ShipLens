import { describe, expect, it } from "vitest";
import { z } from "zod";
import { changePasswordSchema, loginSchema } from "@/lib/validation/auth";
import { createBranchSchema, updateBranchSchema } from "@/lib/validation/branches";
import {
  collectionFiltersSchema,
  collectionSchema,
  correctionSchema,
  routingSchema,
} from "@/lib/validation/collections";
import {
  amountSchema,
  dateOnlySchema,
  emailSchema,
  field,
  filtersFrom,
  optionalDateOnly,
  optionalEmail,
  optionalText,
  optionalUuid,
  pageSchema,
  phoneSchema,
} from "@/lib/validation/common";
import { createContentSchema, slugSchema, updateContentSchema } from "@/lib/validation/content";
import {
  createTeamSchema,
  memberContactSchema,
  memberFiltersSchema,
  teamAssignmentSchema,
} from "@/lib/validation/members";
import {
  approveReportSchema,
  monthlySummarySchema,
  reportFiltersSchema,
  reportNotesSchema,
  returnReportSchema,
  weekStartSchema,
} from "@/lib/validation/reports";

const UUID = "0b6f2c1e-8d2a-4c51-9a0e-3f4b5c6d7e8f";

/** The first error message for each failing field. */
function errors(schema: z.ZodType, input: unknown): Record<string, string | undefined> {
  const result = schema.safeParse(input);
  if (result.success) return {};
  const fields = z.flattenError(result.error).fieldErrors as Record<string, string[]>;
  return Object.fromEntries(Object.entries(fields).map(([key, list]) => [key, list[0]]));
}

describe("shared field rules", () => {
  it("normalises Pakistani phone numbers to the +92 form", () => {
    for (const input of ["+92 300 1234567", "0092-300-1234567", "0300 1234567", "(0300)1234567"]) {
      expect(phoneSchema.parse(input)).toBe("+923001234567");
    }
    for (const input of ["+44 20 7946 0958", "0300 123456", "0300 12345678", "phone"]) {
      expect(phoneSchema.safeParse(input).success).toBe(false);
    }
  });

  it("lowercases emails and treats blank optional values as null", () => {
    expect(emailSchema.parse("  Rehan.Saleem@Example.ORG ")).toBe("rehan.saleem@example.org");
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
    expect(optionalEmail.parse("")).toBeNull();
    expect(optionalEmail.parse(undefined)).toBeNull();
    expect(optionalEmail.safeParse("nope").success).toBe(false);
    expect(optionalText(5).parse("   ")).toBeNull();
    expect(optionalText(5).parse(undefined)).toBeNull();
    expect(optionalText(5).safeParse("123456").success).toBe(false);
    expect(optionalUuid.parse("")).toBeNull();
    expect(optionalUuid.parse(UUID)).toBe(UUID);
    expect(optionalDateOnly.parse("")).toBeNull();
  });

  it("accepts calendar dates and PKR amounts only", () => {
    expect(dateOnlySchema.parse("2026-09-21")).toEqual(new Date("2026-09-21T00:00:00Z"));
    expect(dateOnlySchema.safeParse("2026-02-30").success).toBe(false);
    expect(dateOnlySchema.safeParse("21/09/2026").success).toBe(false);
    expect(amountSchema.parse("1250.5")).toBe("1250.50");
    expect(amountSchema.safeParse("12.345").success).toBe(false);
    expect(amountSchema.safeParse("1e3").success).toBe(false);
  });

  it("falls back to page 1 for any page number out of range", () => {
    expect(pageSchema.parse("3")).toBe(3);
    for (const input of ["0", "-1", "abc", "10001", undefined]) {
      expect(pageSchema.parse(input)).toBe(1);
    }
  });

  it("reads form fields and query filters with blanks as missing", () => {
    const form = new FormData();
    form.set("name", "Karachi");
    form.set("file", new Blob(["x"]));
    expect(field(form, "name")).toBe("Karachi");
    expect(field(form, "file")).toBe("");
    expect(field(form, "missing")).toBe("");

    const params = new URLSearchParams({ status: "", branchId: UUID, ignored: "x" });
    expect(filtersFrom(reportFiltersSchema, params)).toEqual({ status: null, branchId: UUID });
  });
});

describe("list filters", () => {
  it("ignores invalid filter values instead of failing the page", () => {
    expect(
      collectionFiltersSchema.parse({
        branchId: "not-a-uuid",
        purpose: "DONATION",
        routed: "maybe",
        from: "2026-13-01",
        to: "2026-10-01",
      }),
    ).toEqual({
      branchId: null,
      purpose: "DONATION",
      routed: null,
      from: null,
      to: new Date("2026-10-01T00:00:00Z"),
    });
    expect(
      memberFiltersSchema.parse({
        q: " Ali ",
        branchId: null,
        teamId: "x",
        status: "GONE",
        joinedFrom: null,
        joinedTo: null,
      }),
    ).toMatchObject({ q: "Ali", teamId: null, status: null });
    expect(reportFiltersSchema.parse({ status: "LOCKED", branchId: UUID })).toEqual({
      status: null,
      branchId: UUID,
    });
  });
});

describe("weekly report input (section 6.4)", () => {
  it("starts a report week on a Monday", () => {
    expect(weekStartSchema.parse("2026-09-21")).toEqual(new Date("2026-09-21T00:00:00Z"));
    expect(errors(z.object({ week: weekStartSchema }), { week: "2026-09-22" })).toEqual({
      week: "A report week starts on a Monday.",
    });
  });

  it("requires the version seen and a comment when returning", () => {
    expect(reportNotesSchema.parse({ version: "2", leadNotes: "" })).toEqual({
      version: 2,
      leadNotes: null,
    });
    expect(errors(returnReportSchema, { version: "0", comment: "  " })).toEqual({
      version: expect.any(String),
      comment: "Explain what the Branch Lead needs to fix.",
    });
    expect(approveReportSchema.parse({ version: "3" })).toEqual({ version: 3, comment: null });
  });

  it("accepts a YYYY-MM month for the monthly summary", () => {
    expect(monthlySummarySchema.parse({ branchId: null, month: "2026-09" }).month).toBe("2026-09");
    for (const month of ["2026-13", "2026-9", "09-2026", ""]) {
      expect(errors(monthlySummarySchema, { branchId: null, month })).toEqual({
        month: "Choose a month.",
      });
    }
  });
});

describe("collection input (section 6.3)", () => {
  it("validates an entry, a correction and a routing reference", () => {
    expect(
      collectionSchema.parse({
        amount: "500",
        collectedOn: "2026-10-01",
        purpose: "GENERAL",
        description: "",
      }),
    ).toEqual({
      amount: "500.00",
      collectedOn: new Date("2026-10-01T00:00:00Z"),
      purpose: "GENERAL",
      description: null,
    });
    expect(errors(collectionSchema, { amount: "", collectedOn: "", purpose: "GIFT" })).toEqual({
      amount: "Enter an amount in PKR with at most two decimals.",
      collectedOn: "Enter a valid date.",
      purpose: "Choose a purpose.",
    });
    expect(correctionSchema.parse({ amount: "-50", correctionNote: " Typo " })).toEqual({
      amount: "-50.00",
      correctionNote: "Typo",
    });
    expect(errors(correctionSchema, { amount: "-50", correctionNote: "x" })).toEqual({
      correctionNote: "Explain the correction.",
    });
    expect(errors(routingSchema, { routingReference: " " })).toEqual({
      routingReference: "Enter the transfer or deposit reference.",
    });
  });
});

describe("members, teams and branches", () => {
  it("validates contact details and team assignments", () => {
    expect(
      memberContactSchema.parse({
        fullName: " Sana Iqbal ",
        email: "Sana@Example.org",
        phone: "0321 7654321",
      }),
    ).toEqual({ fullName: "Sana Iqbal", email: "sana@example.org", phone: "+923217654321" });
    expect(createTeamSchema.parse({ name: "Food drive", branchId: "x" })).toEqual({
      name: "Food drive",
      branchId: null,
    });
    expect(errors(teamAssignmentSchema, { memberId: "x" })).toEqual({ memberId: "Not found." });
  });

  it("needs three Latin letters in a branch city, which form the code", () => {
    expect(
      createBranchSchema.parse({ name: "Clifton", city: "Karachi", contactEmail: "" }),
    ).toEqual({ name: "Clifton", city: "Karachi", contactEmail: null });
    expect(errors(createBranchSchema, { name: "Clifton", city: "کراچی" })).toEqual({
      city: "The city needs at least three Latin letters (they form the branch code).",
    });
    expect(updateBranchSchema.parse({ name: "Clifton", leadUserId: "" })).toEqual({
      name: "Clifton",
      contactEmail: null,
      leadUserId: null,
    });
  });
});

describe("content", () => {
  it("accepts URL-safe slugs only", () => {
    expect(slugSchema.parse(" Winter-Drive-2026 ")).toBe("winter-drive-2026");
    for (const slug of ["a", "winter drive", "winter--drive", "-winter", "شیپ"]) {
      expect(slugSchema.safeParse(slug).success).toBe(false);
    }
  });

  it("validates new and edited entries", () => {
    expect(
      errors(createContentSchema, { type: "POST", slug: "ok-slug", locale: "fr", title: "T" }),
    ).toEqual({
      type: "Choose a type.",
      locale: "Choose a language.",
      title: "Use at least 2 characters.",
      body: expect.any(String),
    });
    expect(updateContentSchema.parse({ title: "About us", body: "Text" })).toEqual({
      title: "About us",
      body: "Text",
    });
  });
});

describe("sign-in and password change", () => {
  it("checks only presence and size at sign-in", () => {
    expect(loginSchema.safeParse({ email: "x", password: "y" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: " ", password: "y" }).success).toBe(false);
  });

  it("needs a new, confirmed password of the minimum length", () => {
    const current = "current-password-1";
    expect(
      errors(changePasswordSchema, {
        currentPassword: current,
        newPassword: "short",
        confirmPassword: "short",
      }).newPassword,
    ).toMatch(/^Use at least \d+ characters\.$/);
    expect(
      errors(changePasswordSchema, {
        currentPassword: current,
        newPassword: "a-new-password-2",
        confirmPassword: "a-new-password-3",
      }),
    ).toEqual({ confirmPassword: "The passwords do not match." });
    expect(
      errors(changePasswordSchema, {
        currentPassword: current,
        newPassword: current,
        confirmPassword: current,
      }),
    ).toEqual({ newPassword: "Choose a new password that differs from the current one." });
  });
});
