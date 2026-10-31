# SEO, GEO and AEO implementation

What was changed to make the public site easier for search engines, social networks and
AI-assisted search to read correctly, and why. The starting point is in
[BASELINE.md](BASELINE.md); the owner's steps after deployment are in
[POST-DEPLOYMENT.md](POST-DEPLOYMENT.md); the page-by-page content plan is in
[KEYWORD-AND-CONTENT-MAP.md](KEYWORD-AND-CONTENT-MAP.md).

Nothing here can guarantee indexing, a ranking, a rich result or a citation in an AI answer:
those are decisions of search engines and AI systems. The work makes the site's pages
correct, consistent and explicit; the rest has to be observed after deployment.

## Architecture

Everything uses what the project already had: the Next.js Metadata API, file-based
`robots.ts` and `sitemap.ts`, next-intl messages and the existing services. No SEO library
was added.

| Part                                                               | Role                                                                                                                                                                                                                       |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/seo/site.ts`                                                  | The canonical origin. Read from `SITE_URL` (default `https://hamqadam.onrender.com`), never from the request's Host header. A value that is not a bare HTTPS origin on a public host is logged and replaced by production. |
| `lib/seo/pages.ts`                                                 | The one list of public pages: path, messages namespace, schema.org page type and the published records each page shows. Metadata, sitemap, structured data, `llms.txt` and the tests all read it.                          |
| `lib/seo/metadata.ts`                                              | `pageMetadata()` for every public page: title, description, canonical, hreflang, Open Graph, X card. Next.js replaces these objects per page rather than merging them, so each page gets the full set from here.           |
| `messages/{en,ur}.json`                                            | `metaTitle` and new `metaDescription` per page, `seo.imageAlt`, the Get Involved questions and the related-page labels.                                                                                                    |
| `public/og/{en,ur}.png`, `scripts/og-images.mjs`                   | Social preview images, 1200 × 630, one per language. Rendered in Chromium, because Next.js's `ImageResponse` cannot shape Urdu script. Regenerate with `npm run og:images` after changing the site name or tagline.        |
| `app/robots.ts`, `app/sitemap.ts`, `lib/seo/crawl.ts`              | `robots.txt` and `sitemap.xml`.                                                                                                                                                                                            |
| `lib/seo/last-modified.ts`                                         | The sitemap's `lastmod`: one aggregate query per kind of published record.                                                                                                                                                 |
| `app/llms.txt/route.ts`, `lib/seo/llms.ts`                         | A Markdown summary of the public pages (see below).                                                                                                                                                                        |
| `lib/seo/structured-data.ts`, `components/seo/page-json-ld.tsx`    | JSON-LD builders and the server component that renders one graph per page.                                                                                                                                                 |
| `components/site/related-links.tsx`                                | "Related pages" links at the end of listing pages.                                                                                                                                                                         |
| `next.config.ts`                                                   | `X-Robots-Tag: noindex, nofollow` on `/admin` and `/api` responses.                                                                                                                                                        |
| `scripts/seo-audit.ts`, `scripts/seo-check.mts`, `e2e/seo.spec.ts` | The audit, run in CI against the production build and by hand against a deployment.                                                                                                                                        |

To add a public page: add it to `PUBLIC_PAGES`, give its namespace `metaTitle` and
`metaDescription` in both message files, call `pageMetadata(params, "<key>")` and render
`<PageJsonLd>`. The unit tests and the E2E audit then cover it automatically.

## Decisions

- **Canonical origin from configuration only.** Pages are cached and served to everyone, so a
  canonical built from the request could be poisoned by one request with a forged Host
  header. `SITE_URL` is validated: HTTPS, no path or query, no `localhost`, `127.x`,
  `0.0.0.0`, `[::1]` or Render pull request preview hosts (`*-pr-N.onrender.com`). An
  invalid value is logged (`seo.site_url_rejected`) and production is used, so a
  misconfiguration cannot publish wrong canonicals.
- **Same slugs in both languages.** The routing has `/en/...` and `/ur/...` with identical
  paths; there are no localised slugs to map.
