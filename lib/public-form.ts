/**
 * Result of a public form's server action. Messages are keys, translated in the browser:
 * `formError` under "form", `fieldErrors` under "errors" (messages/{en,ur}.json).
 */
export type PublicFormState = {
  ok: boolean;
  formError: string | null;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialPublicFormState: PublicFormState = { ok: false, formError: null };
