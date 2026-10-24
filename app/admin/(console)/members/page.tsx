import type { Metadata } from "next";
import Link from "next/link";
import { Select } from "@/components/admin/form";
import {
  Cell,
  DataTable,
  ExportLink,
  PageHeader,
  Pagination,
  exportHref,
} from "@/components/admin/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requirePermission } from "@/lib/auth/session";
import { formatDateOnly } from "@/lib/dates";
import { MEMBER_STATUS_LABELS } from "@/lib/labels";
import { can, scopeFor } from "@/lib/permissions";
import { serviceContext } from "@/lib/server-action";
import { listBranches } from "@/lib/services/branches";
import { listMembers } from "@/lib/services/members";
import { listTeams } from "@/lib/services/teams";
import { pageSchema } from "@/lib/validation/common";
import { memberFiltersSchema } from "@/lib/validation/members";
import { MemberStatusBadge } from "./status-badge";

export const metadata: Metadata = { title: "Members" };

type Search = Partial<
  Record<"q" | "branchId" | "teamId" | "status" | "joinedFrom" | "joinedTo" | "page", string>
>;

export default async function MembersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requirePermission("member.read");
  const search = await searchParams;
  const filters = memberFiltersSchema.parse({
    q: search.q || null,
    branchId: search.branchId || null,
    teamId: search.teamId || null,
    status: search.status || null,
    joinedFrom: search.joinedFrom || null,
    joinedTo: search.joinedTo || null,
  });
  const page = pageSchema.parse(search.page);
  const ctx = await serviceContext(user);
  const allBranches = scopeFor(user.role, "member.read") === "all";
  const [members, branches, teams] = await Promise.all([
    listMembers(ctx, { ...filters, page }),
    allBranches ? listBranches(ctx) : Promise.resolve([]),
    listTeams(ctx, { branchId: filters.branchId }),
  ]);

  return (
    <>
      <PageHeader
        title="Members"
        description="Members are created by accepting volunteer applications."
        actions={
          can(user, "member.export") ? (
            <ExportLink href={exportHref("/admin/members/export", search)}>Download CSV</ExportLink>
          ) : null
        }
      />
      <form className="flex flex-wrap items-end gap-3" role="search">
        <Input
          name="q"
          placeholder="Name, code, email or phone"
          defaultValue={search.q ?? ""}
          className="w-64"
          aria-label="Search"
        />
        {allBranches ? (
          <Select
            name="branchId"
            defaultValue={filters.branchId ?? ""}
            aria-label="Branch"
            className="w-48"
          >
            <option value="">Any branch</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.code} · {branch.name}
              </option>
            ))}
          </Select>
        ) : null}
        <Select
          name="teamId"
          defaultValue={filters.teamId ?? ""}
          aria-label="Team"
          className="w-48"
        >
          <option value="">Any team</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.branch.code} · {team.name}
            </option>
          ))}
        </Select>
        <Select
          name="status"
          defaultValue={filters.status ?? ""}
          aria-label="Status"
          className="w-36"
        >
          <option value="">Any status</option>
          {Object.entries(MEMBER_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <label className="grid gap-1 text-sm">
          Joined from
          <Input
            type="date"
            name="joinedFrom"
            defaultValue={search.joinedFrom ?? ""}
            className="w-40"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Joined to
          <Input
            type="date"
            name="joinedTo"
            defaultValue={search.joinedTo ?? ""}
            className="w-40"
          />
        </label>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>
      <DataTable
        head={["Code", "Name", "Email", "Phone", "Branch", "Teams", "Joined", "Status"]}
        empty={members.items.length === 0}
      >
        {members.items.map((member) => (
          <tr key={member.id}>
            <Cell>
              <Link
                href={`/admin/members/${member.id}`}
                className="text-primary font-mono underline"
              >
                {member.memberCode}
              </Link>
            </Cell>
            <Cell>{member.fullName}</Cell>
            <Cell>{member.email}</Cell>
            <Cell>{member.phone}</Cell>
            <Cell>{member.branch.code}</Cell>
            <Cell>{member.teams.map((row) => row.team.name).join(", ") || "—"}</Cell>
            <Cell>{formatDateOnly(member.joinedAt)}</Cell>
            <Cell>
              <MemberStatusBadge status={member.status} />
            </Cell>
          </tr>
        ))}
      </DataTable>
      <Pagination
        page={members.page}
        pageCount={members.pageCount}
        total={members.total}
        basePath="/admin/members"
        params={{
          q: search.q,
          branchId: search.branchId,
          teamId: search.teamId,
          status: search.status,
          joinedFrom: search.joinedFrom,
          joinedTo: search.joinedTo,
        }}
      />
    </>
  );
}
