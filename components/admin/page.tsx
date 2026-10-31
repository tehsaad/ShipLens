import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="surface grid gap-3 p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function DataTable({
  head,
  children,
  empty,
}: {
  head: string[];
  children: ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="surface overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-start">
          <tr>
            {head.map((label) => (
              <th key={label} scope="col" className="px-3 py-2 text-start font-medium">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {empty ? (
            <tr>
              <td colSpan={head.length} className="text-muted-foreground px-3 py-6 text-center">
                Nothing to show.
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Cell({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2 align-top", className)}>{children}</td>;
}

const BADGE_TONES = {
  neutral: "bg-muted text-foreground",
  good: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
  warn: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  bad: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100",
} as const;

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: keyof typeof BADGE_TONES;
}) {
  return (
    <span
      className={cn("inline-flex rounded-md px-1.5 py-0.5 text-xs font-medium", BADGE_TONES[tone])}
    >
      {children}
    </span>
  );
}

/** Previous / next links that keep the current filters in the query string. */
export function Pagination({
  page,
  pageCount,
  total,
  basePath,
  params,
}: {
  page: number;
  pageCount: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const href = (target: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
    query.set("page", String(target));
    return `${basePath}?${query.toString()}`;
  };
  return (
    <nav aria-label="Pages" className="text-muted-foreground flex items-center gap-4 text-sm">
      <span>
        {total} result{total === 1 ? "" : "s"} · page {page} of {pageCount}
      </span>
      {page > 1 ? (
        <Link className="text-primary underline" href={href(page - 1)}>
          Previous
        </Link>
      ) : null}
      {page < pageCount ? (
        <Link className="text-primary underline" href={href(page + 1)}>
          Next
        </Link>
      ) : null}
    </nav>
  );
}

/**
 * A download link for a file export (section 7.3). A plain anchor, never next/link: a
 * prefetch would run the export and write an audit entry nobody asked for.
 */
export function ExportLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} download className={buttonVariants({ variant: "outline", size: "sm" })}>
      {children}
    </a>
  );
}

/** An export URL carrying the list's current filters (the page number is dropped). */
export function exportHref(path: string, params: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (value && key !== "page") query.set(key, value);
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}
