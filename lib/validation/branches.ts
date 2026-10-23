import { z } from "zod";
import { BranchStatus } from "@/lib/generated/prisma/enums";
import { cityCodePrefix } from "@/lib/rules/branch";
import { optionalEmail, optionalUuid } from "@/lib/validation/common";

const name = z
  .string()
  .trim()
  .min(2, "Use at least 2 characters.")
  .max(100, "Use at most 100 characters.");

const city = z
  .string()
  .trim()
  .min(2, "Use at least 2 characters.")
  .max(60, "Use at most 60 characters.")
  .refine((value) => cityCodePrefix(value) !== null, {
    message: "The city needs at least three Latin letters (they form the branch code).",
  });

export const createBranchSchema = z.object({
  name,
  city,
  contactEmail: optionalEmail,
});

/** The city is not editable: it is part of the code, which never changes. */
export const updateBranchSchema = z.object({
  name,
  contactEmail: optionalEmail,
  leadUserId: optionalUuid,
});

export const changeBranchStatusSchema = z.object({
  status: z.enum(BranchStatus, { message: "Choose a status." }),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
