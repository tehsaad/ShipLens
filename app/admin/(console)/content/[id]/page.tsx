import type { Metadata } from "next";
import { Badge, PageHeader, Section } from "@/components/admin/page";
import { Markdown } from "@/components/markdown";
import { requirePermission } from "@/lib/auth/session";
import { formatBusinessDate } from "@/lib/dates";
import { CONTENT_TYPE_LABELS, LOCALE_LABELS } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { loadOrNotFound, routeId, serviceContext } from "@/lib/server-action";
import { getContent } from "@/lib/services/content";
import { EditContentForm, StatusButtons } from "../forms";

export const metadata: Metadata = { title: "Content entry" };

export default async function ContentEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("content.read");
  const entry = await loadOrNotFound(async () =>
    getContent(await serviceContext(user), await routeId(params)),
  );
  const published = entry.status === "PUBLISHED";
  const pending = entry.draftTitle !== null;
  const dir = entry.locale === "ur" ? "rtl" : "ltr";
  const working = { title: entry.draftTitle ?? entry.title, body: entry.draftBody ?? entry.body };

  return (
    <>
      <PageHeader
        title={working.title}
        description={
          <>
            {CONTENT_TYPE_LABELS[entry.type]} · <span className="font-mono">{entry.slug}</span> ·{" "}
            {LOCALE_LABELS[entry.locale]} ·{" "}
            {published ? <Badge tone="good">Published</Badge> : <Badge>Draft</Badge>}{" "}
            {pending ? <Badge tone="warn">Pending changes not yet public</Badge> : null}
            {entry.publishedAt ? ` · last published ${formatBusinessDate(entry.publishedAt)}` : ""}
          </>
        }
      />
      {can(user, "content.publish") ? (
        <Section title="Publishing">
          <StatusButtons id={entry.id} published={published} pending={pending} />
        </Section>
      ) : null}
      <Section title={pending ? "Preview of pending changes" : "Preview"}>
        <article lang={entry.locale} dir={dir} className="grid gap-4 rounded-lg border p-4">
          <h2 className="text-2xl font-semibold">{working.title}</h2>
          <Markdown>{working.body}</Markdown>
        </article>
      </Section>
      {can(user, "content.update") ? (
        <Section title="Edit">
          <EditContentForm
            entry={{ id: entry.id, slug: entry.slug, ...working }}
            slugEditable={entry.publishedAt === null}
            dir={dir}
          />
        </Section>
      ) : null}
    </>
  );
}
