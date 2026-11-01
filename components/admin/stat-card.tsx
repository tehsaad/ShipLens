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

/**
 * A dashboard KPI: label, an icon chip, a counting-up figure and an optional detail line.
 * The `gradient` variant is a highlight card (deep-teal gradient, white text).
 */
export function StatCard({
  label,
  value,
  kind = "int",
  detail,
  icon: Icon,
  tone = "teal",
  variant = "surface",
}: {
  label: string;
  value: number;
  kind?: "int" | "pkr";
  detail?: string;
  icon: LucideIcon;
  tone?: StatTone;
  variant?: "surface" | "gradient";
}) {
  const gradient = variant === "gradient";
  return (
    <div
      className={cn(
        "surface-hover grid content-start gap-3 p-5",
        gradient ? "kpi-gradient" : "surface",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "text-sm font-medium",
            gradient ? "text-white/85" : "text-muted-foreground",
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
            gradient ? "bg-white/15 text-white" : TONES[tone],
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className={cn("kpi-figure text-3xl", gradient && "text-white")}>
        <CountUp value={value} kind={kind} />
      </p>
      {detail ? (
        <p
          className={cn(
            "text-xs text-pretty",
            gradient ? "text-white/80" : "text-muted-foreground",
          )}
        >
          {detail}
        </p>
      ) : null}
    </div>
  );
}
