import type { Metadata } from "next";
import Link from "next/link";
import { Select } from "@/components/admin/form";
import { Cell, DataTable, PageHeader, Pagination } from "@/components/admin/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requirePermission } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/labels";
import { serviceContext } from "@/lib/server-action";
import { auditFilterOptions, listAuditLog } from "@/lib/services/audit-log";
import { listBranches } from "@/lib/services/branches";
import { auditFiltersSchema } from "@/lib/validation/audit";
import { filtersFrom, pageSchema } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Audit log" };

type Search = Partial<
  Record<"actorId" | "entityType" | "entityId" | "action" | "from" | "to" | "page", string>
>;

const when = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Karachi",
  dateStyle: "medium",
  timeStyle: "medium",
});

/** Admin pages of the entity types that have one. */
const ENTITY_PATHS: Record<string, string> = {
  Application: "/admin/applications",
  Branch: "/admin/branches",
  Collection: "/admin/collections",
  ContentEntry: "/admin/content",
  Event: "/admin/events",
  Member: "/admin/members",
  Team: "/admin/teams",
  User: "/admin/users",
  WeeklyReport: "/admin/reports",
};

function Json({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="grid gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <pre className="bg-muted/50 max-w-md overflow-x-auto rounded p-2 text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

/** Section 7.2: Super Admin, filter by actor, entity, action and date. Read-only. */
export default async function AuditLogPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requirePermission("audit.read");
  const search = await searchParams;
  const params = new URLSearchParams(
    Object.entries(search).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
  const filters = filtersFrom(auditFiltersSchema, params);
  const page = pageSchema.parse(search.page);
  const ctx = await serviceContext(user);
  const [entries, options, branches] = await Promise.all([
    listAuditLog(ctx, { ...filters, page }),
    auditFilterOptions(ctx),
    listBranches(ctx),
  ]);
  const branchCode = new Map(branches.map((branch) => [branch.id, branch.code]));

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every change and export, newest first. Entries cannot be edited or deleted."
      />
      <form className="flex flex-wrap items-end gap-3" role="search">
        <Select
          name="actorId"
          defaultValue={filters.actorId ?? ""}
          aria-label="Actor"
          className="w-56"
        >
          <option value="">Anyone</option>
          {options.users.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name} · {ROLE_LABELS[option.role]}
            </option>
          ))}
        </Select>
        <Select
          name="entityType"
          defaultValue={filters.entityType ?? ""}
          aria-label="Entity type"
          className="w-44"
        >
          <option value="">Any entity</option>
          {options.entityTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </Select>
        <Input
          name="entityId"
          defaultValue={filters.entityId ?? ""}
          placeholder="Entity ID"
          aria-label="Entity ID"
          className="w-72"
        />
        <Input
          name="action"
          defaultValue={filters.action ?? ""}
          placeholder="Action, e.g. export"
          aria-label="Action"
          className="w-44"
        />
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
        head={["When (PKT)", "Actor", "Action", "Entity", "Branch", "Details"]}
        empty={entries.items.length === 0}
      >
        {entries.items.map((entry) => {
          const path = ENTITY_PATHS[entry.entityType];
          return (
            <tr key={entry.id}>
              <Cell className="whitespace-nowrap">{when.format(entry.createdAt)}</Cell>
              <Cell>
                {entry.actor ? (
                  <>
                    {entry.actor.name}
                    <span className="text-muted-foreground block text-xs">
                      {entry.actorRole ? ROLE_LABELS[entry.actorRole] : ""}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Public visitor</span>
                )}
              </Cell>
              <Cell className="font-mono text-xs">{entry.action}</Cell>
              <Cell>
                {entry.entityType}
                {entry.entityId ? (
                  <span className="block font-mono text-xs">
                    {path ? (
                      <Link
                        href={`${path}/${entry.entityId}`}
                        prefetch={false}
                        className="text-primary underline"
                      >
                        {entry.entityId}
                      </Link>
                    ) : (
                      entry.entityId
                    )}
                  </span>
                ) : null}
              </Cell>
              <Cell className="whitespace-nowrap">
                {entry.branchId ? (branchCode.get(entry.branchId) ?? "—") : "—"}
              </Cell>
              <Cell>
                {entry.before !== null || entry.after !== null || entry.ipAddress ? (
                  <details>
                    <summary className="cursor-pointer text-sm">Show</summary>
                    <div className="mt-2 grid gap-2">
                      <Json label="Before" value={entry.before} />
                      <Json label="After" value={entry.after} />
                      <p className="text-muted-foreground text-xs">
                        IP {entry.ipAddress ?? "unknown"}
                        {entry.userAgent ? ` · ${entry.userAgent}` : ""}
                      </p>
                    </div>
                  </details>
                ) : null}
              </Cell>
            </tr>
          );
        })}
      </DataTable>
      <Pagination
        page={entries.page}
        pageCount={entries.pageCount}
        total={entries.total}
        basePath="/admin/audit"
        params={{ ...search, page: undefined }}
      />
    </>
  );
}
