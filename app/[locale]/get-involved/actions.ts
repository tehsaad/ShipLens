"use server";

import { getPrisma } from "@/lib/db";
import type { FormState } from "@/lib/form-state";
import { getRequestContext } from "@/lib/request-context";
import { invalid, runForm } from "@/lib/server-action";
import { submitApplication } from "@/lib/services/applications";
import { applicationSchema } from "@/lib/validation/applications";
import { field } from "@/lib/validation/common";

const THANK_YOU =
  "Thank you for applying. Our HR team reviews every application and will contact you.";

/**
 * Public volunteer application (section 7.1). No session is needed. A filled honeypot field
 * means a bot: it gets the normal thank-you and nothing is stored. Rate limiting (5 per hour
 * per IP) is added with the other limiters in Phase 5.
 */
export async function submitApplicationAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  if (field(formData, "website") !== "") return { error: null, success: THANK_YOU };
  const parsed = applicationSchema.safeParse({
    fullName: field(formData, "fullName"),
    email: field(formData, "email"),
    phone: field(formData, "phone"),
    preferredBranchId: field(formData, "preferredBranchId"),
    skills: field(formData, "skills"),
    availability: field(formData, "availability"),
    motivation: field(formData, "motivation"),
    consentGiven: formData.get("consentGiven") === "on",
  });
  if (!parsed.success) return invalid(parsed.error);
  return runForm(async () => {
    await submitApplication(getPrisma(), parsed.data, await getRequestContext());
    return THANK_YOU;
  });
}
