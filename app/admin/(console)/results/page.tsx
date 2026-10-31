import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Cell, DataTable, PageHeader, Section } from "@/components/admin/page";
import { requirePermission } from "@/lib/auth/session";
import { formatBusinessDate } from "@/lib/dates";
import { can, scopeFor } from "@/lib/permissions";
import { serviceContext } from "@/lib/server-action";
import { listBranchOptions, listResults } from "@/lib/services/results";
import { CreateResultForm } from "./forms";

export const metadata: Metadata = { title: "Results" };

export default async function ResultsPage() {
  const user = await requirePermission("result.read");
  const ctx = await serviceContext(user);
  const results = await listResults(ctx);
  const canCreate = can(user, "result.create");
  // Branch leads always publish for their own branch, so they get no branch picker.
  const chooseBranch = canCreate && scopeFor(user.role, "result.create") === "all";
  const branches = chooseBranch ? await listBranchOptions(ctx) : null;

  return (
    <>
      <PageHeader
        title="Results"
        description="Achievements shown on the public results page. Drafts stay hidden until published."
      />
      {canCreate ? (
        <Section title="New result">
          <CreateResultForm branches={branches} />
        </Section>
      ) : null}
      <DataTable
        head={["Title", "Branch", "Image", "Status", "Updated"]}
        empty={results.length === 0}
      >
        {results.map((result) => (
          <tr key={result.id}>
            <Cell>
              <Link href={`/admin/results/${result.id}`} className="text-primary underline">
                {result.titleEn}
              </Link>
            </Cell>
            <Cell>{result.branch ? result.branch.code : "Network"}</Cell>
            <Cell>{result.imageUpdatedAt ? "Yes" : "—"}</Cell>
            <Cell>
              {result.status === "PUBLISHED" ? (
                <Badge tone="good">Published</Badge>
              ) : (
                <Badge>Draft</Badge>
              )}
            </Cell>
            <Cell>{formatBusinessDate(result.updatedAt)}</Cell>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
