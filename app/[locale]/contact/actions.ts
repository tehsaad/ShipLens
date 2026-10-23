"use server";

import { z } from "zod";
import { getPrisma } from "@/lib/db";
import type { PublicFormState } from "@/lib/public-form";
import { getRequestContext } from "@/lib/request-context";
import { submitContactMessage } from "@/lib/services/contact";
import { contactSchema } from "@/lib/validation/applications";
import { field } from "@/lib/validation/common";

/** Public contact form (section 7.1), with the same honeypot as the application form. */
export async function submitContactAction(
  _: PublicFormState,
  formData: FormData,
): Promise<PublicFormState> {
  if (field(formData, "website") !== "") return { ok: true, formError: null };
  const parsed = contactSchema.safeParse({
    name: field(formData, "name"),
    email: field(formData, "email"),
    message: field(formData, "message"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      formError: "checkFields",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }
  await submitContactMessage(getPrisma(), parsed.data, await getRequestContext());
  return { ok: true, formError: null };
}
