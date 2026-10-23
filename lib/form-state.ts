/** The result a form's server action returns to useActionState. */
export type FormState = {
  error: string | null;
  /** Shown after a successful save when the page stays where it is. */
  success?: string | null;
  fieldErrors?: Record<string, string[] | undefined>;
  /**
   * What the user typed, returned when the submission fails. React resets a form after its
   * action runs; the fields use these values as their defaults so nothing typed is lost.
   */
  values?: Record<string, string>;
};

export const initialFormState: FormState = { error: null };
