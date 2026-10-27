# ADR 0002: Authentication and sessions

- **Status:** Accepted
- **Recorded:** 26 October 2026 (decided in Phase 1)

## Context

Only staff sign in; the public site is anonymous. Section 7.2 requires:

- email and password sign-in;
- a lockout after repeated failures;
- sessions that end after 8 hours of inactivity;
- a password change on first login.

Section 8 asks for Argon2id, generic error messages and protection against credential
stuffing.

## Decision

- **Auth.js v5 credentials provider** (`lib/auth/index.ts`). `authorize` validates the input
  with Zod and calls `authenticate` (`lib/services/authentication.ts`), which owns all the
  rules:
  - **Argon2id** (`lib/auth/password.ts`: memory 19 MiB, 2 iterations, parallelism 1).
  - **Constant work.** An unknown, inactive or locked account is still checked against a
    dummy hash, so response times do not reveal which accounts exist.
  - **Lockout.** After 5 consecutive failures, the account locks for 15 minutes. The counter
    resets on success.
  - **Audit.** Every attempt is audited. A failure for an unknown email does not record the
    typed text, because it may be a password entered in the wrong field.
- **Rate limit.** A failure-only rate limit sits in front: 10 failed sign-ins per IP per 15
  minutes (`lib/rate-limit.ts`). Successful sign-ins never count.
- **JWT sessions** (`lib/auth/config.ts`):
  - The token carries only the user id.
  - `maxAge` is 8 hours, and every authenticated request re-issues the token, so the limit
    is an idle timeout.
  - Role, branch, active flag and the password-change flag are read from the database once
    per request (`getSessionUser`, `lib/auth/session.ts`). Deactivating a user ends their
    access on their next request.
- **First login.** Users created by an admin carry `mustChangePassword`. `requireUser`
  redirects them to `/admin/change-password` until they choose a new password (decision 5).
  Seeded demo users start without the flag (decision 5a).
- **Gatekeeping in layers:**
  1. `proxy.ts` redirects signed-out visitors away from `/admin` to the login page.
  2. Every page, server action and route handler checks the user again. The proxy is a
     convenience, not the security boundary.

## Consequences

- **No session table.** Revoking a single token is not possible, but a deactivated account is
  refused on the next request. Rotating `AUTH_SECRET` signs everyone out.
- **The proxy stays light.** It needs no database: it only decodes the JWT. The database is
  read once per request in the app.
- **Pinned beta.** Auth.js v5 is still a beta; the version is pinned (ADR 0001).

## Evidence

- `tests/integration/authentication.test.ts`: lockout, generic failures and audit entries.
- `tests/unit/rate-limit.test.ts`: the per-IP rate limit.
- `e2e/auth.setup.ts`: real sign-ins through the form.
