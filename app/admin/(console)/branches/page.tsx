import type { Metadata } from "next";
import Link from "next/link";
import { Cell, DataTable, PageHeader, Section } from "@/components/admin/page";
import { requirePermission } from "@/lib/auth/session";
import { formatDateOnly } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { serviceContext } from "@/lib/server-action";
import { listBranches } from "@/lib/services/branches";
import { CreateBranchForm } from "./forms";
import { BranchStatusBadge } from "./status-badge";

export const metadata: Metadata = { title: "Branches" };

export default async function BranchesPage() {
  const user = await requirePermission("branch.read");
  const branches = await listBranches(await serviceContext(user));

  return (
    <>
      <PageHeader
        title="Branches"
        description="Codes are generated from the city and never change."
      />
      {can(user, "branch.create") ? (
        <Section title="New branch">
          <CreateBranchForm />
        </Section>
      ) : null}
      <DataTable
        head={["Code", "Name", "City", "Status", "Opened", "Lead"]}
        empty={branches.length === 0}
      >
        {branches.map((branch) => (
          <tr key={branch.id}>
            <Cell>
              <Link
                href={`/admin/branches/${branch.id}`}
                className="text-primary font-mono underline"
              >
                {branch.code}
              </Link>
            </Cell>
            <Cell>{branch.name}</Cell>
            <Cell>{branch.city}</Cell>
            <Cell>
              <BranchStatusBadge status={branch.status} />
            </Cell>
            <Cell>{branch.openedAt ? formatDateOnly(branch.openedAt) : "—"}</Cell>
            <Cell>{branch.leadUser?.name ?? "—"}</Cell>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
