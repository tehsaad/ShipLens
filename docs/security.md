# Security checklist (OWASP Top 10)

How each requirement in `docs/SPEC.md` section 8 is met, where the code is, and which tests
prove it. Paths are relative to the repository root.

## A01 Broken access control

- **Central permission matrix.** `lib/permissions.ts` defines every action and the roles that
  may perform it. Every service calls `authorize` before it reads or writes; the UI hides
  controls as a convenience only.
- **Branch scoping.** `listScope` (`lib/services/shared.ts`) puts a Branch Lead's own branch
  into the query, whatever branch the request names.
  - The list pages and their CSV exports share one query builder per entity, so they cannot
    drift (`collectionWhere`, `memberWhere`, `reportWhere`, `applicationWhere`).
- **Status codes.** Out-of-scope records answer 404 and forbidden actions 403.
  - Pages call `requirePermission` (`lib/auth/session.ts`), which uses `notFound()` and
    `forbidden()`.
  - Export route handlers answer with the same status codes as plain text
    (`lib/route-handler.ts`).
- **Proxy.** `proxy.ts` redirects signed-out visitors away from `/admin`. Pages, actions and
  route handlers check the user again themselves.
- **Tests.**
  - The permission matrix: `tests/unit/permissions.test.ts`.
  - IDOR and scope: `tests/integration/members-teams.test.ts`, `collections.test.ts`,
    `exports.test.ts` and `pdf-exports.test.ts`.
  - Super Admin–only audit log: `audit-log.test.ts`.
  - In the browser (`e2e/access.spec.ts`): for each role, the pages and exports outside its
    permissions answer 403 and another branch's records answer 404. For Super Admin, the
    Finance Reviewer's Approve form replayed under the Super Admin session changes nothing
    and writes no approval.

## A02 Cryptographic failures

- **Passwords.** Hashed with Argon2id (`lib/auth/password.ts`).
- **HTTPS.** Render serves the site over HTTPS only. Production responses carry HSTS for two
  years (`lib/security-headers.ts`).
- **Session cookie.** Auth.js sets it `httpOnly` and `SameSite=Lax`. On HTTPS it is also
  `Secure` with the `__Secure-` prefix.
- **Secrets.** They come only from environment variables. Zod validates them at boot
  (`lib/env.ts`, `instrumentation-node.ts`), and the server refuses to start without them.
  `.env` files are git-ignored.

## A03 Injection

- **Database access.** All queries go through Prisma's parameterised queries.
  - Raw SQL exists only in migrations, plus one constant `SELECT 1` in the health check (no
    input).
  - The monthly PDF summary uses Prisma aggregates, not raw SQL.
- **Input validation.** Every server action, route handler and service input is validated
  with Zod (`lib/validation/`). Query parameters for list filters are parsed with the same
  schemas (`filtersFrom`).
- **CSV formula injection.** Exported text starting with `=`, `+`, `-`, `@`, tab or carriage
  return gets a leading apostrophe (`lib/csv.ts`, tested in `tests/unit/csv.test.ts`).

## A04 Insecure design

- **State machines.** Branch, application and report state machines are enforced in the
  service layer (`lib/rules/`).
- **Database rules.** PostgreSQL triggers enforce the same rules:
  - the 7-day collection lock;
  - approved weeks;
  - correction limits;
  - the append-only audit log.
- **Concurrency.** Reports use optimistic locking (`version`). Accepting an application claims
  it in a single conditional update.
- **Tests.** `tests/integration/database-rules.test.ts`, `collection-rules.test.ts` and
  `reports.test.ts`.

## A05 Security misconfiguration

