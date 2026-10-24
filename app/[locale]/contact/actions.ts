"use server";

import { z } from "zod";
import { getPrisma } from "@/lib/db";
import type { PublicFormState } from "@/lib/public-form";
import { rateLimitedForm } from "@/lib/public-rate-limit";
import { getRequestContext } from "@/lib/request-context";
import { submitContactMessage } from "@/lib/services/contact";
import { contactSchema } from "@/lib/validation/applications";
import { field } from "@/lib/validation/common";

/**
 * Public contact form (section 7.1), with the same honeypot as the application form and a
 * limit of 5 valid messages per hour per IP.
 */
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
  const context = await getRequestContext();
  if (rateLimitedForm("contact", context)) return { ok: false, formError: "rateLimited" };
  await submitContactMessage(getPrisma(), parsed.data, context);
  return { ok: true, formError: null };
}
