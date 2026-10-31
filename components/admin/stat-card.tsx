import type { LucideIcon } from "lucide-react";
import { cn } from "cn";
import { CountUp } from "./animate";

export type StatTone = "teal" | "marigold" | "emerald" | "amber";

const TONES: Record<StatTone, string> = {
  teal: "bg-primary/10 text-primary",
  marigold: "bg-marigold/15 text-marigold-ink",
  emerald: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
};

/** A dashboard KPI: label, an icon chip, a counting-up figure and an optional detail line. */
export function StatCard({
  label,
  value,
  kind = "int",
  detail,
  icon: Icon,
  tone = "teal",
}: {
  label: string;
  value: number;
  kind?: "int" | "pkr";
  detail?: string;
  icon: LucideIcon;
  tone?: StatTone;
}) {
  return (
    <div className="surface surface-hover grid content-start gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-muted-foreground text-sm font-medium">{label}</span>
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", TONES[tone])}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="kpi-figure text-3xl">
        <CountUp value={value} kind={kind} />
      </p>
      {detail ? <p className="text-muted-foreground text-xs text-pretty">{detail}</p> : null}
    </div>
  );
}
