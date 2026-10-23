import type { Metadata } from "next";
import Link from "next/link";
import { Select } from "@/components/admin/form";
import { Badge, Cell, DataTable, PageHeader, Pagination, Section } from "@/components/admin/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requirePermission } from "@/lib/auth/session";
import { businessToday, formatDateOnly } from "@/lib/dates";
import { PURPOSE_LABELS } from "@/lib/labels";
import { formatPkr } from "@/lib/money";
import { can, scopeFor } from "@/lib/permissions";
import { serviceContext } from "@/lib/server-action";
import { listBranches } from "@/lib/services/branches";
import { listCollections } from "@/lib/services/collections";
import { collectionFiltersSchema } from "@/lib/validation/collections";
import { pageSchema } from "@/lib/validation/common";
import { CreateCollectionForm } from "./forms";

export const metadata: Metadata = { title: "Collections" };

type Search = Partial<Record<"branchId" | "purpose" | "routed" | "from" | "to" | "page", string>>;

export default async function CollectionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requirePermission("collection.read");
  const search = await searchParams;
  const filters = collectionFiltersSchema.parse({
    branchId: search.branchId || null,
    purpose: search.purpose || null,
    routed: search.routed || null,
    from: search.from || null,
    to: search.to || null,
  });
  const page = pageSchema.parse(search.page);
  const ctx = await serviceContext(user);
  const allBranches = scopeFor(user.role, "collection.read") === "all";
  const [collections, branches] = await Promise.all([
    listCollections(ctx, { ...filters, page }),
    allBranches ? listBranches(ctx) : Promise.resolve([]),
  ]);
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Collections"
        description="Entries can be edited for 7 days and until their week's report is approved. Corrections are new entries; nothing is deleted."
      />
      {can(user, "collection.create") ? (
        <Section title="New collection">
          <CreateCollectionForm today={formatDateOnly(businessToday())} />
        </Section>
      ) : null}
      <form className="flex flex-wrap items-end gap-3" role="search">
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
          name="purpose"
          defaultValue={filters.purpose ?? ""}
          aria-label="Purpose"
          className="w-36"
        >
          <option value="">Any purpose</option>
          {Object.entries(PURPOSE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          name="routed"
          defaultValue={filters.routed ?? ""}
          aria-label="Routing"
          className="w-36"
        >
          <option value="">Routed or not</option>
          <option value="no">Unrouted</option>
          <option value="yes">Routed</option>
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
      <p className="text-sm">
        Net total of the matching entries: <strong>{formatPkr(collections.totalAmount)}</strong>
      </p>
      <DataTable
        head={["Date", "Branch", "Amount", "Purpose", "Description", "Routed", "Lock"]}
        empty={collections.items.length === 0}
      >
        {collections.items.map((row) => (
          <tr key={row.id}>
            <Cell>
              <Link href={`/admin/collections/${row.id}`} className="text-primary underline">
                {formatDateOnly(row.collectedOn)}
              </Link>
            </Cell>
            <Cell>{row.branch.code}</Cell>
            <Cell className="text-end tabular-nums">
              {formatPkr(row.amount)}{" "}
              {row.correctsCollectionId ? <Badge tone="warn">Correction</Badge> : null}
            </Cell>
            <Cell>{PURPOSE_LABELS[row.purpose]}</Cell>
            <Cell>{row.description ?? "—"}</Cell>
            <Cell>
              {row.routedAt ? <Badge tone="good">Routed</Badge> : <Badge>Unrouted</Badge>}
            </Cell>
            <Cell>
              {row.lockedAt <= now ? (
                <Badge tone="neutral">Locked</Badge>
              ) : (
                <Badge tone="good">Editable</Badge>
              )}
            </Cell>
          </tr>
        ))}
      </DataTable>
      <Pagination
        page={collections.page}
        pageCount={collections.pageCount}
        total={collections.total}
        basePath="/admin/collections"
        params={{
          branchId: search.branchId,
          purpose: search.purpose,
          routed: search.routed,
          from: search.from,
          to: search.to,
        }}
      />
    </>
  );
}
