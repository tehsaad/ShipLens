"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { demoSignIn, login, type LoginState } from "../actions";

const initialState: LoginState = { error: null };

const DEMO_ACCOUNTS = [
  { label: "Super Admin", email: "super.admin@demo.hamqadam.test" },
  { label: "Finance Reviewer", email: "finance.reviewer@demo.hamqadam.test" },
  { label: "Content Editor", email: "content.editor@demo.hamqadam.test" },
  { label: "HR Lead", email: "hr.lead@demo.hamqadam.test" },
  { label: "Branch Lead (Karachi)", email: "lead.kar001@demo.hamqadam.test" },
] as const;

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);
  const [demoState, demoAction, demoPending] = useActionState(demoSignIn, initialState);

  return (
    <div className="grid gap-6">
      <form action={formAction} className="grid gap-4" noValidate>
        {state.error ? (
          <Alert variant="destructive" aria-live="polite">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="username" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <section
        aria-labelledby="demo-accounts"
        className="bg-muted/40 grid gap-3 rounded-lg border p-4"
      >
        <div className="grid gap-1">
          <h2 id="demo-accounts" className="text-sm font-semibold">
            Demo accounts
          </h2>
          <p className="text-muted-foreground text-xs">
            For reviewers — one click to sign in as any role. No email or password needed.
          </p>
        </div>
        {demoState.error ? (
          <Alert variant="destructive" aria-live="polite">
            <AlertDescription>{demoState.error}</AlertDescription>
          </Alert>
        ) : null}
        <form action={demoAction} className="grid gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <Button
              key={account.email}
              type="submit"
              name="demoEmail"
              value={account.email}
              variant="outline"
              className="w-full justify-start"
              disabled={demoPending}
            >
              Enter as {account.label}
            </Button>
          ))}
        </form>
      </section>
    </div>
  );
}
