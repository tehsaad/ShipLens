import { z } from "zod";
import { ApplicationStatus, Availability } from "@/lib/generated/prisma/enums";
import {
  dateOnlySchema,
  emailSchema,
  optionalDateOnly,
  optionalUuid,
  personName,
  phoneSchema,
} from "@/lib/validation/common";

/**
 * The public volunteer application (section 7.1). The same schema validates the form and the
 * server action. No national ID is collected (section 8, data minimisation).
 */
export const applicationSchema = z.object({
  fullName: personName(2, 80),
  email: emailSchema,
  phone: phoneSchema,
  preferredBranchId: z.uuid({ message: "Choose a branch." }),
  skills: z.string().trim().max(500, "Use at most 500 characters."),
  availability: z.enum(Availability, { message: "Choose when you are available." }),
  motivation: z
    .string()
    .trim()
    .min(50, "Tell us a little more: at least 50 characters.")
    .max(1000, "Use at most 1000 characters."),
  consentGiven: z.literal(true, { message: "Please agree so we can contact you." }),
});

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
