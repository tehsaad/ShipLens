# API reference

Hamqadam has no public JSON API. The browser talks to the server in two ways:

- **[Server actions](server-actions.md)** (37). These are the forms. Every change to data goes
  through one of them.
- **[Route handlers](routes.md)** (9). These cover file exports (CSV and PDF), the Auth.js
  endpoints and the health check.

Each entry was read from its source file and the service it calls. The permission column uses
the action names of `lib/permissions.ts`; [permissions.md](../permissions.md) shows which roles
hold each one.

## How a server action runs

1. **Sign-in check.** `requireUser()` loads the signed-in user fresh from the database:
   - with no session, it redirects to `/admin/login`;
   - until the first-login password change is done, it redirects to `/admin/change-password`.

   The two public forms skip this step.

2. **Parse the record id.** The `id` field (the record being changed) must be a UUID. A
   malformed id fails with an error, not a form message.
3. **Validate the input.** The form fields are parsed with the Zod schema named in the tables.
   A failure returns the field errors and keeps what the user typed. Password fields are never
   echoed back.
4. **Run the service.** The service:
   - authorizes the action for the record's branch (`authorize` or `listScope`);
   - applies the business rules;
   - writes the change and its audit entry in one transaction.
5. **Return the result.** An `AppError` (403, 404, conflict or a rule) becomes a message on the
   form. Anything else is an internal error: the user sees a generic page with a digest, and
   the server log has the matching line.
6. **Report success.** On success the action either returns a message (shown on the form) or
   redirects to the new record.

The result type of the admin forms is `FormState` (`lib/form-state.ts`):

```ts
{ error: string | null; success?: string | null;
  fieldErrors?: Record<string, string[]>; values?: Record<string, string> }
```

The two public forms return `PublicFormState`, whose messages are translation keys, so the page
shows them in English or Urdu:

```ts
{ ok: boolean; formError: "checkFields" | "rateLimited" | "applicationRejected" | null;
  fieldErrors?: Record<string, string[]> }
```

## Cross-site request forgery

- **Server actions** accept only POST requests whose `Origin` matches the host. Next.js checks
  this.
- **Auth.js POST endpoints** require its CSRF token.
- **Route handlers** are GET only and change nothing. An export writes one audit entry, and
  its file goes only to the signed-in user.
