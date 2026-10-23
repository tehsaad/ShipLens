"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import type { FormState } from "@/lib/form-state";
import { revalidatePublicSite } from "@/lib/revalidate-site";
import { invalid, runForm, serviceContext } from "@/lib/server-action";
import { createEvent, setEventPublished, updateEvent } from "@/lib/services/events";
import { field, uuidSchema } from "@/lib/validation/common";
import { eventSchema } from "@/lib/validation/events";

function parse(formData: FormData) {
  return eventSchema.safeParse({
    titleEn: field(formData, "titleEn"),
    titleUr: field(formData, "titleUr"),
    startsAt: field(formData, "startsAt"),
    endsAt: field(formData, "endsAt"),
    location: field(formData, "location"),
    branchId: field(formData, "branchId"),
  });
}

export async function createEventAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = parse(formData);
  if (!parsed.success) return invalid(parsed.error, formData);
  let id = "";
  const state = await runForm(formData, async () => {
    id = (await createEvent(await serviceContext(user), parsed.data)).id;
  });
  if (state.error) return state;
  redirect(`/admin/events/${id}`);
}

export async function updateEventAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = uuidSchema.parse(field(formData, "id"));
  const parsed = parse(formData);
  if (!parsed.success) return invalid(parsed.error, formData);
  const state = await runForm(formData, async () => {
    await updateEvent(await serviceContext(user), id, parsed.data);
    return "Event saved.";
  });
  if (!state.error) revalidatePublicSite();
  revalidatePath(`/admin/events/${id}`);
  return state;
}

export async function publishEventAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = uuidSchema.parse(field(formData, "id"));
  const publish = field(formData, "intent") === "publish";
  const state = await runForm(formData, async () => {
    await setEventPublished(await serviceContext(user), id, publish);
    return publish ? "Published." : "Unpublished.";
  });
  if (!state.error) revalidatePublicSite();
  revalidatePath(`/admin/events/${id}`);
  return state;
}
