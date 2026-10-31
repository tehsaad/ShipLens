import { z } from "zod";
import { optionalDateOnly, optionalText, optionalUuid } from "@/lib/validation/common";

const title = z
  .string()
  .trim()
  .min(2, "Use at least 2 characters.")
  .max(160, "Use at most 160 characters.");

const body = z
  .string()
  .trim()
  .min(1, "Write the result.")
  .max(20_000, "Use at most 20,000 characters.");

/**
 * A published result / achievement. Bilingual: the English fields are required and the Urdu
 * ones optional (the Urdu site falls back to English). The image, and its alt text, are
 * managed separately (imageUploadSchema below) so an image can never be stored without alt text.
 */
export const resultSchema = z.object({
  titleEn: title,
  titleUr: optionalText(160),
  bodyEn: body,
  bodyUr: optionalText(20_000),
  branchId: optionalUuid,
  happenedOn: optionalDateOnly,
});

export type ResultInput = z.infer<typeof resultSchema>;

/** Alt text that accompanies an uploaded image. English alt is always required (accessibility). */
export const imageUploadSchema = z.object({
  imageAltEn: z
    .string()
    .trim()
    .min(2, "Describe the image for screen readers.")
    .max(200, "Use at most 200 characters."),
  imageAltUr: optionalText(200),
});

export type ImageAltInput = z.infer<typeof imageUploadSchema>;

/** Images: only raster formats the browser renders inline; never SVG (a same-origin XSS risk). */
export const MAX_IMAGE_BYTES = 1_500_000; // 1.5 MB
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

/** Identifies an image by its magic bytes, not the Content-Type the client claims. */
export function sniffImageType(bytes: Uint8Array): AllowedImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}
