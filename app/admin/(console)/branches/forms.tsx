"use client";

import { useActionState } from "react";
import { Field, FormMessages, Select, SubmitButton } from "@/components/admin/form";
import type { BranchStatus } from "@/lib/generated/prisma/enums";
import { initialFormState } from "@/lib/form-state";
import { BRANCH_STATUS_LABELS } from "@/lib/labels";
import { changeBranchStatusAction, createBranchAction, updateBranchAction } from "./actions";

export function CreateBranchForm() {
  const [state, action] = useActionState(createBranchAction, initialFormState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3" noValidate>
      <div className="sm:col-span-3">
        <FormMessages state={state} />
      </div>
      <Field name="name" label="Name" state={state} required maxLength={100} />
      <Field
        name="city"
        label="City"
        state={state}
        required
        maxLength={60}
        hint="Its first three letters form the code, e.g. Karachi → BR-KAR-003."
      />
      <Field
        name="contactEmail"
        label="Public contact email (optional)"
        state={state}
        type="email"
      />
      <div>
        <SubmitButton pendingLabel="Creating…">Create branch</SubmitButton>
      </div>
    </form>
  );
}

type Candidate = { id: string; name: string; email: string };

export function EditBranchForm({
  branch,
  candidates,
}: {
  branch: { id: string; name: string; contactEmail: string | null; leadUserId: string | null };
  candidates: Candidate[];
}) {
  const [state, action] = useActionState(updateBranchAction, initialFormState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <input type="hidden" name="id" value={branch.id} />
      <div className="sm:col-span-2">
        <FormMessages state={state} />
      </div>
      <Field name="name" label="Name" state={state} defaultValue={branch.name} required />
      <Field
        name="contactEmail"
        label="Public contact email (optional)"
        state={state}
        type="email"
        defaultValue={branch.contactEmail ?? ""}
      />
      <Field
        name="leadUserId"
        label="Branch lead"
        state={state}
        hint="Active Branch Lead users assigned to this branch."
      >
        {(props) => (
          <Select defaultValue={branch.leadUserId ?? ""} {...props}>
            <option value="">No lead</option>
            {candidates.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.email})
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton>Save</SubmitButton>
      </div>
    </form>
  );
}

export function BranchStatusForm({
  id,
  options,
}: {
  id: string;
  options: readonly BranchStatus[];
}) {
  const [state, action] = useActionState(changeBranchStatusAction, initialFormState);
  if (options.length === 0) {
    return <p className="text-muted-foreground text-sm">A closed branch cannot change status.</p>;
  }
  return (
    <form action={action} className="grid gap-4 sm:max-w-sm" noValidate>
      <input type="hidden" name="id" value={id} />
      <FormMessages state={state} />
      <Field name="status" label="New status" state={state}>
        {(props) => (
          <Select defaultValue={options[0]} {...props}>
            {options.map((status) => (
              <option key={status} value={status}>
                {BRANCH_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div>
        <SubmitButton pendingLabel="Changing…">Change status</SubmitButton>
      </div>
    </form>
  );
}