- **x-default points at the English page.** English is the routing default
  (`defaultLocale: "en"`) and the language most visitors without an Urdu preference get. The
  unprefixed URLs (`/`, `/about`) redirect by browser language; pointing x-default at a
  redirect would add a hop for crawlers.
- **The staff area is not blocked in `robots.txt`.** Search engines can only obey a `noindex`
  they are allowed to fetch, and a URL that robots.txt blocks can still be indexed from links
  alone. The footer links to `/admin/login`, so blocking `/admin` would risk an "indexed,
  though blocked" login page. Instead every admin response says `noindex, nofollow` in a
  header (including the proxy's redirect) and in a meta tag. `/api/` is disallowed: it serves
  no pages. robots.txt is not access control; the staff area requires a session regardless.
- **Sitemap dates are real or absent.** `lastmod` is the latest publication of the content
  entries a page shows, the latest update of published events, or of active branches. Pages
  made only from messages (Contact, Privacy, Terms) get no date. A page's date can be later
  than its visible change (for example a branch record updated in a field the page does not
  show), never invented. If the database is unreachable the sitemap still lists every page,
  without dates.
- **One social image per language, not per page.** The pages are a small brochure site with
  no photography. A branded card with the name and tagline in the page's language is accurate
  for every page; per-page images would repeat the title already in the card's text.
- **Open Graph locale `en_PK` / `ur_PK`.** The site's own tagline places the branches across
  Pakistan.
- **Structured data describes only what is published.** `Organization` (not `NGO`: legal
  status is not published), `WebSite`, the page (`WebPage`, `AboutPage`, `CollectionPage`,
  `ContactPage`), active branches on the Branches page and upcoming published events on the
  Events page, with stable `@id`s so the same organisation and branches are one entity
  everywhere. `areaServed: Pakistan` comes from the tagline; `contactPoint` is the contact
  page. There is no postal address, phone number, social profile, founding date, rating,
  review or award, because the organisation publishes none. No `SearchAction`: the site has
  no search.
- **Events: upcoming only.** The Events page opens on upcoming events, so only those are in
  the HTML, and only those are described. Dates are the stored instants (ISO 8601, UTC), the
  same values as the page's `<time datetime>`.
- **No FAQPage markup.** The Get Involved questions are real and visible, but Google shows
  FAQ rich results only for well-known government and health sites (since August 2023), so
  the markup would add bytes without effect. The questions still help readers and answer
  engines as plain headings and answers.
- **No breadcrumbs.** The site has two levels (home and seven sections) and every section is
  in the header navigation. A visible breadcrumb would repeat the navigation, and
  BreadcrumbList without visible breadcrumbs would not match the page.
- **Answers reuse published sentences.** Each Get Involved answer is an existing sentence
  from the page's steps, Privacy or Terms, in both languages, so a fact has one source and
  one wording. Only the questions are new text.
- **`llms.txt`.** A short Markdown summary at `/llms.txt` (the llmstxt.org proposal) listing
  the public pages in both languages with their descriptions. It is generated from the page
  list and messages, so it cannot drift from the site, and it has public URLs only. No major
  search or AI system is known to be bound to read it; it is not a crawl rule, a sitemap or
  access control.
- **No analytics or tracking.** Nothing was added: the Privacy page states that the site
  stores no tracking cookies. Measuring organic and AI referrals is an owner decision (see
  POST-DEPLOYMENT.md).

## Fixes found on the way

- **React hydration error 418 on live public pages** (about 1 load in 5). The root layout
  imported `THEME_SCRIPT` from the theme toggle's `"use client"` module, so the browser
  received a reference to that module instead of the script text. Hydrating `<head>` then
  waited for the module's JavaScript; when it arrived late, React replayed `<head>`, lost its
  place in the document and failed. The constant now lives in a plain module
  (`components/site/theme-script.ts`). With random delays on static files, the old build
  failed 2 of 20 local loads and the fixed one 0 of 40. `e2e/hydration.spec.ts` checks that
  `<head>` carries no deferred references and that every public page hydrates without
  console errors.
- **Internal address in the sign-in redirect.** `/admin` redirected to
  `/admin/login?callbackUrl=https%3A%2F%2F0.0.0.0%3A10000%2Fadmin`. The parameter was never
  read; it is gone.

## Status

### Implemented and verified

Verified on 26 October 2026 against the local production build (`npm run build`, seeded
E2E database), unless stated otherwise.

| Item                                                                                                                      | Evidence                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Unique title and description per page and language (18 + 18)                                                              | `tests/unit/seo.test.ts`; E2E audit                                                                              |
| One self-referencing absolute canonical per page                                                                          | E2E audit                                                                                                        |
| Reciprocal hreflang `en`, `ur`, `x-default` in pages and sitemap                                                          | Unit tests; E2E audit                                                                                            |
| `lang` / `dir` per language                                                                                               | E2E audit                                                                                                        |
| Open Graph and X cards with absolute image URLs and localised alt text; images served as PNG                              | E2E audit                                                                                                        |
| `robots.txt` names the canonical sitemap, disallows `/api/` only                                                          | Unit tests; E2E audit                                                                                            |
| `sitemap.xml` lists exactly the 18 public URLs, each answering 200 with a matching canonical                              | E2E audit                                                                                                        |
| Sitemap dates from published records only; served without dates if the database fails                                     | `tests/integration/seo.test.ts`; unit tests                                                                      |
| JSON-LD parses, one graph per page, describes the page at its canonical URL                                               | E2E audit                                                                                                        |
| Events and Branches JSON-LD equal the visible lists                                                                       | `e2e/seo.spec.ts` (both languages)                                                                               |
| JSON-LD cannot be broken out of with `</script>`                                                                          | Unit test                                                                                                        |
| No private record in public pages, `robots.txt`, `sitemap.xml` or `llms.txt`                                              | `e2e/seo.spec.ts` (seeded member, applicant, staff and contact-message names, emails, phones; the demo password) |
| Staff area and API answer `X-Robots-Tag: noindex, nofollow`; admin pages also by meta; sign-in redirect has no parameters | E2E audit                                                                                                        |
| Missing pages answer a real 404                                                                                           | E2E audit                                                                                                        |
| Every internal link answers 200 without a redirect                                                                        | E2E audit (all links found in the 18 pages)                                                                      |
| Server HTML has the content (one H1, text in `<main>`) without JavaScript                                                 | E2E audit                                                                                                        |
| Every public page hydrates without console errors                                                                         | `e2e/hydration.spec.ts`                                                                                          |
| Accessibility unchanged: WCAG 2.1 AA, both languages and themes                                                           | `e2e/accessibility.spec.ts` (36 checks)                                                                          |
| Existing permission, IDOR, lock, report, audit and dashboard tests                                                        | All pass (see Commands below)                                                                                    |
| Backend coverage ≥ 60%                                                                                                    | 68.86% of lines (was 67.49%)                                                                                     |

### Implemented, not yet verified on the live site

This work is committed locally and **not deployed** (as instructed). After deployment, run
`npm run seo:check -- https://hamqadam.onrender.com` and the steps in POST-DEPLOYMENT.md.
The hydration fix in particular is verified locally only; on live the error was
timing-dependent.

### Owner action required

- Deploy, then verify (POST-DEPLOYMENT.md), including Search Console and Bing Webmaster Tools.
- **Content:** the About page has one published sentence; programs, announcements and an
  event exist only partly in Urdu. KEYWORD-AND-CONTENT-MAP.md lists what is needed.
- **Review the new Urdu text** (below). It was written for this change, not by a translator.
- **Decide** whether to measure organic and AI referral traffic (needs a privacy review).
- If a custom domain is added: set `SITE_URL`, add the domain in Search Console, and
  regenerate the social images (they show the host name).

### Unverified

Indexing, rankings, rich results, AI citations, and live Lighthouse scores after this change.

## New Urdu text for owner review

All in `messages/ur.json`:

- `home.metaTitle` and every page's `metaDescription` (9);
- `seo.imageAlt`;
- `getInvolved.faqTitle`, `faqReview`, `faqAccepted`, `faqPaid`, `faqId`, `faqDetails`,
  `faqOther`, `faqContactLink`;
- `related.*` (7);
- the `## صفحات (اردو)` heading in `llms.txt` (`lib/seo/llms.ts`);
- the Urdu social image text, which is the existing `site.name` and `site.tagline`.

The FAQ answers are existing Urdu sentences from Privacy, Terms and Get Involved.

## Security and privacy (section 8)

| Check                                      | Result                                                                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Admin and sign-in not indexable            | Header and meta `noindex, nofollow`; not in the sitemap or `llms.txt`.                                                                                       |
| Private pages need a session               | Unchanged (proxy plus server checks); the access E2E tests pass.                                                                                             |
| Public data only                           | Metadata comes from messages. JSON-LD uses `listPublicBranches` (active only) and `listPublishedEvents` (published only), the same queries the pages render. |
| Sitemap queries                            | Aggregates over published content, published events and active branches only; no rows are serialised.                                                        |
| Markup injection                           | JSON-LD escapes `<`, `>`, `&`, U+2028 and U+2029; metadata values are escaped by React. Markdown rendering is unchanged (sanitised).                         |
| Cache boundaries                           | Public pages stay cached (ISR) and contain no per-user data. The sitemap, `robots.txt` and `llms.txt` are rendered per request with no user data.            |
| Secrets                                    | None added; `SITE_URL` is not secret.                                                                                                                        |
| CSP, rate limits, authorisation, audit log | Unchanged. JSON-LD script elements are data blocks, not executed, so the public CSP needs no change.                                                         |

## Commands run

On 26 October 2026, in the development container (Node 22, PostgreSQL 16), on the final committed tree:

| Command                                                                    | Result                                 |
| -------------------------------------------------------------------------- | -------------------------------------- |
| `npm run db:validate`                                                      | Pass                                   |
| `npm run format:check`                                                     | Pass                                   |
| `npm run lint`                                                             | Pass                                   |
| `npm run typecheck`                                                        | Pass                                   |
| `npm run test:coverage` (unit and integration)                             | 34 files, 632 tests pass; lines 68.86% |
| `npm run build`                                                            | Pass                                   |
| `npx playwright test` (all E2E, local production build)                    | 79 pass                                |
| `npm run seo:check -- http://127.0.0.1:3200 https://hamqadam.onrender.com` | 0 failures (226 before the change)     |
| Lighthouse 13.5.0, mobile, six key pages                                   | See below                              |

## Lighthouse after the change (local)

Local production build in the development container; raw summary:
[`lighthouse/2026-10-26-local-after.json`](lighthouse/2026-10-26-local-after.json). Local
scores vary by several points between runs on this machine, and the live site scored higher
than the local build before the change ([BASELINE.md](BASELINE.md)), so these are not a
prediction of live scores.

| Page           | Performance | Accessibility | Best practices | SEO\* |
| -------------- | ----------- | ------------- | -------------- | ----- |
| `/en`          | 96          | 100           | 100            | 92    |
| `/en/programs` | 96          | 100           | 100            | 92    |
| `/en/branches` | 99          | 100           | 100            | 92    |
| `/ur`          | 86          | 100           | 100            | 92    |
| `/ur/programs` | 99          | 100           | 100            | 92    |
| `/ur/branches` | 86          | 100           | 100            | 92    |

\* The only failed SEO audit is `canonical`: the pages are served from `127.0.0.1` while
their canonical names the production domain, which is correct. Urdu performance is limited
by the Nastaliq font, as documented in `docs/ACCEPTANCE.md`.

## Known limitations

- **Sample content.** The organisation's content is the sample data: an About page of one
  sentence and two placeholder programs ("Program One", "Program Two"). The technical work
  cannot make thin content substantial; the owner's text is needed.
- **Partial Urdu content.** Some entries exist only in English. They are shown with the
  existing fallback notice on their own pages. On the home page preview cards they are marked
  `lang="en"` without a notice.
- **One image for all pages** of a language.
- **Past events are not described** in structured data (they are behind the page's filter).
- **The first build commit is not self-contained.** In the local history,
  `fix: redirect signed-out staff to a bare /admin/login` also carries the removal of
  `lib/page-meta.ts` and `lib/site-url.ts`, whose replacements arrive in the next commit. The
  final tree builds and passes every check. The history was left as it is because rewriting
  it was out of bounds for this task.