- **Headers on every response** (`next.config.ts` with `lib/security-headers.ts`):
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-Frame-Options: DENY`
  - a `Permissions-Policy` that turns off camera, microphone, geolocation, payment and USB
  - `Cross-Origin-Opener-Policy: same-origin`
  - HSTS, in production
- **Content security policy.** Both policies allow only same-origin sources, with
  `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` and `frame-ancestors 'none'`.
  - The public site is cached (section 9), so its pages cannot carry a nonce. Its policy
    allows inline scripts for the Next.js runtime and the theme script. Nothing on it renders
    user HTML.
  - The admin area renders on every request. `proxy.ts` gives each response a fresh nonce, and
    the policy runs only scripts that carry it (`'nonce-…' 'strict-dynamic'`).
  - Inline styles are allowed in both policies, because chart and font styles cannot carry a
    nonce.
  - The policies were checked in Chromium on the production build: there were no violations
    on public pages, admin pages, charts, forms or the 403 and 404 pages.
- **Errors.** No stack traces reach users. The production build shows a generic error page
  with a digest, and the server log has the matching line.
- **Build.** The Docker image runs the production build only (`Dockerfile`), and the
  `X-Powered-By` header is off.
- **Tests.** `tests/unit/security-headers.test.ts`.

## A06 Vulnerable and outdated components

- **npm audit in CI.** `.github/workflows/ci.yml` fails on a high or critical advisory in
  production dependencies, and reports the whole tree without failing.
  - On 24 October 2026, production dependencies had no advisories. A local `npm audit` of the
    whole tree also reported one high advisory: `body-parser` 2.3.0, a dev-only transitive
    dependency (`shadcn` → `@modelcontextprotocol/sdk` → `express`) that the image does not
    ship. The fixed release came out on 22 October; Dependabot proposes it once it is a week
    old.
- **Dependabot.** `.github/dependabot.yml` proposes weekly updates for npm, GitHub Actions and
  Docker. New releases wait a week first.
  - Security alerts and security updates must also be switched on in the repository settings
    (Settings → Code security), which only the owner can do.

## A07 Identification and authentication failures

- **Lockout.** An account locks for 15 minutes after 5 failed sign-ins
  (`lib/services/authentication.ts`). Every failure shows the same generic message.
- **Rate limiting.** After 10 failed sign-ins from one IP in 15 minutes, further attempts
  from that IP are refused until the window ends (`lib/rate-limit.ts`). Successful sign-ins
  do not count, so staff switching accounts are never held up. The check runs in the
  credentials provider, so a direct POST to the Auth.js callback is limited too.
- **Sessions.** A new token is issued on sign-in. Sessions expire after 8 hours of inactivity,
  and account status is re-checked on every request.
- **Passwords.** At least 12 characters (`lib/validation/limits.ts`). Passwords set by an admin
  must be changed on first sign-in. There are no password hints.
- **Tests.** `tests/integration/authentication.test.ts`, `tests/unit/rate-limit.test.ts`.

## A08 Software and data integrity failures

- **Deploys.** Only `main` is deployed, and only after CI passes on it: the `Deploy` workflow
  (`.github/workflows/deploy.yml`) calls the Render deploy hook for the exact commit CI
  tested. CI covers lint, types, the coverage gate, the Playwright suite, the audit and the
  Docker image. The hook URL is a repository secret (`RENDER_DEPLOY_HOOK_URL`), and the
  workflow has no repository permissions.
- **Pinned inputs.**
  - `package-lock.json` is committed and CI installs with `npm ci`.
  - The Node.js base image is pinned to an exact release.
  - GitHub Actions are pinned to major versions, and Dependabot proposes their updates.

## A09 Security logging and monitoring failures

- **Audit log.** Every write and every export writes an audit entry (`lib/services/audit.ts`,
  `lib/services/exports.ts`).
  - The table is append-only: a trigger refuses changes for every role, and the `shiplens_app`
    role has no UPDATE or DELETE on it.
  - Password fields are redacted.
  - Super Admin reads it at `/admin/audit`.
- **Structured logs.** `lib/log.ts` writes one JSON line per event:
  - every server error (`instrumentation.ts`, `onRequestError`);
  - exports;
  - rate-limit refusals;
  - health-check failures.
- **Request IDs.** Each line carries the request ID: `X-Request-Id` or Render's `Rndr-Id`,
  validated first.
- **What is never logged.** Error messages and stacks, query strings, headers, passwords, form
  contents and email addresses (`tests/unit/log.test.ts`).

## A10 Server-side request forgery

The application makes no outbound HTTP requests. The only network connection is to its own
database, whose URL comes from the environment.

## Cross-site scripting

- React escapes all text.
- Markdown content is rendered without raw HTML (`skipHtml`) and sanitised with an allow-list
  (`rehype-sanitize`).
- The CSP above limits what an injected script could do, and in the admin area it blocks any
  script without the nonce.

## Cross-site request forgery

- **Cookie.** The session cookie is `SameSite=Lax`.
- **Server actions.** Every state change is a Next.js server action, which checks that the
  `Origin` header matches the host.
- **Auth.js.** Its own POST endpoints (sign-in, sign-out) require its CSRF token.
- **No other POST routes.** The application's route handlers (exports, health) are GET only and
  change nothing. An export adds one audit entry, and its file goes only to the signed-in user.

## Rate limiting

| Endpoint                     | Limit                    | Where                                  |
| ---------------------------- | ------------------------ | -------------------------------------- |
| Staff sign-in (failures)     | 10 per 15 minutes per IP | `lib/auth/index.ts`                    |
| Volunteer application (§7.1) | 5 per hour per IP        | `app/[locale]/get-involved/actions.ts` |
| Contact form                 | 5 per hour per IP        | `app/[locale]/contact/actions.ts`      |

- **Single instance.** The limiter keeps its counters in memory, so it holds for one instance
  (documented in `docs/handover.md`). Section 8 allows this. Its store is capped at 10,000
  keys.
- **Client IP.** On Render the IP comes from `CF-Connecting-IP`, the header Render's
  Cloudflare edge sets (`TRUSTED_CLIENT_IP_HEADER=cf-connecting-ip`, `lib/request-context.ts`).
  - **Why not `X-Forwarded-For`:** Render keeps a client-supplied `X-Forwarded-For` and appends
    to it, so its first entry is whatever the client sent. A live sign-in with a made-up
    `X-Forwarded-For` was recorded with that address before the fix.
  - **How the header was chosen:** the server logs once per start which forwarding headers
    arrive (`"event":"clientIp.headers"`, names and counts only). On Render these are
    `CF-Connecting-IP`, `True-Client-IP` and `X-Forwarded-For`.
  - **Checks on the live site (24 October 2026):**
    - Cloudflare refuses (403) any request that already carries a `CF-Connecting-IP` header,
      so a client cannot forge it.
    - A sign-in with made-up `X-Forwarded-For` and `True-Client-IP` headers was recorded with
      the real client address.
  - **Behaviour:** when the setting is present, only that header is read. A request without it
    has no known address and shares one rate-limit key. Values that are not IP addresses are
    discarded. Without the setting (local development), the first `X-Forwarded-For` entry is
    used.

## Data minimisation

- No national ID is collected.
- Applicant data is visible to HR Lead and Super Admin only.
- The applications CSV leaves out the free-text answers.
- Audit entries for public submissions record ids only.
