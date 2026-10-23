"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "cn";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/lib/form-state";

export function FormMessages({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <Alert variant="destructive" aria-live="polite">
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    );
  }
  if (state.success) {
    return (
      <Alert aria-live="polite">
        <AlertDescription>{state.success}</AlertDescription>
      </Alert>
    );
  }
  return null;
}

type FieldProps = {
  name: string;
  label: string;
  state: FormState;
  hint?: ReactNode;
  children?: (props: {
    id: string;
    name: string;
    "aria-invalid"?: true;
    "aria-describedby"?: string;
    /** Present after a failed submission: what the user typed. Spread props last. */
    defaultValue?: string;
  }) => ReactNode;
} & Omit<ComponentProps<"input">, "name" | "children">;

/**
 * A labelled input (or custom control) with its field error from the form state. After a
 * failed submission the control starts from what the user typed (FormState.values).
 */
export function Field({ name, label, state, hint, children, className, ...input }: FieldProps) {
  const errors = state.fieldErrors?.[name];
  const restored = state.values?.[name];
  const id = `field-${name}`;
  const describedBy = [errors ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(" ");
  const controlProps = {
    id,
    name,
    ...(errors ? { "aria-invalid": true as const } : {}),
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
    ...(restored !== undefined ? { defaultValue: restored } : {}),
  };
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children ? children(controlProps) : <Input {...input} {...controlProps} />}
      {hint ? (
        <p id={`${id}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
      {errors ? (
        <p id={`${id}-error`} className="text-destructive text-sm">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}

const controlClass =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30";

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(controlClass, "h-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(controlClass, "min-h-20", className)} {...props} />;
}

export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  ...props
}: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
