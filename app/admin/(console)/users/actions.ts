"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import type { FormState } from "@/lib/form-state";
import { invalid, runForm, serviceContext } from "@/lib/server-action";
import { createUser, resetUserPassword, setUserActive, updateUser } from "@/lib/services/users";
import { field, uuidSchema } from "@/lib/validation/common";
import { createUserSchema, resetPasswordSchema, updateUserSchema } from "@/lib/validation/users";

export async function createUserAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = createUserSchema.safeParse({
    name: field(formData, "name"),
    email: field(formData, "email"),
    role: field(formData, "role"),
    branchId: field(formData, "branchId"),
    password: field(formData, "password"),
  });
  if (!parsed.success) return invalid(parsed.error);
  let id = "";
  const state = await runForm(async () => {
    id = (await createUser(await serviceContext(user), parsed.data)).id;
  });
  if (state.error) return state;
  redirect(`/admin/users/${id}`);
}

export async function updateUserAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = uuidSchema.parse(field(formData, "id"));
  const parsed = updateUserSchema.safeParse({
    name: field(formData, "name"),
    role: field(formData, "role"),
    branchId: field(formData, "branchId"),
    locale: field(formData, "locale"),
  });
  if (!parsed.success) return invalid(parsed.error);
  const state = await runForm(async () => {
    await updateUser(await serviceContext(user), id, parsed.data);
    return "User saved.";
  });
  revalidatePath(`/admin/users/${id}`);
  return state;
}

export async function setUserActiveAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = uuidSchema.parse(field(formData, "id"));
  const active = field(formData, "active") === "true";
  const state = await runForm(async () => {
    await setUserActive(await serviceContext(user), id, active);
    return active ? "Account reactivated." : "Account deactivated.";
  });
  revalidatePath(`/admin/users/${id}`);
  return state;
}

export async function resetPasswordAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = uuidSchema.parse(field(formData, "id"));
  const parsed = resetPasswordSchema.safeParse({ password: field(formData, "password") });
  if (!parsed.success) return invalid(parsed.error);
  const state = await runForm(async () => {
    await resetUserPassword(await serviceContext(user), id, parsed.data.password);
    return "Password reset. The user must choose a new one at next sign-in.";
  });
  revalidatePath(`/admin/users/${id}`);
  return state;
}
