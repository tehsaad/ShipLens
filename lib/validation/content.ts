import { z } from "zod";
import { ContentType, Locale, PublishStatus } from "@/lib/generated/prisma/enums";

/** URL-safe slugs: lowercase letters, digits and single hyphens, e.g. "winter-drive-2026". */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Use at least 2 characters.")
  .max(80, "Use at most 80 characters.")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, digits and hyphens only.");

const title = z
  .string()
  .trim()
  .min(2, "Use at least 2 characters.")
  .max(160, "Use at most 160 characters.");
const body = z
  .string()
  .trim()
  .min(1, "Write the content.")
  .max(20_000, "Use at most 20,000 characters.");

export const createContentSchema = z.object({
  type: z.enum(ContentType, { message: "Choose a type." }),
  slug: slugSchema,
  locale: z.enum(Locale, { message: "Choose a language." }),
  title,
  body,
});

/** The slug can change only while the entry has never been published (its URL is public). */
export const updateContentSchema = z.object({ title, body, slug: slugSchema.optional() });

export const contentFiltersSchema = z.object({
  type: z.enum(ContentType).nullable().catch(null),
  locale: z.enum(Locale).nullable().catch(null),
  status: z.enum(PublishStatus).nullable().catch(null),
});

export type CreateContentInput = z.infer<typeof createContentSchema>;
export type UpdateContentInput = z.infer<typeof updateContentSchema>;
