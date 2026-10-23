import type { Metadata } from "next";
import Link from "next/link";
import { Select } from "@/components/admin/form";
import { Cell, DataTable, PageHeader, Pagination, Section } from "@/components/admin/page";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/session";
import { addDays, businessToday, formatBusinessDate, formatDateOnly } from "@/lib/dates";
import { REPORT_STATUS_LABELS } from "@/lib/labels";
import { can, scopeFor } from "@/lib/permissions";
import { serviceContext } from "@/lib/server-action";
import { listBranches } from "@/lib/services/branches";
import { listReports } from "@/lib/services/reports";
import { pageSchema } from "@/lib/validation/common";
import { reportFiltersSchema } from "@/lib/validation/reports";
import { WeekPicker } from "./forms";
import { ReportStatusBadge } from "./status-badge";

export const metadata: Metadata = { title: "Weekly reports" };

type Search = Partial<Record<"status" | "branchId" | "page", string>>;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requirePermission("report.read");
  const search = await searchParams;
  const filters = reportFiltersSchema.parse({
    status: search.status || null,
    branchId: search.branchId || null,
  });
  const page = pageSchema.parse(search.page);
  const ctx = await serviceContext(user);
  const allBranches = scopeFor(user.role, "report.read") === "all";
  const [reports, branches] = await Promise.all([
    listReports(ctx, { ...filters, page }),
    allBranches ? listBranches(ctx) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title="Weekly reports"
        description="Draft → submitted → approved, or returned with a comment and resubmitted. Approved reports are locked."
      />
      {can(user, "report.draft") ? (
        <Section title="Open a week">
          <WeekPicker today={formatDateOnly(businessToday())} />
        </Section>
      ) : null}
      <form className="flex flex-wrap items-end gap-3" role="search">
        <Select
          name="status"
          defaultValue={filters.status ?? ""}
          aria-label="Status"
          className="w-40"
        >
          <option value="">Any status</option>
          {Object.entries(REPORT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
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
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>
      <DataTable
        head={["Week", "Branch", "Status", "Submitted", "Reviewed"]}
        empty={reports.items.length === 0}
      >
        {reports.items.map((report) => (
          <tr key={report.id}>
            <Cell>
              <Link href={`/admin/reports/${report.id}`} className="text-primary underline">
                {formatDateOnly(report.weekStart)} – {formatDateOnly(addDays(report.weekStart, 6))}
              </Link>
            </Cell>
            <Cell>{report.branch.code}</Cell>
            <Cell>
              <ReportStatusBadge status={report.status} />
            </Cell>
            <Cell>{report.submittedAt ? formatBusinessDate(report.submittedAt) : "—"}</Cell>
            <Cell>{report.reviewedAt ? formatBusinessDate(report.reviewedAt) : "—"}</Cell>
          </tr>
        ))}
      </DataTable>
      <Pagination
        page={reports.page}
        pageCount={reports.pageCount}
        total={reports.total}
        basePath="/admin/reports"
        params={{ status: search.status, branchId: search.branchId }}
      />
    </>
  );
}
