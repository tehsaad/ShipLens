# SEO baseline (before the SEO work)

What crawlers and visitors got from the live site before this work, recorded on
**26 October 2026 at 18:00 UTC** against <https://shiplens.onrender.com>, deploy
`dep-dbfoolc9v7es73boiueg` (commit `e471f32`). The site has since been renamed Hamqadam
(see [handover](../handover.md#names)); this record uses the new name.

**How it was checked:**

- A headless Chromium visited every public route with JavaScript disabled, so the results
  are what the server sends. The captured fields were: status, `lang`/`dir`, title, meta
  description, robots meta, canonical, hreflang links, Open Graph and X tags, JSON-LD,
  headings, text inside `<main>`, images and links.
- Separate requests probed `robots.txt`, `sitemap.xml`, `llms.txt`, missing pages, an
  unknown locale and the staff area.
- Lighthouse 13.5.0 ran in mobile mode, and React hydration errors were counted with
  repeated page loads.
- The same audit that now runs in CI (`scripts/seo-audit.ts`) was run against the
  unchanged local production build: **226 failed checks**.

**Labels:**

- **PASS**: correct.
- **FAIL**: missing or wrong.
- **PARTIAL**: works with a gap.
- **UNVERIFIED**: cannot be confirmed from here (indexing, rankings and rich results
  depend on search engines).

## Site-wide

| Item                                           | Status     | Finding                                                                                                                                                                       |
| ---------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `robots.txt`                                   | FAIL       | 404 (an HTML error page).                                                                                                                                                     |
| `sitemap.xml`                                  | FAIL       | 404.                                                                                                                                                                          |
| `llms.txt`                                     | FAIL       | 404 (optional; see IMPLEMENTATION.md).                                                                                                                                        |
| HTTPS and canonical host                       | PASS       | Served over HTTPS at `shiplens.onrender.com`; `/` and unprefixed paths (`/about`) redirect to `/en/...`.                                                                      |
| `metadataBase` / absolute canonical URLs       | PASS       | Every page's canonical is absolute on `https://shiplens.onrender.com` (from `SITE_URL`, default production). The origin was not validated.                                    |
| Title template                                 | PARTIAL    | `<page> · Hamqadam Volunteers` works, but the home page title was only "Home" / "صفحۂ اول": the template does not apply to a page in the layout's own segment.                |
| Meta descriptions                              | FAIL       | All 9 pages in a language shared one description (the site tagline): 18 URLs, 2 distinct descriptions.                                                                        |
| Open Graph / X cards                           | FAIL       | None on any page; no social image.                                                                                                                                            |
| Structured data (JSON-LD)                      | FAIL       | None.                                                                                                                                                                         |
| `lang` / `dir`                                 | PASS       | `lang="en" dir="ltr"` and `lang="ur" dir="rtl"` on every page; English text inside Urdu pages is marked `lang="en"`.                                                          |
| hreflang                                       | PASS       | Every page links `en`, `ur` and `x-default` (English), reciprocally, as absolute URLs.                                                                                        |
| Missing pages                                  | PASS       | `/en/does-not-exist` and `/en/programs/nope` answer 404 with `noindex`; an unknown locale (`/xx/about`) redirects once to `/en/xx/about`, which answers 404. No soft 404s.    |
| Staff area indexability                        | PARTIAL    | Admin pages carry `<meta name="robots" content="noindex, nofollow">`; no `X-Robots-Tag` header on admin or API responses.                                                     |
| Staff sign-in redirect                         | FAIL       | `/admin` redirected to `/admin/login?callbackUrl=https%3A%2F%2F0.0.0.0%3A10000%2Fadmin`: Render's internal address in a public URL, and a new login URL for every admin path. |
| Server-rendered content                        | PASS       | Every page has its heading and text in the server HTML without JavaScript.                                                                                                    |
| One H1 per page                                | PASS       | 18 of 18.                                                                                                                                                                     |
| Images                                         | PASS (n/a) | The public pages have no `<img>` elements; the only image is the favicon.                                                                                                     |
| Internal links                                 | PASS       | Header navigation reaches all 7 main pages, the footer reaches Privacy, Terms and staff sign-in; all 19 internal link targets answer 200. No contextual links between pages.  |
| External links                                 | PASS (n/a) | None, except `mailto:` branch addresses.                                                                                                                                      |
| Hydration                                      | FAIL       | React error #418 on about 1 load in 5 of live public pages (`/en/programs`, `/ur`, `/ur/about`, `/ur/branches`); Lighthouse best practices 96 on `/ur/branches` for it.       |
| Indexing, rankings, rich results, AI citations | UNVERIFIED | No Search Console or Bing Webmaster access; nothing was submitted or observed.                                                                                                |

## Per route

Status 200, `lang`/`dir` correct, one canonical (self), three hreflang links, no Open Graph,
no X card and no JSON-LD on all 18 routes. The table lists what differs.

| Route                       | Title            | Description      | Headings (server HTML)                                            | Text in `<main>` | Notes                                                                                                                          |
| --------------------------- | ---------------- | ---------------- | ----------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `/en`                       | Home             | Tagline (shared) | H1 hero; H2 Announcements, Programs, Upcoming events; H3 per item | 574 chars        | Title without the site name.                                                                                                   |
| `/ur`                       | صفحۂ اول         | Tagline (shared) | Same structure                                                    | 566 chars        | "Program Two" and the announcement are shown in English (no Urdu version), marked `lang="en"`, no notice on the preview cards. |
| `/en/about`, `/ur/about`    | About us · …     | Tagline (shared) | H1 only                                                           | 75 chars         | Thin: one published sentence. No links onward.                                                                                 |
| `/en/programs`              | Programs · …     | Tagline (shared) | H1; H2 per program                                                | 149 chars        | Two short sample programs.                                                                                                     |
| `/ur/programs`              | پروگرام · …      | Tagline (shared) | H1; H2 per program                                                | 215 chars        | "Program Two" in English with the fallback notice.                                                                             |
| `/en/branches`, `/ur/…`     | Branches · …     | Tagline (shared) | H1; H2 per branch (4 active)                                      | 451 / 412 chars  | Code, city and email visible; city filter runs in the browser (no URL variants).                                               |
| `/en/events`, `/ur/…`       | Events · …       | Tagline (shared) | H1; H2 per upcoming event (1)                                     | 252 / 311 chars  | Upcoming events in the HTML; past events only after a click. Urdu shows the English title with a note.                         |
| `/en/get-involved`, `/ur/…` | Get involved · … | Tagline (shared) | H1; H2 Apply, Review, Join, Volunteer application                 | 855 / 871 chars  | Process and form; no answers to common questions.                                                                              |
| `/en/contact`, `/ur/…`      | Contact · …      | Tagline (shared) | H1; H2 Send a message                                             | 228 / 215 chars  | Form only; no published address, phone or email for head office.                                                               |
| `/en/privacy`, `/ur/…`      | Privacy · …      | Tagline (shared) | H1                                                                | 701 / 684 chars  |                                                                                                                                |
| `/en/terms`, `/ur/…`        | Terms · …        | Tagline (shared) | H1                                                                | 517 / 524 chars  |                                                                                                                                |

There are no dynamic public routes: programs, announcements and events are listed on their
pages, not given pages of their own.

## Lighthouse (live, mobile, before this work)

Measured on 26 October 2026 against the live site (page warmed once). Raw summary:
[`lighthouse/2026-10-26-live-before.json`](lighthouse/2026-10-26-live-before.json).

| Page           | Performance | Accessibility | Best practices | SEO |
| -------------- | ----------- | ------------- | -------------- | --- |
| `/en`          | 99          | 100           | 100            | 100 |
| `/en/programs` | 100         | 100           | 100            | 100 |
| `/en/branches` | 99          | 100           | 100            | 100 |
| `/ur`          | 99          | 100           | 100            | 100 |
| `/ur/programs` | 99          | 100           | 100            | 100 |
| `/ur/branches` | 96          | 100           | 96\*           | 100 |

\* The hydration error above, logged to the console during that run.

Lighthouse's SEO category checks basics (title, description, status, crawlability, link
text, canonical, hreflang); a score of 100 does not mean the gaps above were absent.
