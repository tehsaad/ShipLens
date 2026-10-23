import { z } from "zod";
import { CollectionPurpose } from "@/lib/generated/prisma/enums";
import { amountSchema, dateOnlySchema, optionalText } from "@/lib/validation/common";

const purpose = z.enum(CollectionPurpose, { message: "Choose a purpose." });

export const collectionSchema = z.object({
  amount: amountSchema,
  collectedOn: dateOnlySchema,
  purpose,
  description: optionalText(500),
});

/** Editing a correction may also change its reason; the service enforces which applies. */
export const updateCollectionSchema = collectionSchema.extend({
  correctionNote: optionalText(500),
});

export const correctionSchema = z.object({
  amount: amountSchema,
  correctionNote: z
    .string()
    .trim()
    .min(3, "Explain the correction.")
    .max(500, "Use at most 500 characters."),
});

export const routingSchema = z.object({
  routingReference: z
    .string()
    .trim()
    .min(1, "Enter the transfer or deposit reference.")
    .max(100, "Use at most 100 characters."),
});

export const collectionFiltersSchema = z.object({
  branchId: z.uuid().nullable().catch(null),
  purpose: z.enum(CollectionPurpose).nullable().catch(null),
  routed: z.enum(["yes", "no"]).nullable().catch(null),
  from: dateOnlySchema.nullable().catch(null),
  to: dateOnlySchema.nullable().catch(null),
});

export type CollectionInput = z.infer<typeof collectionSchema>;
export type UpdateCollectionInput = z.infer<typeof updateCollectionSchema>;
export type CorrectionInput = z.infer<typeof correctionSchema>;
export type CollectionFilters = z.infer<typeof collectionFiltersSchema>;
