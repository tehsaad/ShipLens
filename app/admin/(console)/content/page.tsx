import type { Metadata } from "next";
import Link from "next/link";
import { Select } from "@/components/admin/form";
import { Badge, Cell, DataTable, PageHeader, Section } from "@/components/admin/page";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/session";
import { formatBusinessDate } from "@/lib/dates";
import { CONTENT_TYPE_LABELS, LOCALE_LABELS } from "@/lib/labels";
import { serviceContext } from "@/lib/server-action";
import { listContent } from "@/lib/services/content";
import { contentFiltersSchema } from "@/lib/validation/content";
import { CreateContentForm } from "./forms";

export const metadata: Metadata = { title: "Content" };

type Search = Partial<Record<"type" | "locale" | "status", string>>;

export default async function ContentPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requirePermission("content.read");
  const search = await searchParams;
  const filters = contentFiltersSchema.parse({
    type: search.type || null,
    locale: search.locale || null,
    status: search.status || null,
  });
  const entries = await listContent(await serviceContext(user), filters);

  return (
    <>
      <PageHeader
        title="Content"
        description="Pages, programs and announcements in English and Urdu. Drafts stay hidden until published."
      />
      <Section title="New entry">
        <CreateContentForm />
      </Section>
      <form className="flex flex-wrap items-end gap-3" role="search">
        <Select name="type" defaultValue={filters.type ?? ""} aria-label="Type" className="w-40">
          <option value="">Any type</option>
          {Object.entries(CONTENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          name="locale"
          defaultValue={filters.locale ?? ""}
          aria-label="Language"
          className="w-36"
        >
          <option value="">Any language</option>
          {Object.entries(LOCALE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
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
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
        </Select>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>
      <DataTable
        head={["Title", "Type", "Slug", "Language", "Status", "Updated"]}
        empty={entries.length === 0}
      >
        {entries.map((entry) => (
          <tr key={entry.id}>
            <Cell>
              <Link
                href={`/admin/content/${entry.id}`}
                className="text-primary underline"
                dir={entry.locale === "ur" ? "rtl" : undefined}
              >
                {entry.draftTitle ?? entry.title}
              </Link>
            </Cell>
            <Cell>{CONTENT_TYPE_LABELS[entry.type]}</Cell>
            <Cell className="font-mono">{entry.slug}</Cell>
            <Cell>{LOCALE_LABELS[entry.locale]}</Cell>
            <Cell>
              {entry.status === "PUBLISHED" ? (
                <Badge tone="good">Published</Badge>
              ) : (
                <Badge>Draft</Badge>
              )}{" "}
              {entry.draftTitle !== null ? <Badge tone="warn">Pending changes</Badge> : null}
            </Cell>
            <Cell>{formatBusinessDate(entry.updatedAt)}</Cell>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
