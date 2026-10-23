import { z } from "zod";
import { MemberStatus } from "@/lib/generated/prisma/enums";
import {
  dateOnlySchema,
  emailSchema,
  optionalText,
  personName,
  phoneSchema,
  uuidSchema,
} from "@/lib/validation/common";

/** Decision 3: the fields a Branch Lead (own branch) or Super Admin may edit. */
export const memberContactSchema = z.object({
  fullName: personName(2, 80),
  email: emailSchema,
  phone: phoneSchema,
});

export const memberStatusSchema = z.object({
  status: z.enum(MemberStatus, { message: "Choose a status." }),
});

export const memberBranchSchema = z.object({
  branchId: z.uuid({ message: "Choose a branch." }),
});

export const memberFiltersSchema = z.object({
  q: z.string().trim().max(100).nullable().catch(null),
  branchId: z.uuid().nullable().catch(null),
  teamId: z.uuid().nullable().catch(null),
  status: z.enum(MemberStatus).nullable().catch(null),
  joinedFrom: dateOnlySchema.nullable().catch(null),
  joinedTo: dateOnlySchema.nullable().catch(null),
});

export const teamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Use at least 2 characters.")
    .max(60, "Use at most 60 characters."),
});

export const createTeamSchema = teamSchema.extend({
  /** Ignored for a Branch Lead, whose own branch is always used. */
  branchId: z.uuid().nullable().catch(null),
});

export const teamAssignmentSchema = z.object({
  memberId: uuidSchema,
  roleInTeam: optionalText(60),
});

export type MemberContactInput = z.infer<typeof memberContactSchema>;
export type MemberFilters = z.infer<typeof memberFiltersSchema>;
