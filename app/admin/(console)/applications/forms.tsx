"use client";

import { useActionState } from "react";
import { Field, FormMessages, Select, SubmitButton, Textarea } from "@/components/admin/form";
import { initialFormState } from "@/lib/form-state";
import { BRANCH_STATUS_LABELS } from "@/lib/labels";
import type { BranchStatus } from "@/lib/generated/prisma/enums";
import { acceptApplicationAction, declineApplicationAction } from "./actions";

type BranchOption = { id: string; code: string; name: string; status: BranchStatus };

export function AcceptForm({
  id,
  preferredBranchId,
  branches,
  today,
}: {
  id: string;
  preferredBranchId: string;
  branches: BranchOption[];
  today: string;
}) {
  const [state, action] = useActionState(acceptApplicationAction, initialFormState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <input type="hidden" name="id" value={id} />
      <div className="sm:col-span-2">
        <FormMessages state={state} />
      </div>
      <Field name="branchId" label="Member's branch" state={state}>
        {(props) => (
          <Select
            {...props}
            defaultValue={branches.some((b) => b.id === preferredBranchId) ? preferredBranchId : ""}
          >
            <option value="">Preferred branch</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.code} · {branch.name} ({BRANCH_STATUS_LABELS[branch.status]})
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field
        name="joinedAt"
        label="Joined on"
        state={state}
        type="date"
        defaultValue={today}
        max={today}
      />
      <div className="sm:col-span-2">
        <SubmitButton pendingLabel="Accepting…">Accept and create member</SubmitButton>
      </div>
    </form>
  );
}

export function DeclineForm({ id }: { id: string }) {
  const [state, action] = useActionState(declineApplicationAction, initialFormState);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="id" value={id} />
      <FormMessages state={state} />
      <Field
        name="reason"
        label="Internal reason"
        state={state}
        hint="Never shown to the applicant."
      >
        {(props) => <Textarea maxLength={1000} {...props} />}
      </Field>
      <div>
        <SubmitButton variant="destructive" pendingLabel="Declining…">
          Decline
        </SubmitButton>
      </div>
    </form>
  );
}
