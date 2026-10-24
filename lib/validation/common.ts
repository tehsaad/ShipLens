import { z } from "zod";
import { parseDateOnly } from "@/lib/dates";
import { isAmount, normaliseAmount } from "@/lib/money";

/** Optional text from a form: blank becomes null. */
export function optionalText(max: number, message = `Use at most ${max} characters.`) {
  return z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .transform((value) => value ?? null);
}

export const uuidSchema = z.uuid({ message: "Not found." });

export const optionalUuid = z
  .union([z.literal(""), z.uuid()])
  .nullable()
  .optional()
  .transform((value) => (value ? value : null));

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Use at most 254 characters.")
  .pipe(z.email({ message: "Enter a valid email address." }));

export const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Use at most 254 characters.")
  .refine((value) => value === "" || z.email().safeParse(value).success, {
    message: "Enter a valid email address.",
  })
  .nullable()
  .optional()
  .transform((value) => (value ? value : null));

/**
 * Pakistani phone numbers (section 7.1): +92 or 0092 followed by 10 digits, or a national
 * number starting with 0 and 11 digits long (for example 03001234567). Spaces, dashes and
 * brackets are ignored; the number is stored in the +92 form.
 */
export function pakistaniPhone(
  message = "Enter a Pakistani phone number, for example +92 300 1234567 or 0300 1234567.",
) {
  return z
    .string()
    .trim()
    .max(30, message)
    .transform((value) => value.replace(/[\s\-()]/g, ""))
    .refine((value) => /^(?:\+92|0092|0)\d{10}$/.test(value), { message })
    .transform((value) => `+92${value.replace(/^(?:\+92|0092|0)/, "")}`);
}

export const phoneSchema = pakistaniPhone();

export function personName(min = 2, max = 80) {
  return z
    .string()
    .trim()
    .min(min, `Use at least ${min} characters.`)
    .max(max, `Use at most ${max} characters.`);
}

/** A calendar date in YYYY-MM-DD form, as a UTC-midnight Date (lib/dates). */
export const dateOnlySchema = z
  .string()
  .trim()
  .refine(
    (value) => {
      try {
        parseDateOnly(value);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Enter a valid date." },
  )
  .transform((value) => parseDateOnly(value));

export const optionalDateOnly = z
  .union([z.literal(""), dateOnlySchema])
  .nullable()
  .optional()
  .transform((value) => (value ? value : null));

/** A PKR amount with at most two decimals, normalised to "1234.50". Sign rules live elsewhere. */
export const amountSchema = z
  .string()
  .trim()
  .refine(isAmount, { message: "Enter an amount in PKR with at most two decimals." })
  .transform(normaliseAmount);

export const pageSchema = z.coerce.number().int().min(1).max(10_000).catch(1);

/** Reads a form field as a string, so missing fields reach Zod as "". */
export function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * Parses list filters from query parameters with the list's schema: blank values mean "no
 * filter", as on the list pages, so an export link reproduces the page's filters exactly.
 */
export function filtersFrom<Schema extends z.ZodObject>(
  schema: Schema,
  params: URLSearchParams,
): z.output<Schema> {
  return schema.parse(
    Object.fromEntries(Object.keys(schema.shape).map((key) => [key, params.get(key) || null])),
  );
}
