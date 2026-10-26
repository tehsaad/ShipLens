// SEO audit of a deployment (scripts/seo-audit.ts). Read-only: GET requests only.
//   npm run seo:check -- https://shiplens.onrender.com
//   npm run seo:check -- http://127.0.0.1:3200 https://shiplens.onrender.com
// The second argument is the canonical origin, when the site is reached at another address.
import { auditSite } from "./seo-audit";

const [base, canonical] = process.argv.slice(2);
if (!base) {
  console.error("Usage: npm run seo:check -- <base URL> [canonical origin]");
  process.exit(2);
}
const canonicalOrigin = new URL(canonical ?? base).origin;
const result = await auditSite({ base: new URL(base).origin, canonicalOrigin });

console.log(
  `Checked ${result.checked.pages} pages and ${result.checked.links} internal links on ${base}.`,
);
for (const { target, check, detail } of result.failures) {
  console.log(`FAIL ${target}: ${check}${detail ? ` (${detail.slice(0, 200)})` : ""}`);
}
console.log(
  result.failures.length === 0 ? "All checks passed." : `${result.failures.length} failed.`,
);
process.exit(result.failures.length === 0 ? 0 : 1);
