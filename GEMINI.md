# GEMINI.md: frontend brief and working rules

You are redesigning the frontend of **Hamqadam** (ہم قدم, "walking together"), a bilingual
(English and Urdu) platform for a network of volunteer branches across Pakistan and their
head office. Read this file before every task. The backend, database, security, SEO and test
infrastructure are finished and owned by Claude (the other AI working on this repository).
Your job is the visual design, layout, interaction and motion. Nothing in the behaviour,
data or URLs changes.

Read also: `README.md` (overview, commands), `docs/SPEC.md` sections 7 and 9 (screens and
non-functional requirements), `docs/seo/IMPLEMENTATION.md` (what the SEO layer does), and
`node_modules/next/dist/docs/` for the Next.js 16 APIs (this version differs from older
training data).

## What you own

- Presentation in `app/[locale]/**` (public site) and `app/admin/**` (staff area): JSX,
  layout and styling of pages and layouts.
- `components/site/**`, `components/ui/**`, the presentation parts of `components/admin/**`.
- `app/globals.css` (design tokens, Tailwind CSS v4 theme), `lib/fonts.ts`, `app/icon.svg`.
- `public/` assets, and the colours in `scripts/og-images.mjs` (then run `npm run og:images`).
- New message keys for new visible text, added to **both** `messages/en.json` and
  `messages/ur.json`.

## What you must not change (ask Claude through the pull request instead)

- `lib/**`: services, permissions, validation (Zod), auth, SEO helpers, PDF and CSV exports.
- `prisma/**`, `proxy.ts`, `next.config.ts`, `app/**/actions.ts` (server actions),
  `app/**/route.ts`, `app/robots.ts`, `app/sitemap.ts`, `app/llms.txt/`.
- Existing message keys: never rename or delete one; the parity test fails if `en` and `ur`
  differ.
- URLs and routes, form field names, the data each page loads.
- `.github/workflows/**`. Tests: see "Tests" below.

## Hard rules

1. **Server components by default.** Add `"use client"` only to small interactive or animated
   leaves. Never import a non-component value (a constant, string or object) from a
   `"use client"` file into a server component: it reaches the browser as a module reference
   and broke hydration in production once (React error 418; see
   `components/site/theme-script.ts`).
2. **Every visible string comes from the messages** through next-intl
   (`getTranslations` on the server, `useTranslations` in client components). Admin screens
   are in English and may keep literal text.
3. **Urdu is right to left.** Use logical utilities only (`ms-`, `me-`, `ps-`, `pe-`,
   `start-`, `end-`, `text-start`), never `ml-`, `mr-`, `left-`, `right-`. Mirror directional
   icons and motion in RTL. Urdu uses the Nastaliq font (`lib/fonts.ts`), which needs more
   line height (about 1.9 to 2). Check every page in `/en` and `/ur`.
4. **Content security policy.** No external scripts, fonts, images, iframes or CDNs: load
   fonts with `next/font`, put images in `public/`, write icons with `lucide-react` or inline
   SVG. Inline styles are allowed. The admin area uses a nonce-based policy, so never add an
   inline `<script>` there.
5. **Keep the SEO layer.** Every public page keeps:
   - its `generateMetadata` calling `pageMetadata(params, "<key>")`;
   - its `<PageJsonLd>`;
   - exactly one `<h1>`;
   - landmarks (`header`, `nav`, `main#main`, `footer`) and the skip link;
   - primary content rendered on the server (never only after JavaScript runs);
   - the related links, and internal links that answer 200 without a redirect.
6. **Accessibility: WCAG 2.1 AA**, in light and dark themes and both languages:
   - contrast at least 4.5:1 for text and 3:1 for UI parts;
   - a visible focus ring;
   - a label for every input, with errors linked through `aria-describedby`;
   - accessible names that start with the visible text;
   - nothing that works only on hover.
7. **Motion rules:**
   - Honour `prefers-reduced-motion` (turn non-essential motion off).
   - Animate only `transform` and `opacity`.
   - Never hide the largest above-the-fold element (the hero heading) behind a load
     animation.
   - No layout shift: cumulative layout shift below 0.1.
   - No animation that loops forever in the reading area.
8. **Performance budget:** Lighthouse mobile **90 or more** on Home, Programs and Branches, in
   both languages. Keep first-load JavaScript of public pages close to today's. A motion
   library (for example `motion`) is acceptable only inside client leaves and loaded where it
   is used. Prefer CSS transitions, `@keyframes` and scroll-driven CSS where they are enough.
