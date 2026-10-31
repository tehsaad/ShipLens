"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import type { FormState } from "@/lib/form-state";
import { revalidatePublicSite } from "@/lib/revalidate-site";
import { invalid, runForm, serviceContext } from "@/lib/server-action";
import {
  createResult,
  setResultImage,
  setResultStatus,
  updateResult,
} from "@/lib/services/results";
import { field, uuidSchema } from "@/lib/validation/common";
import {
  imageUploadSchema,
  MAX_IMAGE_BYTES,
  resultSchema,
  sniffImageType,
} from "@/lib/validation/results";

function resultFields(formData: FormData) {
  return {
    titleEn: field(formData, "titleEn"),
    titleUr: field(formData, "titleUr"),
    bodyEn: field(formData, "bodyEn"),
    bodyUr: field(formData, "bodyUr"),
    branchId: field(formData, "branchId"),
    happenedOn: field(formData, "happenedOn"),
  };
}

export async function createResultAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = resultSchema.safeParse(resultFields(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  let id = "";
  const state = await runForm(formData, async () => {
    id = (await createResult(await serviceContext(user), parsed.data)).id;
  });
  if (state.error) return state;
  redirect(`/admin/results/${id}`);
}

export async function updateResultAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = uuidSchema.parse(field(formData, "id"));
  const parsed = resultSchema.safeParse(resultFields(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const state = await runForm(formData, async () => {
    await updateResult(await serviceContext(user), id, parsed.data);
    return "Saved.";
  });
  if (!state.error) revalidatePublicSite();
  revalidatePath(`/admin/results/${id}`);
  return state;
}

export async function resultStatusAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = uuidSchema.parse(field(formData, "id"));
  const publish = field(formData, "intent") === "publish";
  const state = await runForm(formData, async () => {
    await setResultStatus(await serviceContext(user), id, publish);
    return publish ? "Published. It is now on the public results page." : "Unpublished.";
  });
  if (!state.error) revalidatePublicSite();
  revalidatePath(`/admin/results/${id}`);
  return state;
}

export async function setResultImageAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = uuidSchema.parse(field(formData, "id"));
  const alt = imageUploadSchema.safeParse({
    imageAltEn: field(formData, "imageAltEn"),
    imageAltUr: field(formData, "imageAltUr"),
  });
  if (!alt.success) return invalid(alt.error, formData);
  const file = formData.get("image");
  const state = await runForm(formData, async () => {
    if (!(file instanceof File) || file.size === 0) {
      throw new AppError("VALIDATION", "Choose an image to upload.");
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new AppError("VALIDATION", "The image must be 1.5 MB or smaller.");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentType = sniffImageType(bytes);
    if (!contentType) throw new AppError("VALIDATION", "Use a JPEG, PNG or WebP image.");
    await setResultImage(await serviceContext(user), id, {
      data: bytes,
      contentType,
      byteSize: bytes.byteLength,
      altEn: alt.data.imageAltEn,
      altUr: alt.data.imageAltUr,
    });
    return "Image saved.";
  });
  if (!state.error) revalidatePublicSite();
  revalidatePath(`/admin/results/${id}`);
  return state;
}
