"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import type { FormState } from "@/lib/form-state";
import { invalid, runForm, serviceContext } from "@/lib/server-action";
import {
  changeMemberBranch,
  changeMemberStatus,
  updateMemberContact,
} from "@/lib/services/members";
import { field, uuidSchema } from "@/lib/validation/common";
import {
  memberBranchSchema,
  memberContactSchema,
  memberStatusSchema,
} from "@/lib/validation/members";

export async function updateContactAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = uuidSchema.parse(field(formData, "id"));
  const parsed = memberContactSchema.safeParse({
    fullName: field(formData, "fullName"),
    email: field(formData, "email"),
    phone: field(formData, "phone"),
  });
  if (!parsed.success) return invalid(parsed.error, formData);
  const state = await runForm(formData, async () => {
    await updateMemberContact(await serviceContext(user), id, parsed.data);
    return "Contact details saved.";
  });
  revalidatePath(`/admin/members/${id}`);
  return state;
}

export async function changeStatusAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = uuidSchema.parse(field(formData, "id"));
  const parsed = memberStatusSchema.safeParse({ status: field(formData, "status") });
  if (!parsed.success) return invalid(parsed.error, formData);
  const state = await runForm(formData, async () => {
    await changeMemberStatus(await serviceContext(user), id, parsed.data.status);
    return "Status changed.";
  });
  revalidatePath(`/admin/members/${id}`);
  return state;
}

export async function changeBranchAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = uuidSchema.parse(field(formData, "id"));
  const parsed = memberBranchSchema.safeParse({ branchId: field(formData, "branchId") });
  if (!parsed.success) return invalid(parsed.error, formData);
  const state = await runForm(formData, async () => {
    await changeMemberBranch(await serviceContext(user), id, parsed.data.branchId);
    return "Member moved. Team assignments in the old branch were removed.";
  });
  revalidatePath(`/admin/members/${id}`);
  return state;
}
