import type { Metadata } from "next";
import Image from "next/image";
import { Badge, PageHeader, Section } from "@/components/admin/page";
import { Markdown } from "@/components/markdown";
import { requirePermission } from "@/lib/auth/session";
import { formatBusinessDate } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { loadOrNotFound, routeId, serviceContext } from "@/lib/server-action";
import { getResult } from "@/lib/services/results";
import { EditResultForm, ResultImageForm, ResultStatusButtons } from "../forms";

export const metadata: Metadata = { title: "Result" };

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("result.read");
  const result = await loadOrNotFound(async () =>
    getResult(await serviceContext(user), await routeId(params)),
  );
  const published = result.status === "PUBLISHED";
  const imageUpdatedAt = result.imageUpdatedAt;
  const happenedOn = result.happenedOn ? result.happenedOn.toISOString().slice(0, 10) : "";

  return (
    <>
      <PageHeader
        title={result.titleEn}
        description={
          <>
            {result.branch ? `${result.branch.code} — ${result.branch.name}` : "Network-wide"} ·{" "}
            {published ? <Badge tone="good">Published</Badge> : <Badge>Draft</Badge>}
            {result.publishedAt ? ` · published ${formatBusinessDate(result.publishedAt)}` : ""}
          </>
        }
      />
      {can(user, "result.publish") ? (
        <Section title="Publishing">
          <ResultStatusButtons id={result.id} published={published} />
        </Section>
      ) : null}
      <Section title="Preview">
        <article className="grid gap-4 rounded-lg border p-4">
          {imageUpdatedAt ? (
            <Image
              src={`/api/media/results/${result.id}?v=${imageUpdatedAt.getTime()}`}
              alt={result.imageAltEn ?? result.titleEn}
              width={640}
              height={360}
              unoptimized
              className="h-48 w-full rounded-md object-cover"
            />
          ) : null}
          <h2 className="text-2xl font-semibold">{result.titleEn}</h2>
          <Markdown>{result.bodyEn}</Markdown>
        </article>
      </Section>
      {can(user, "result.update") ? (
        <>
          <Section title="Edit">
            <EditResultForm
              result={{
                id: result.id,
                titleEn: result.titleEn,
                titleUr: result.titleUr,
                bodyEn: result.bodyEn,
                bodyUr: result.bodyUr,
                happenedOn,
              }}
            />
          </Section>
          <Section title="Image">
            <ResultImageForm
              id={result.id}
              altEn={result.imageAltEn}
              altUr={result.imageAltUr}
              hasImage={imageUpdatedAt !== null}
            />
          </Section>
        </>
      ) : null}
    </>
  );
}
