import { z } from "zod";
import { optionalText, optionalUuid } from "@/lib/validation/common";

/**
 * A date and time typed in Asia/Karachi (UTC+5 all year, no daylight saving), from an
 * <input type="datetime-local">, as an absolute instant.
 */
export const karachiDateTime = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Enter a date and time.")
  .transform((value) => new Date(`${value}:00+05:00`))
  .refine((date) => !Number.isNaN(date.getTime()), "Enter a valid date and time.");

export const eventSchema = z
  .object({
    titleEn: z
      .string()
      .trim()
      .min(2, "Use at least 2 characters.")
      .max(160, "Use at most 160 characters."),
    /** Decision 6: optional; the Urdu site falls back to the English title. */
    titleUr: optionalText(160),
    startsAt: karachiDateTime,
    endsAt: karachiDateTime,
    location: z
      .string()
      .trim()
      .min(2, "Use at least 2 characters.")
      .max(200, "Use at most 200 characters."),
    branchId: optionalUuid,
  })
  .refine((value) => value.endsAt >= value.startsAt, {
    path: ["endsAt"],
    message: "The event cannot end before it starts.",
  });

export type EventInput = z.infer<typeof eventSchema>;

/** Formats an instant for a datetime-local input, in Asia/Karachi. */
export function toKarachiInput(date: Date): string {
  return new Date(date.getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 16);
}
