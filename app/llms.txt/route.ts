import { buildLlmsTxt } from "@/lib/seo/llms";
import { SITE_URL } from "@/lib/seo/site";
import en from "@/messages/en.json";
import ur from "@/messages/ur.json";

// Read SITE_URL when served, not when the image is built. No database access.
export const dynamic = "force-dynamic";

export function GET(): Response {
  return new Response(buildLlmsTxt(SITE_URL, { en, ur }), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
