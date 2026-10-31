# After deployment: search and discovery checklist

Steps for the site owner once the SEO work is deployed. None of them has been done yet: no
property has been verified, no sitemap submitted, and no analytics installed. Record the date
and result of each step here as it is done.

Search engines decide what to index and how to rank it, and AI systems decide what to
quote. These steps let the owner see what they decide and fix what is in the site's control;
they do not guarantee indexing, rich results or citations.

## 1. Check the deployment (5 minutes)

1. Wait for the Render deploy to show **Live**.
2. From a machine with internet access, in the repository:
   ```sh
   npm run seo:check -- https://hamqadam.onrender.com
   ```
   It checks `robots.txt`, `sitemap.xml`, `llms.txt`, every page's title, description,
   canonical, hreflang, social cards and structured data, internal links, 404s and the
   `noindex` rules. Expect `All checks passed.`
3. Open <https://hamqadam.onrender.com/robots.txt> and
   <https://hamqadam.onrender.com/sitemap.xml> in a browser: 18 URLs, each with `en`, `ur`
   and `x-default` alternates.
4. Open a page, view source and search for `application/ld+json`: one block per page.
5. Open the browser console on `/ur` and reload about ten times: no "Minified React error
   #418" (the hydration fix).

## 2. Google Search Console

1. Go to <https://search.google.com/search-console> and **Add property**.
2. Choose **URL prefix** and enter `https://hamqadam.onrender.com/` (a Domain property needs
   DNS access, which an `onrender.com` subdomain does not give you).
3. Verify with the **HTML tag** method. Send the tag's `content` value to the developer: it
   belongs in the root layout's metadata as `verification: { google: "<value>" }` and needs
   a deploy. Alternatively use the **HTML file** method by adding the file to `public/`. Do
   not commit the value anywhere else.
4. **Sitemaps** → submit `sitemap.xml`. The status should become **Success** with 18 URLs
   discovered.
5. **URL inspection** → inspect `https://hamqadam.onrender.com/en` and `/ur`, then
   **Request indexing** for each. Under "Page indexing", check that **User-declared
   canonical** and **Google-selected canonical** are the same URL.
6. After a few days, in **Pages** (indexing report): every sitemap URL should be indexed or
   on its way. Investigate "Duplicate, Google chose different canonical", "Soft 404" and
   "Crawled – currently not indexed". `/admin/login` should appear only as **Excluded by
   'noindex' tag**, which is intended.
7. International targeting: Search Console no longer has a hreflang report. Check hreflang
   by inspecting a `/ur` URL and confirming that its canonical stays `/ur/...` (not `/en/...`).

## 3. Bing Webmaster Tools (also used by some AI search products)

1. Go to <https://www.bing.com/webmasters>. The quickest route is **Import from Google
   Search Console** after step 2; otherwise verify with the meta tag (`verification: {
other: { "msvalidate.01": "<value>" } }` in the root layout) or an XML file in `public/`.
2. Submit `https://hamqadam.onrender.com/sitemap.xml`.
3. Use **URL Inspection** on `/en` and `/ur`.
4. Optional: IndexNow lets a site notify Bing of changes. It is not set up; it would need a
   key file and a call when content is published.

## 4. Structured data and social previews

1. **Rich Results Test**: <https://search.google.com/test/rich-results>. Test `/en/events`
   while an upcoming event is published. The Event should be detected without errors.
   Warnings about missing optional fields (description, image, offers, performer) are
   expected: the site does not publish those.
2. **Schema Markup Validator**: <https://validator.schema.org/>. Test `/en`,
   `/en/branches` and `/ur/events`: no errors.
3. Paste a page URL in a social post preview, or use a card debugger (for example
   LinkedIn's Post Inspector). The green card with the name and tagline should appear, in
   Urdu for `/ur` pages.

Valid structured data makes a page _eligible_ for enhanced results; Google decides whether
to show them.

## 5. Performance and Lighthouse

1. **PageSpeed Insights**: <https://pagespeed.web.dev/>. Run `/en`, `/en/programs` and
   `/en/branches`, and their `/ur` versions, on Mobile. Section 9 asks for 90+.
2. On the free Render plan the first request after 15 minutes idle waits for the service to
   wake (up to about a minute). Load the page once before measuring, and note in the record that
   you did.
3. Field data (Core Web Vitals from real Chrome users) appears only once the site has enough
   traffic; until then PageSpeed Insights shows lab data only.
4. Record the scores and the date in `docs/ACCEPTANCE.md` (item 13).

## 6. Monitoring (monthly)

- **Search Console → Performance:** clicks, impressions, average position and the queries
  people used. Compare the queries with
  [KEYWORD-AND-CONTENT-MAP.md](KEYWORD-AND-CONTENT-MAP.md) and adjust titles or content
  where the page people land on is not the one meant for their question.
- **Search Console → Pages and Sitemaps:** indexed count stays at 18; new errors are
  investigated.
- **Crawl problems:** Search Console's **Crawl stats** (Settings) shows server errors and
  response times. A spike in 5xx usually means the service was asleep or the database was
  down (`/api/health`, Render logs).
- **Redirects:** only `/` → `/en` (or `/ur`) and unprefixed paths redirect; anything else
  redirecting is a bug.

## 7. Organic and AI referral traffic

The site has no analytics, and its Privacy page says it stores no tracking cookies. To
measure visits:

- **Option A, no cookies:** a privacy-friendly, cookieless analytics tool, or Render's own
  request logs. Referrers such as `google.com`, `bing.com`, `chatgpt.com`,
  `perplexity.ai`, `copilot.microsoft.com` and `gemini.google.com` show up as referrers when
  the visitor's browser sends them. Many AI answers send no referrer, so this undercounts.
- **Option B, cookie-based analytics:** needs a consent banner and an update to the Privacy
  page in both languages first.

Either option is an owner decision with a privacy review; nothing should be added before
that.

## 8. Periodic review (every 3 to 6 months)

1. Run `npm run seo:check -- https://hamqadam.onrender.com`.
2. Re-run PageSpeed Insights on the key pages.
3. Read each page as a newcomer: is the content still accurate, in both languages? Are past
   events and ended programs unpublished?
4. Check the Urdu fallbacks: entries shown in English on `/ur` pages need an Urdu version.
5. Review new Search Console queries against the content map.

## Limits of AI search visibility

- No implementation guarantees that an AI system will crawl, quote, cite or link the site.
- `llms.txt` is a proposal; no major provider is known to be bound to read it. It is a
  convenience summary of public pages, not a crawl rule (that is `robots.txt`), a page list
  for search engines (that is `sitemap.xml`) or access control.
- What helps all readers, human or machine, is in the site's control: clear factual
  pages, consistent names in both languages, published dates and places, and answers to real
  questions. The largest remaining gap is content: see the owner items in
  [KEYWORD-AND-CONTENT-MAP.md](KEYWORD-AND-CONTENT-MAP.md).
- Blocking or allowing specific AI crawlers is a policy choice. `robots.txt` currently
  allows all crawlers on public pages. To opt out of AI training crawlers, add rules for
  their user agents (for example `GPTBot`, `Google-Extended`, `CCBot`) in
  `lib/seo/crawl.ts`; this does not remove content already collected.
