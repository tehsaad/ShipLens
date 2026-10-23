import { z } from "zod";
import { Locale, Role } from "@/lib/generated/prisma/enums";
import { emailSchema, optionalUuid, personName } from "@/lib/validation/common";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/validation/limits";

const role = z.enum(Role, { message: "Choose a role." });

/** A Branch Lead needs a branch (section 5); other roles have none. */
function withBranchRule<T extends { role: Role; branchId: string | null }>(
  value: T,
  ctx: z.RefinementCtx,
) {
  if (value.role === "BRANCH_LEAD" && !value.branchId) {
    ctx.addIssue({ code: "custom", path: ["branchId"], message: "A Branch Lead needs a branch." });
  }
}

function normaliseBranch<T extends { role: Role; branchId: string | null }>(value: T): T {
  return value.role === "BRANCH_LEAD" ? value : { ...value, branchId: null };
}

export const temporaryPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters.`);

export const createUserSchema = z
  .object({
    name: personName(2, 100),
    email: emailSchema,
    role,
    branchId: optionalUuid,
    password: temporaryPasswordSchema,
  })
  .superRefine(withBranchRule)
  .transform(normaliseBranch);

export const updateUserSchema = z
  .object({
    name: personName(2, 100),
    role,
    branchId: optionalUuid,
    locale: z.enum(Locale).default("en"),
  })
  .superRefine(withBranchRule)
  .transform(normaliseBranch);

export const resetPasswordSchema = z.object({ password: temporaryPasswordSchema });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
