/** The result a form's server action returns to useActionState. */
export type FormState = {
  error: string | null;
  /** Shown after a successful save when the page stays where it is. */
  success?: string | null;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialFormState: FormState = { error: null };
