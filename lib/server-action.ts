import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { isAppError } from "@/lib/errors";
import type { FormState } from "@/lib/form-state";
import type { Actor } from "@/lib/permissions";
import { getRequestContext } from "@/lib/request-context";
import type { ServiceContext } from "@/lib/services/shared";

/** The service context for the signed-in user in a page or server action. */
export async function serviceContext(actor: Actor): Promise<ServiceContext> {
  return {
    db: getPrisma(),
    actor: { id: actor.id, role: actor.role, branchId: actor.branchId },
    request: await getRequestContext(),
  };
}

/** Never echoed back to the browser. */
const SECRET_FIELD = /password/i;

/** The submitted text fields, so a failed form keeps what the user typed. */
export function submittedValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$") && !SECRET_FIELD.test(key))
      values[key] = value;
  }
  return values;
}

/** Field errors for a failed Zod parse, in the FormState shape. */
export function invalid(error: z.ZodError, formData?: FormData): FormState {
  return {
    error: "Check the highlighted fields.",
    fieldErrors: z.flattenError(error).fieldErrors as FormState["fieldErrors"],
    ...(formData ? { values: submittedValues(formData) } : {}),
  };
}

/**
 * Runs the work of a form action. An AppError becomes a message on the form; anything else
 * (including Next.js redirects) propagates, so internal errors never reach the user.
 */
export async function runForm(
  formData: FormData,
  work: () => Promise<string | void>,
): Promise<FormState> {
  try {
    const success = await work();
    return { error: null, success: success ?? null };
  } catch (error) {
    if (isAppError(error)) return { error: error.message, values: submittedValues(formData) };
    throw error;
  }
}

/** Loads a record for a page; a missing or out-of-scope record shows the 404 page. */
export async function loadOrNotFound<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}

/** A route id parameter; anything but a UUID shows the 404 page. */
export async function routeId(params: Promise<{ id: string }>): Promise<string> {
  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success) notFound();
  return parsed.data;
}
