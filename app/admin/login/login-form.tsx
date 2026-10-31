"use client";

import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, type LoginState } from "../actions";

const initialState: LoginState = { error: null };

// The demo password is injected only on the demo deployment (NEXT_PUBLIC_DEMO_PASSWORD).
// When it is absent — on real production — the demo panel does not render at all.
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD;

const DEMO_ACCOUNTS = [
  { label: "Super Admin", email: "super.admin@demo.hamqadam.test" },
  { label: "Finance Reviewer", email: "finance.reviewer@demo.hamqadam.test" },
  { label: "Content Editor", email: "content.editor@demo.hamqadam.test" },
  { label: "HR Lead", email: "hr.lead@demo.hamqadam.test" },
  { label: "Branch Lead (Karachi)", email: "lead.kar001@demo.hamqadam.test" },
] as const;

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {DEMO_PASSWORD ? (
        <section
          aria-labelledby="demo-accounts"
          className="bg-muted/40 grid gap-3 rounded-lg border p-4"
        >
          <div className="grid gap-1">
            <h2 id="demo-accounts" className="text-sm font-semibold">
              Demo accounts
            </h2>
            <p className="text-muted-foreground text-xs">
              For reviewers — pick a role to fill the form, then press Sign in. Shared password:{" "}
              <code className="bg-background rounded px-1 py-0.5 font-mono text-[0.7rem]">
                {DEMO_PASSWORD}
              </code>
            </p>
          </div>
          <ul className="grid gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <li key={account.email} className="flex items-center justify-between gap-3">
                <span className="grid">
                  <span className="text-sm font-medium">{account.label}</span>
                  <span className="text-muted-foreground font-mono text-xs break-all">
                    {account.email}
                  </span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(DEMO_PASSWORD);
                  }}
                >
                  Fill
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
