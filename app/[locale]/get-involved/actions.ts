"use server";

import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { isAppError } from "@/lib/errors";
import type { PublicFormState } from "@/lib/public-form";
import { rateLimitedForm } from "@/lib/public-rate-limit";
import { getRequestContext } from "@/lib/request-context";
import { submitApplication } from "@/lib/services/applications";
import { applicationSchema } from "@/lib/validation/applications";
import { field } from "@/lib/validation/common";

/**
 * Public volunteer application (section 7.1). No session is needed. A filled honeypot field
 * means a bot: it gets the normal thank-you and nothing is stored. Valid submissions are
 * limited to 5 per hour per IP.
 */
export async function submitApplicationAction(
  _: PublicFormState,
  formData: FormData,
): Promise<PublicFormState> {
  if (field(formData, "website") !== "") return { ok: true, formError: null };
  const parsed = applicationSchema.safeParse({
    fullName: field(formData, "fullName"),
    email: field(formData, "email"),
    phone: field(formData, "phone"),
    preferredBranchId: field(formData, "preferredBranchId"),
    skills: field(formData, "skills"),
    availability: field(formData, "availability"),
    motivation: field(formData, "motivation"),
    consentGiven: ["on", "true"].includes(field(formData, "consentGiven")),
  });
  if (!parsed.success) {
    return {
      ok: false,
      formError: "checkFields",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }
  const context = await getRequestContext();
  if (rateLimitedForm("application", context)) return { ok: false, formError: "rateLimited" };
  try {
    await submitApplication(getPrisma(), parsed.data, context);
    return { ok: true, formError: null };
  } catch (error) {
    if (isAppError(error) && error.code === "CONFLICT")
      return { ok: false, formError: "applicationRejected" };
    if (isAppError(error))
      return {
        ok: false,
        formError: "checkFields",
        fieldErrors: { preferredBranchId: ["branch"] },
      };
    throw error;
  }
}
