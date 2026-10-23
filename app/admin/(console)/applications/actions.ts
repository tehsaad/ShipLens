"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import type { FormState } from "@/lib/form-state";
import { invalid, runForm, serviceContext } from "@/lib/server-action";
import { acceptApplication, declineApplication } from "@/lib/services/applications";
import { acceptApplicationSchema, declineApplicationSchema } from "@/lib/validation/applications";
import { field, uuidSchema } from "@/lib/validation/common";

export async function acceptApplicationAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const id = uuidSchema.parse(field(formData, "id"));
  const parsed = acceptApplicationSchema.safeParse({
    branchId: field(formData, "branchId"),
    joinedAt: field(formData, "joinedAt"),
  });
  if (!parsed.success) return invalid(parsed.error);
  const state = await runForm(async () => {
    const { memberCode } = await acceptApplication(await serviceContext(user), id, parsed.data);
    return `Accepted. Member ${memberCode} was created.`;
  });
  revalidatePath(`/admin/applications/${id}`);
  return state;
}

export async function declineApplicationAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const id = uuidSchema.parse(field(formData, "id"));
  const parsed = declineApplicationSchema.safeParse({ reason: field(formData, "reason") });
  if (!parsed.success) return invalid(parsed.error);
  const state = await runForm(async () => {
    await declineApplication(await serviceContext(user), id, parsed.data.reason);
    return "Application declined.";
  });
  revalidatePath(`/admin/applications/${id}`);
  return state;
}
