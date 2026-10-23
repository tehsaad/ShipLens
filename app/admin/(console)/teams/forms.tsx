"use client";

import { useActionState } from "react";
import { Field, FormMessages, Select, SubmitButton } from "@/components/admin/form";
import { initialFormState } from "@/lib/form-state";
import { assignMemberAction, createTeamAction, renameTeamAction } from "./actions";

export function CreateTeamForm({
  branches,
}: {
  branches: { id: string; code: string; name: string }[] | null;
}) {
  const [state, action] = useActionState(createTeamAction, initialFormState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3" noValidate>
      <div className="sm:col-span-3">
        <FormMessages state={state} />
      </div>
      <Field name="name" label="Team name" state={state} maxLength={60} />
      {branches ? (
        <Field name="branchId" label="Branch" state={state}>
          {(props) => (
            <Select {...props} defaultValue="">
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
      <div className="sm:col-span-3">
        <SubmitButton pendingLabel="Creating…">Create team</SubmitButton>
      </div>
    </form>
  );
}

export function RenameTeamForm({ id, name }: { id: string; name: string }) {
  const [state, action] = useActionState(renameTeamAction, initialFormState);
  return (
    <form action={action} className="grid gap-4 sm:max-w-sm" noValidate>
      <input type="hidden" name="id" value={id} />
      <FormMessages state={state} />
      <Field name="name" label="Team name" state={state} defaultValue={name} maxLength={60} />
      <div>
        <SubmitButton>Rename</SubmitButton>
      </div>
    </form>
  );
}

export function AssignMemberForm({
  id,
  candidates,
}: {
  id: string;
  candidates: { id: string; memberCode: string; fullName: string }[];
}) {
  const [state, action] = useActionState(assignMemberAction, initialFormState);
  if (candidates.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Every member of this branch is in the team.</p>
    );
  }
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3" noValidate>
      <input type="hidden" name="id" value={id} />
      <div className="sm:col-span-3">
        <FormMessages state={state} />
      </div>
      <Field name="memberId" label="Member" state={state}>
        {(props) => (
          <Select {...props} defaultValue="">
            <option value="">Choose a member</option>
            {candidates.map((member) => (
              <option key={member.id} value={member.id}>
                {member.memberCode} · {member.fullName}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field name="roleInTeam" label="Role in team (optional)" state={state} maxLength={60} />
      <div className="self-end">
        <SubmitButton pendingLabel="Adding…">Add to team</SubmitButton>
      </div>
    </form>
  );
}