9. **Theme.** Tokens live in `app/globals.css`:
   - the public site under the `.site` scope;
   - the admin area under its own scope;
   - each with light and dark values.

   Dark mode is the `dark` class on `<html>`, set before paint by
   `components/site/theme-script.ts` and switched by `components/site/theme-toggle.tsx`.
   Keep both working.

10. **Forms** keep React Hook Form with the shared Zod schemas, the server actions, the field
    names, the honeypot field (hidden from people, present in the form) and the field-level
    error messages from `messages/*.json`.

## Tests (run them; they must stay green)

The end-to-end tests find elements by accessible name. Keep these working:

- **Sign-in:** the labels `Email` and `Password`, the button `Sign in`, and a sign-out
  button named "Sign out".
- **Weekly report cycle** (`e2e/report-cycle.spec.ts`):
  - the labels "Collected on", "Amount (PKR)", "Description (optional)", "Week containing",
    "Notes for the reviewer (optional)" and "What needs fixing (required)";
  - the buttons "Record collection", "Open week", "Save notes", "Submit report",
    "Return to Branch Lead", "Resubmit report", "Approve" and "Save changes";
  - the report header text ending "· version N";
  - the messages "Notes saved." and "Totals (frozen at submission)";
  - tables built with `tbody tr` and `td`.
- **Events** (`e2e/seo.spec.ts`): each upcoming event is an `li` inside `main`, containing an
  `h2` with the title and a `<time datetime="…">`.
- **Branches** (`e2e/seo.spec.ts`): each branch is an `li` inside `main`, with its code in a
  `dd` that has the class `font-mono`.
- `e2e/hydration.spec.ts`: no console errors on any public page.
- `e2e/accessibility.spec.ts`: axe on 9 pages × 2 languages × 2 themes.

If a redesign truly needs a different structure, change the test to an equivalent
role-based selector in the same pull request and say why. Never delete an assertion,
loosen one, or skip a test.

## Pages

**Public site.** 9 pages, each at `/en/...` and `/ur/...`:

| Page         | Route           | Shows                                                                                       |
| ------------ | --------------- | ------------------------------------------------------------------------------------------- |
| Home         | `/`             | Hero, call to action, active branch count, announcements, programs preview, upcoming events |
| About        | `/about`        | Published "about" page (Markdown) and related links                                         |
| Programs     | `/programs`     | Published programs (Markdown cards)                                                         |
| Branches     | `/branches`     | Active branches (code, city, contact email) with a city filter                              |
| Events       | `/events`       | Upcoming / past / all filter and a branch filter                                            |
| Get involved | `/get-involved` | Three steps, the volunteer application form, questions and answers                          |
| Contact      | `/contact`      | Contact form                                                                                |
| Privacy      | `/privacy`      | Static text                                                                                 |
| Terms        | `/terms`        | Static text                                                                                 |

**Shared parts:**

- header with navigation;
- language switcher (English / اردو);
- light and dark theme toggle;
- footer (Privacy, Terms, staff sign-in);
- the not-found page;
- the English-fallback notice shown when an Urdu entry is missing.

**Staff area** (`/admin`, English, behind sign-in). 23 screens:

- login and change password;
- the dashboard (KPI cards and Recharts trend charts);
- lists and detail pages for branches, users, applications, members, teams, collections,
  weekly reports (with the review cycle), content, events and contact messages;
- the audit log;
- the forbidden and not-found pages.

Each role sees only its own menu items.

## Commands

```sh
npm ci
npm run db:up            # local PostgreSQL (docker compose), then follow README "Local setup"
npm run dev              # http://localhost:3000/en
npm run lint && npm run typecheck && npm run test
npm run e2e:prepare && npm run test:e2e   # needs E2E_DATABASE_URL (docs/handover.md)
npm run og:images        # after changing brand colours
```

Demo logins: see `docs/handover.md` ("Sample data and demo logins").

## Working with Claude

1. Branch from `main` as `gemini/<topic>`, for example `gemini/theme-tokens`. Open one pull
   request per step:
   1. tokens and typography;
   2. public shell;
   3. public pages;
   4. admin shell;
   5. admin pages;
   6. motion polish.
2. In every pull request:
   - before and after screenshots of `/en` and `/ur`, light and dark, phone (390 px) and
     desktop (1440 px);
   - the Lighthouse scores of Home, Programs and Branches;
   - which tests you changed and why.
3. CI must be green. Claude reviews each pull request for:
   - accessibility, performance and SEO (`npm run seo:check`);
   - the test contracts;
   - right-to-left layout.

   Claude may push small fixes to your branch.

4. Need a backend change (new data on a page, a new field)? Describe it in the pull request
   and Claude adds it in `lib/` or the server action.
5. The project owner merges.
