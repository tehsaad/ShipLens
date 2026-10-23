"use client";

import { useActionState, useState } from "react";
import { Field, FormMessages, Select, SubmitButton } from "@/components/admin/form";
import type { Locale, Role } from "@/lib/generated/prisma/enums";
import { initialFormState } from "@/lib/form-state";
import { ROLE_LABELS } from "@/lib/labels";
import { PASSWORD_MIN_LENGTH } from "@/lib/validation/limits";
import {
  createUserAction,
  resetPasswordAction,
  setUserActiveAction,
  updateUserAction,
} from "./actions";

type BranchOption = { id: string; code: string; name: string };
type FormStateValue = Parameters<typeof Field>[0]["state"];

function RoleAndBranch({
  state,
  branches,
  role: initialRole = "BRANCH_LEAD",
  branchId,
}: {
  state: FormStateValue;
  branches: BranchOption[];
  role?: Role;
  branchId?: string | null;
}) {
  // Controlled, so the branch field can follow it; restored after a failed submission.
  const [role, setRole] = useState<Role>(
    (state.values?.["role"] as Role | undefined) ?? initialRole,
  );
  return (
    <>
      <Field name="role" label="Role" state={state}>
        {(props) => (
          <Select
            id={props.id}
            name={props.name}
            aria-invalid={props["aria-invalid"]}
            aria-describedby={props["aria-describedby"]}
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
          >
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {role === "BRANCH_LEAD" ? (
        <Field name="branchId" label="Branch" state={state}>
          {(props) => (
            <Select defaultValue={branchId ?? ""} {...props}>
              <option value="">Choose a branch</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.code} · {branch.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}
    </>
  );
}

export function CreateUserForm({ branches }: { branches: BranchOption[] }) {
  const [state, action] = useActionState(createUserAction, initialFormState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3" noValidate>
      <div className="sm:col-span-3">
        <FormMessages state={state} />
      </div>
      <Field name="name" label="Name" state={state} required />
      <Field name="email" label="Email" state={state} type="email" required />
      <Field
        name="password"
        label="Temporary password"
        state={state}
        type="password"
        autoComplete="new-password"
        hint={`At least ${PASSWORD_MIN_LENGTH} characters. The user must change it at first sign-in.`}
      />
      <RoleAndBranch state={state} branches={branches} />
      <div className="sm:col-span-3">
        <SubmitButton pendingLabel="Creating…">Create user</SubmitButton>
      </div>
    </form>
  );
}

export function EditUserForm({
  user,
  branches,
}: {
  user: { id: string; name: string; role: Role; branchId: string | null; locale: Locale };
  branches: BranchOption[];
}) {
  const [state, action] = useActionState(updateUserAction, initialFormState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <input type="hidden" name="id" value={user.id} />
      <div className="sm:col-span-2">
        <FormMessages state={state} />
      </div>
      <Field name="name" label="Name" state={state} defaultValue={user.name} />
      <Field name="locale" label="Language" state={state}>
        {(props) => (
          <Select defaultValue={user.locale} {...props}>
            <option value="en">English</option>
            <option value="ur">اردو (Urdu)</option>
          </Select>
        )}
      </Field>
      <RoleAndBranch state={state} branches={branches} role={user.role} branchId={user.branchId} />
      <div className="sm:col-span-2">
        <SubmitButton>Save</SubmitButton>
      </div>
    </form>
  );
}

export function ActiveForm({ id, isActive }: { id: string; isActive: boolean }) {
  const [state, action] = useActionState(setUserActiveAction, initialFormState);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={isActive ? "false" : "true"} />
      <FormMessages state={state} />
      <div>
        <SubmitButton variant={isActive ? "destructive" : "default"}>
          {isActive ? "Deactivate account" : "Reactivate account"}
        </SubmitButton>
      </div>
    </form>
  );
}

export function ResetPasswordForm({ id }: { id: string }) {
  const [state, action] = useActionState(resetPasswordAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:max-w-sm" noValidate>
      <input type="hidden" name="id" value={id} />
      <FormMessages state={state} />
      <Field
        name="password"
        label="New temporary password"
        state={state}
        type="password"
        autoComplete="new-password"
        hint="Also clears a sign-in lockout."
      />
      <div>
        <SubmitButton pendingLabel="Resetting…">Reset password</SubmitButton>
      </div>
    </form>
  );
}
