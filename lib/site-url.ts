/**
 * The public site's origin. Canonical and hreflang links must be absolute URLs, so page
 * metadata resolves against it. Public pages are generated at build time, so `SITE_URL` is read
 * then (and again when a page revalidates); it defaults to the production address.
 */
export const SITE_URL = new URL(process.env["SITE_URL"] || "https://shiplens.onrender.com");
