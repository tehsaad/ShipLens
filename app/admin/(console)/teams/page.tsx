import type { Metadata } from "next";
import Link from "next/link";
import { Cell, DataTable, PageHeader, Section } from "@/components/admin/page";
import { requirePermission } from "@/lib/auth/session";
import { can, scopeFor } from "@/lib/permissions";
import { serviceContext } from "@/lib/server-action";
import { listBranches } from "@/lib/services/branches";
import { listTeams } from "@/lib/services/teams";
import { CreateTeamForm } from "./forms";

export const metadata: Metadata = { title: "Teams" };

export default async function TeamsPage() {
  const user = await requirePermission("team.read");
  const ctx = await serviceContext(user);
  const teams = await listTeams(ctx);
  const canCreate = can(user, "team.create");
  const pickBranch = canCreate && scopeFor(user.role, "team.create") === "all";
  const branches = pickBranch
    ? (await listBranches(ctx)).filter((branch) => branch.status !== "CLOSED")
    : null;

  return (
    <>
      <PageHeader
        title="Teams"
        description="Teams belong to one branch. Team names are unique within a branch."
      />
      {canCreate ? (
        <Section title="New team">
          <CreateTeamForm branches={branches} />
        </Section>
      ) : null}
      <DataTable head={["Branch", "Team", "Members"]} empty={teams.length === 0}>
        {teams.map((team) => (
          <tr key={team.id}>
            <Cell>{team.branch.code}</Cell>
            <Cell>
              <Link href={`/admin/teams/${team.id}`} className="text-primary underline">
                {team.name}
              </Link>
            </Cell>
            <Cell>{team._count.members}</Cell>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
