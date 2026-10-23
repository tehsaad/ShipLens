"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import type { FormState } from "@/lib/form-state";
import { revalidatePublicSite } from "@/lib/revalidate-site";
import { invalid, runForm, serviceContext } from "@/lib/server-action";
import {
  createContent,
  discardContentDraft,
  publishContent,
  unpublishContent,
  updateContent,
} from "@/lib/services/content";
import { field, uuidSchema } from "@/lib/validation/common";
import { createContentSchema, updateContentSchema } from "@/lib/validation/content";

export async function createContentAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = createContentSchema.safeParse({
    type: field(formData, "type"),
    slug: field(formData, "slug"),
    locale: field(formData, "locale"),
    title: field(formData, "title"),
    body: field(formData, "body"),
  });
  if (!parsed.success) return invalid(parsed.error, formData);
  let id = "";
  const state = await runForm(formData, async () => {
    id = (await createContent(await serviceContext(user), parsed.data)).id;
  });
  if (state.error) return state;
  redirect(`/admin/content/${id}`);
}

export async function updateContentAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = uuidSchema.parse(field(formData, "id"));
  const parsed = updateContentSchema.safeParse({
    title: field(formData, "title"),
    body: field(formData, "body"),
    slug: formData.has("slug") ? field(formData, "slug") : undefined,
  });
  if (!parsed.success) return invalid(parsed.error, formData);
  const state = await runForm(formData, async () => {
    const { pending } = await updateContent(await serviceContext(user), id, parsed.data);
    return pending
      ? "Saved as a draft. The public page keeps the published version until you republish."
      : "Saved.";
  });
  revalidatePath(`/admin/content/${id}`);
  return state;
}

/** Publish, unpublish or discard the pending draft. */
export async function contentStatusAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = uuidSchema.parse(field(formData, "id"));
  const intent = field(formData, "intent");
  const state = await runForm(formData, async () => {
    const ctx = await serviceContext(user);
    if (intent === "publish") {
      await publishContent(ctx, id);
      return "Published.";
    }
    if (intent === "unpublish") {
      await unpublishContent(ctx, id);
      return "Unpublished. The entry is hidden from the public site.";
    }
    await discardContentDraft(ctx, id);
    return "Pending changes discarded.";
  });
  if (!state.error && intent !== "discard") revalidatePublicSite();
  revalidatePath(`/admin/content/${id}`);
  return state;
}
