import type { MetadataRoute } from "next";
import { buildRobots } from "@/lib/seo/crawl";
import { SITE_URL } from "@/lib/seo/site";

// Read SITE_URL when served, not when the image is built.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return buildRobots(SITE_URL);
}
