import { logEvent } from "@/lib/log";

/** The live site. Canonical links, the sitemap and structured data use it unless `SITE_URL` is set. */
export const PRODUCTION_ORIGIN = "https://shiplens.onrender.com";

/** Hosts that must never become the canonical origin: this machine, and Render pull request previews. */
const LOCAL_HOST = /^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[::1?\])$/;
const PREVIEW_HOST = /-pr-\d+\.onrender\.com$/;

/**
 * Checks a configured site origin. A canonical origin is a bare HTTPS origin (no path, query or
 * fragment) on a public host. Returns the reason when the value is unusable.
 */
export function checkSiteOrigin(value: string): { origin: URL } | { problem: string } {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { problem: "not a URL" };
  }
  if (url.protocol !== "https:") return { problem: "not HTTPS" };
  if (url.username || url.password) return { problem: "contains credentials" };
  if (url.pathname !== "/" || url.search || url.hash) return { problem: "not a bare origin" };
  if (LOCAL_HOST.test(url.hostname)) return { problem: "a local address" };
  if (PREVIEW_HOST.test(url.hostname)) return { problem: "a preview deployment" };
  return { origin: new URL(url.origin) };
}

/**
 * The canonical origin. It comes from configuration, never from the request's Host header, so
 * a request cannot change the canonical links a page is cached with. An unusable `SITE_URL` is
 * logged and replaced by the production origin rather than published.
 */
export function resolveSiteUrl(configured: string | undefined): URL {
  if (!configured) return new URL(PRODUCTION_ORIGIN);
  const checked = checkSiteOrigin(configured.trim());
  if ("origin" in checked) return checked.origin;
  logEvent("warn", "seo.site_url_rejected", { reason: checked.problem });
  return new URL(PRODUCTION_ORIGIN);
}

export const SITE_URL = resolveSiteUrl(process.env["SITE_URL"]);

/** An absolute URL on the canonical origin, for a path that starts with "/". */
export function absoluteUrl(path: string, origin: URL = SITE_URL): string {
  return new URL(path, origin).toString();
}
