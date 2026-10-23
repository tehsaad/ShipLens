"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword, type ChangePasswordState } from "../actions";

const initialState: ChangePasswordState = { error: null };

const FIELDS = [
  { name: "currentPassword", label: "Current password", autoComplete: "current-password" },
  { name: "newPassword", label: "New password", autoComplete: "new-password" },
  { name: "confirmPassword", label: "Confirm new password", autoComplete: "new-password" },
] as const;

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initialState);

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      {state.error ? (
        <Alert variant="destructive" aria-live="polite">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {FIELDS.map((field) => {
        const errors = state.fieldErrors?.[field.name];
        const errorId = `${field.name}-error`;
        return (
          <div key={field.name} className="grid gap-2">
            <Label htmlFor={field.name}>{field.label}</Label>
            <Input
              id={field.name}
              name={field.name}
              type="password"
              autoComplete={field.autoComplete}
              required
              aria-invalid={errors ? true : undefined}
              aria-describedby={errors ? errorId : undefined}
            />
            {errors ? (
              <p id={errorId} className="text-destructive text-sm">
                {errors[0]}
              </p>
            ) : null}
          </div>
        );
      })}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
