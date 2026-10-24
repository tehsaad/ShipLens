import { z } from "zod";
import { ReportStatus } from "@/lib/generated/prisma/enums";
import { dateOnlySchema, optionalText } from "@/lib/validation/common";

/** The Monday a weekly report starts on (WeeklyReport.weekStart, section 5). */
export const weekStartSchema = dateOnlySchema.refine((date) => date.getUTCDay() === 1, {
  message: "A report week starts on a Monday.",
});

/** The version the user saw, for optimistic locking (section 6.4). */
export const versionSchema = z.coerce.number().int().min(1);

export const reportNotesSchema = z.object({
  version: versionSchema,
  leadNotes: optionalText(2000),
});

export const reportTransitionSchema = z.object({ version: versionSchema });

export const returnReportSchema = z.object({
  version: versionSchema,
  comment: z
    .string()
    .trim()
    .min(3, "Explain what the Branch Lead needs to fix.")
    .max(2000, "Use at most 2000 characters."),
});

export const approveReportSchema = z.object({
  version: versionSchema,
  comment: optionalText(2000),
});

export const reportFiltersSchema = z.object({
  status: z.enum(ReportStatus).nullable().catch(null),
  branchId: z.uuid().nullable().catch(null),
});

/** The monthly branch summary PDF: a branch (ignored for a Branch Lead) and a YYYY-MM month. */
export const monthlySummarySchema = z.object({
  branchId: z.uuid({ message: "Choose a branch." }).nullable(),
  month: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/, "Choose a month."),
});

export type MonthlySummaryInput = z.infer<typeof monthlySummarySchema>;
