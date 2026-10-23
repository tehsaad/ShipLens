"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import type { FormState } from "@/lib/form-state";
import { scopeFor } from "@/lib/permissions";
import { invalid, runForm, serviceContext } from "@/lib/server-action";
import { createTeam, removeTeamMember, renameTeam, setTeamAssignment } from "@/lib/services/teams";
import { field, uuidSchema } from "@/lib/validation/common";
import { createTeamSchema, teamAssignmentSchema, teamSchema } from "@/lib/validation/members";

export async function createTeamAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = createTeamSchema.safeParse({
    name: field(formData, "name"),
    branchId: field(formData, "branchId") || null,
  });
  if (!parsed.success) return invalid(parsed.error);
  // A Branch Lead always creates teams in its own branch.
  const branchId =
    scopeFor(user.role, "team.create") === "ownBranch" ? user.branchId : parsed.data.branchId;
  if (!branchId) return { error: null, fieldErrors: { branchId: ["Choose a branch."] } };
  let id = "";
  const state = await runForm(async () => {
    id = (await createTeam(await serviceContext(user), { branchId, name: parsed.data.name })).id;
  });
  if (state.error) return state;
  redirect(`/admin/teams/${id}`);
}

export async function renameTeamAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = uuidSchema.parse(field(formData, "id"));
  const parsed = teamSchema.safeParse({ name: field(formData, "name") });
  if (!parsed.success) return invalid(parsed.error);
  const state = await runForm(async () => {
    await renameTeam(await serviceContext(user), id, parsed.data.name);
    return "Team renamed.";
  });
  revalidatePath(`/admin/teams/${id}`);
  return state;
}

export async function assignMemberAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = uuidSchema.parse(field(formData, "id"));
  const parsed = teamAssignmentSchema.safeParse({
    memberId: field(formData, "memberId"),
    roleInTeam: field(formData, "roleInTeam"),
  });
  if (!parsed.success) return invalid(parsed.error);
  const state = await runForm(async () => {
    await setTeamAssignment(await serviceContext(user), id, parsed.data);
    return "Team updated.";
  });
  revalidatePath(`/admin/teams/${id}`);
  return state;
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = uuidSchema.parse(field(formData, "id"));
  const memberId = uuidSchema.parse(field(formData, "memberId"));
  await removeTeamMember(await serviceContext(user), id, memberId);
  revalidatePath(`/admin/teams/${id}`);
}
