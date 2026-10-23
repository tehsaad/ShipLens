"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { serviceContext } from "@/lib/server-action";
import { markContactMessageHandled } from "@/lib/services/contact";
import { field, uuidSchema } from "@/lib/validation/common";

export async function markHandledAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = uuidSchema.parse(field(formData, "id"));
  await markContactMessageHandled(await serviceContext(user), id);
  revalidatePath("/admin/messages");
}
