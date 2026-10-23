import type { Metadata } from "next";
import Link from "next/link";
import { Select } from "@/components/admin/form";
import { Badge, Cell, DataTable, PageHeader, Pagination, Section } from "@/components/admin/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requirePermission } from "@/lib/auth/session";
import { Role } from "@/lib/generated/prisma/enums";
import { ROLE_LABELS } from "@/lib/labels";
import { serviceContext } from "@/lib/server-action";
import { listAssignableBranches, listUsers } from "@/lib/services/users";
import { pageSchema } from "@/lib/validation/common";
import { CreateUserForm } from "./forms";

export const metadata: Metadata = { title: "Users" };

type Search = { q?: string; role?: string; active?: string; page?: string };

export default async function UsersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requirePermission("user.read");
  const search = await searchParams;
  const role = Object.values(Role).find((value) => value === search.role) ?? null;
  const active = search.active === "yes" ? true : search.active === "no" ? false : null;
  const page = pageSchema.parse(search.page);
  const ctx = await serviceContext(user);
  const [users, branches] = await Promise.all([
    listUsers(ctx, { q: search.q?.trim().slice(0, 100) || null, role, active, page }),
    listAssignableBranches(ctx),
  ]);

  return (
    <>
      <PageHeader title="Users" description="Staff accounts. Each user has exactly one role." />
      <Section title="New user">
        <CreateUserForm branches={branches} />
      </Section>
      <form className="flex flex-wrap items-end gap-3" role="search">
        <Input
          name="q"
          placeholder="Name or email"
          defaultValue={search.q ?? ""}
          className="w-56"
          aria-label="Search"
        />
        <Select name="role" defaultValue={role ?? ""} aria-label="Role" className="w-44">
          <option value="">All roles</option>
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          name="active"
          defaultValue={search.active ?? ""}
          aria-label="Status"
          className="w-36"
        >
          <option value="">Any status</option>
          <option value="yes">Active</option>
          <option value="no">Deactivated</option>
        </Select>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>
      <DataTable
        head={["Name", "Email", "Role", "Branch", "Status"]}
        empty={users.items.length === 0}
      >
        {users.items.map((row) => (
          <tr key={row.id}>
            <Cell>
              <Link href={`/admin/users/${row.id}`} className="text-primary underline">
                {row.name}
              </Link>
            </Cell>
            <Cell>{row.email}</Cell>
            <Cell>{ROLE_LABELS[row.role]}</Cell>
            <Cell>{row.branch?.code ?? "—"}</Cell>
            <Cell>
              {row.isActive ? (
                <Badge tone="good">Active</Badge>
              ) : (
                <Badge tone="bad">Deactivated</Badge>
              )}{" "}
              {row.mustChangePassword ? <Badge tone="warn">Must change password</Badge> : null}
            </Cell>
          </tr>
        ))}
      </DataTable>
      <Pagination
        page={users.page}
        pageCount={users.pageCount}
        total={users.total}
        basePath="/admin/users"
        params={{ q: search.q, role: role ?? undefined, active: search.active }}
      />
    </>
  );
}
