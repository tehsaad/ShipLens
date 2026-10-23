import "server-only";
import { revalidatePath } from "next/cache";

/** Refreshes every cached public page after staff publish or change public data (section 9). */
export function revalidatePublicSite(): void {
  revalidatePath("/[locale]", "layout");
}
