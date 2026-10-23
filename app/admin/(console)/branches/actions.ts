"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { revalidatePublicSite } from "@/lib/revalidate-site";
import type { FormState } from "@/lib/form-state";
import { invalid, runForm, serviceContext } from "@/lib/server-action";
import { changeBranchStatus, createBranch, updateBranch } from "@/lib/services/branches";
import {
  changeBranchStatusSchema,
  createBranchSchema,
  updateBranchSchema,
} from "@/lib/validation/branches";
import { field, uuidSchema } from "@/lib/validation/common";

export async function createBranchAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = createBranchSchema.safeParse({
    name: field(formData, "name"),
    city: field(formData, "city"),
    contactEmail: field(formData, "contactEmail"),
  });
  if (!parsed.success) return invalid(parsed.error, formData);
  let id = "";
  const state = await runForm(formData, async () => {
    id = (await createBranch(await serviceContext(user), parsed.data)).id;
  });
  if (state.error) return state;
  revalidatePublicSite();
  redirect(`/admin/branches/${id}`);
}

export async function updateBranchAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = uuidSchema.parse(field(formData, "id"));
  const parsed = updateBranchSchema.safeParse({
    name: field(formData, "name"),
    contactEmail: field(formData, "contactEmail"),
    leadUserId: field(formData, "leadUserId"),
  });
  if (!parsed.success) return invalid(parsed.error, formData);
  const state = await runForm(formData, async () => {
    await updateBranch(await serviceContext(user), id, parsed.data);
    return "Branch saved.";
  });
  if (!state.error) revalidatePublicSite();
  revalidatePath(`/admin/branches/${id}`);
  return state;
}

export async function changeBranchStatusAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const id = uuidSchema.parse(field(formData, "id"));
  const parsed = changeBranchStatusSchema.safeParse({ status: field(formData, "status") });
  if (!parsed.success) return invalid(parsed.error, formData);
  const state = await runForm(formData, async () => {
    await changeBranchStatus(await serviceContext(user), id, parsed.data.status);
    return "Status changed.";
  });
  if (!state.error) revalidatePublicSite();
  revalidatePath(`/admin/branches/${id}`);
  return state;
}
