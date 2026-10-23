"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { weekStartOf } from "@/lib/dates";
import type { FormState } from "@/lib/form-state";
import { invalid, runForm, serviceContext } from "@/lib/server-action";
import {
  approveReport,
  openReport,
  returnReport,
  submitReport,
  updateReportNotes,
} from "@/lib/services/reports";
import { dateOnlySchema, field, uuidSchema } from "@/lib/validation/common";
import {
  approveReportSchema,
  reportNotesSchema,
  reportTransitionSchema,
  returnReportSchema,
} from "@/lib/validation/reports";

/** Week picker: any date opens the report of the Monday-to-Sunday week containing it. */
export async function openReportAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = dateOnlySchema.safeParse(field(formData, "week"));
  if (!parsed.success) return { error: null, fieldErrors: { week: ["Choose a date."] } };
  let id = "";
  const state = await runForm(formData, async () => {
    id = (await openReport(await serviceContext(user), weekStartOf(parsed.data))).id;
  });
  if (state.error) return state;
  redirect(`/admin/reports/${id}`);
}

export async function saveNotesAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = uuidSchema.parse(field(formData, "id"));
  const parsed = reportNotesSchema.safeParse({
    version: field(formData, "version"),
    leadNotes: field(formData, "leadNotes"),
  });
  if (!parsed.success) return invalid(parsed.error, formData);
  const state = await runForm(formData, async () => {
    await updateReportNotes(await serviceContext(user), id, parsed.data);
    return "Notes saved.";
  });
  revalidatePath(`/admin/reports/${id}`);
  return state;
}

export async function submitReportAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = uuidSchema.parse(field(formData, "id"));
  const parsed = reportTransitionSchema.safeParse({ version: field(formData, "version") });
  if (!parsed.success) return invalid(parsed.error, formData);
  const state = await runForm(formData, async () => {
    await submitReport(await serviceContext(user), id, parsed.data.version);
    return "Report submitted for review. Its totals are now frozen.";
  });
  revalidatePath(`/admin/reports/${id}`);
  return state;
}

export async function approveReportAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = uuidSchema.parse(field(formData, "id"));
  const parsed = approveReportSchema.safeParse({
    version: field(formData, "version"),
    comment: field(formData, "comment"),
  });
  if (!parsed.success) return invalid(parsed.error, formData);
  const state = await runForm(formData, async () => {
    await approveReport(await serviceContext(user), id, parsed.data);
    return "Report approved. It and its week's collections are now locked.";
  });
  revalidatePath(`/admin/reports/${id}`);
  return state;
}

export async function returnReportAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = uuidSchema.parse(field(formData, "id"));
  const parsed = returnReportSchema.safeParse({
    version: field(formData, "version"),
    comment: field(formData, "comment"),
  });
  if (!parsed.success) return invalid(parsed.error, formData);
  const state = await runForm(formData, async () => {
    await returnReport(await serviceContext(user), id, parsed.data);
    return "Report returned to the Branch Lead.";
  });
  revalidatePath(`/admin/reports/${id}`);
  return state;
}
