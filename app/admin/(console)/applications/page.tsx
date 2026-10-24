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
import { formatBusinessDate } from "@/lib/dates";
import { APPLICATION_STATUS_LABELS, AVAILABILITY_LABELS } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { serviceContext } from "@/lib/server-action";
import { listApplications } from "@/lib/services/applications";
import { listBranches } from "@/lib/services/branches";
import { applicationFiltersSchema } from "@/lib/validation/applications";
import { pageSchema } from "@/lib/validation/common";
import { ApplicationStatusBadge } from "./status-badge";

export const metadata: Metadata = { title: "Applications" };

type Search = { status?: string; branchId?: string; from?: string; to?: string; page?: string };

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await requirePermission("application.read");
  const search = await searchParams;
  const filters = applicationFiltersSchema.parse({
    status: search.status || null,
    branchId: search.branchId || null,
    from: search.from || null,
    to: search.to || null,
  });
  const page = pageSchema.parse(search.page);
  const ctx = await serviceContext(user);
  const [applications, branches] = await Promise.all([
    listApplications(ctx, { ...filters, page }),
    listBranches(ctx),
  ]);

  return (
    <>
      <PageHeader
        title="Applications"
        description="Volunteer applications from the public form, newest first."
        actions={
          can(user, "application.export") ? (
            <ExportLink href={exportHref("/admin/applications/export", search)}>
              Download CSV
            </ExportLink>
          ) : null
        }
      />
      <form className="flex flex-wrap items-end gap-3" role="search">
        <Select
          name="status"
          defaultValue={filters.status ?? ""}
          aria-label="Status"
          className="w-36"
        >
          <option value="">Any status</option>
          {Object.entries(APPLICATION_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          name="branchId"
          defaultValue={filters.branchId ?? ""}
          aria-label="Branch"
          className="w-56"
        >
          <option value="">Any branch</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.code} · {branch.name}
            </option>
          ))}
        </Select>
        <label className="grid gap-1 text-sm">
          From
          <Input type="date" name="from" defaultValue={search.from ?? ""} className="w-40" />
        </label>
        <label className="grid gap-1 text-sm">
          To
          <Input type="date" name="to" defaultValue={search.to ?? ""} className="w-40" />
        </label>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>
      <DataTable
        head={["Submitted", "Name", "Email", "Branch", "Availability", "Status"]}
        empty={applications.items.length === 0}
      >
        {applications.items.map((row) => (
          <tr key={row.id}>
            <Cell>{formatBusinessDate(row.createdAt)}</Cell>
            <Cell>
              <Link href={`/admin/applications/${row.id}`} className="text-primary underline">
                {row.fullName}
              </Link>
            </Cell>
            <Cell>{row.email}</Cell>
            <Cell>{row.preferredBranch.code}</Cell>
            <Cell>{AVAILABILITY_LABELS[row.availability]}</Cell>
            <Cell>
              <ApplicationStatusBadge status={row.status} />
            </Cell>
          </tr>
        ))}
      </DataTable>
      <Pagination
        page={applications.page}
        pageCount={applications.pageCount}
        total={applications.total}
        basePath="/admin/applications"
        params={{
          status: search.status,
          branchId: search.branchId,
          from: search.from,
          to: search.to,
        }}
      />
    </>
  );
}
