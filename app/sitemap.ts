import type { MetadataRoute } from "next";
import { getPrisma } from "@/lib/db";
import { logEvent } from "@/lib/log";
import { buildSitemap } from "@/lib/seo/crawl";
import { loadSourceDates, type SourceDates } from "@/lib/seo/last-modified";
import { SITE_URL } from "@/lib/seo/site";

// Built on request: the image is built without a database, and the dates come from it.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let dates: SourceDates = {};
  try {
    dates = await loadSourceDates(getPrisma());
  } catch {
    // The page list does not depend on the database; only the dates are lost.
    logEvent("warn", "seo.sitemap_dates_unavailable");
  }
  return buildSitemap(SITE_URL, dates);
}
