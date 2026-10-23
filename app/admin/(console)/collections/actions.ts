"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import type { FormState } from "@/lib/form-state";
import { invalid, runForm, serviceContext } from "@/lib/server-action";
import {
  createCollection,
  createCorrection,
  routeCollection,
  updateCollection,
} from "@/lib/services/collections";
import {
  collectionSchema,
  correctionSchema,
  routingSchema,
  updateCollectionSchema,
} from "@/lib/validation/collections";
import { field, uuidSchema } from "@/lib/validation/common";

export async function createCollectionAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = collectionSchema.safeParse({
    amount: field(formData, "amount"),
    collectedOn: field(formData, "collectedOn"),
    purpose: field(formData, "purpose"),
    description: field(formData, "description"),
  });
  if (!parsed.success) return invalid(parsed.error, formData);
  let id = "";
  const state = await runForm(formData, async () => {
    id = (await createCollection(await serviceContext(user), parsed.data)).id;
  });
  if (state.error) return state;
  redirect(`/admin/collections/${id}`);
}

export async function updateCollectionAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = uuidSchema.parse(field(formData, "id"));
  const parsed = updateCollectionSchema.safeParse({
    amount: field(formData, "amount"),
    collectedOn: field(formData, "collectedOn"),
    purpose: field(formData, "purpose"),
    description: field(formData, "description"),
    correctionNote: field(formData, "correctionNote"),
  });
  if (!parsed.success) return invalid(parsed.error, formData);
  const state = await runForm(formData, async () => {
    await updateCollection(await serviceContext(user), id, parsed.data);
    return "Collection saved.";
  });
  revalidatePath(`/admin/collections/${id}`);
  return state;
}

export async function createCorrectionAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = uuidSchema.parse(field(formData, "id"));
  const parsed = correctionSchema.safeParse({
    amount: field(formData, "amount"),
    correctionNote: field(formData, "correctionNote"),
  });
  if (!parsed.success) return invalid(parsed.error, formData);
  let correctionId = "";
  const state = await runForm(formData, async () => {
    correctionId = (await createCorrection(await serviceContext(user), id, parsed.data)).id;
  });
  if (state.error) return state;
  redirect(`/admin/collections/${correctionId}`);
}

export async function routeCollectionAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = uuidSchema.parse(field(formData, "id"));
  const parsed = routingSchema.safeParse({ routingReference: field(formData, "routingReference") });
  if (!parsed.success) return invalid(parsed.error, formData);
  const state = await runForm(formData, async () => {
    await routeCollection(await serviceContext(user), id, parsed.data.routingReference);
    return "Marked as routed to the main account.";
  });
  revalidatePath(`/admin/collections/${id}`);
  return state;
}
