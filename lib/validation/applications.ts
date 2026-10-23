import { z } from "zod";
import { ApplicationStatus, Availability } from "@/lib/generated/prisma/enums";
import {
  dateOnlySchema,
  optionalDateOnly,
  optionalUuid,
  pakistaniPhone,
} from "@/lib/validation/common";

const publicEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "email")
  .pipe(z.email({ message: "email" }));

/**
 * The public volunteer application (section 7.1). The same schema validates the form in the
 * browser (React Hook Form) and the server action. Its messages are keys under "errors" in
 * messages/{en,ur}.json, so each visitor sees them in their language. No national ID is
 * collected (section 8, data minimisation).
 */
export const applicationSchema = z.object({
  fullName: z.string().trim().min(2, "fullNameShort").max(80, "fullNameLong"),
  email: publicEmail,
  phone: pakistaniPhone("phone"),
  preferredBranchId: z.uuid({ message: "branch" }),
  skills: z.string().trim().max(500, "skillsLong"),
  availability: z.enum(Availability, { message: "availability" }),
  motivation: z.string().trim().min(50, "motivationShort").max(1000, "motivationLong"),
  consentGiven: z.literal(true, { message: "consent" }),
});

/** The public contact form (section 7.1); messages are keys under "errors". */
export const contactSchema = z.object({
  name: z.string().trim().min(2, "nameShort").max(80, "nameLong"),
  email: publicEmail,
  message: z.string().trim().min(10, "messageShort").max(2000, "messageLong"),
});

export type ContactInput = z.infer<typeof contactSchema>;
export type ApplicationInput = z.infer<typeof applicationSchema>;

export const acceptApplicationSchema = z.object({
  /** HR may place the member in another branch than the one the applicant preferred. */
  branchId: optionalUuid,
  joinedAt: optionalDateOnly,
});

export const declineApplicationSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Give an internal reason (it is never shown to the applicant).")
    .max(1000, "Use at most 1000 characters."),
});

export const applicationFiltersSchema = z.object({
  status: z.enum(ApplicationStatus).nullable().catch(null),
  branchId: z.uuid().nullable().catch(null),
  from: dateOnlySchema.nullable().catch(null),
  to: dateOnlySchema.nullable().catch(null),
});

export type AcceptApplicationInput = z.infer<typeof acceptApplicationSchema>;
