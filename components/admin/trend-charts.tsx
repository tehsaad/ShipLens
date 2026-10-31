"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { month: string; value: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function label(month: string): string {
  const [year, index] = month.split("-");
  return `${MONTHS[Number(index) - 1]} ${year!.slice(2)}`;
}

const pkr = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });
const axis = { fontSize: 12, fill: "var(--muted-foreground)" };
const tooltip = {
  contentStyle: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "0.6rem",
    fontSize: 12,
    boxShadow: "0 12px 28px -18px rgba(0,0,0,0.35)",
  },
  labelStyle: { color: "var(--muted-foreground)" },
  itemStyle: { color: "var(--foreground)" },
} as const;

/** Draw-in animation, unless the visitor asked for reduced motion. */
function useAnimate(): boolean {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    // One-time read: prefers-reduced-motion is not knowable during server rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnimate(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  return animate;
}

/** Section 7.2: 12-month area chart of collection totals per month (PKR, net). */
export function CollectionTrend({ data }: { data: Point[] }) {
  const animate = useAnimate();
  const rows = data.map((point) => ({ month: label(point.month), total: Number(point.value) }));
  return (
    <div
      className="h-64"
      role="img"
      aria-label="Collection totals per month for the last 12 months"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="collectionFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="month" tick={axis} tickLine={false} axisLine={false} />
          <YAxis
            tick={axis}
            tickFormatter={(value: number) => pkr.format(value)}
            width={72}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            {...tooltip}
            formatter={(value) => [`PKR ${pkr.format(Number(value))}`, "Collections"]}
          />
          <Area
            isAnimationActive={animate}
            animationDuration={900}
            type="monotone"
            dataKey="total"
            stroke="var(--chart-1)"
            strokeWidth={2.5}
            fill="url(#collectionFill)"
            dot={{ r: 2.5, fill: "var(--chart-1)" }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Section 7.2: 12-month bar chart of new members per month. */
export function NewMemberTrend({ data }: { data: Point[] }) {
  const animate = useAnimate();
  const rows = data.map((point) => ({ month: label(point.month), members: Number(point.value) }));
  return (
    <div className="h-64" role="img" aria-label="New members per month for the last 12 months">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="memberFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.95} />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.55} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="month" tick={axis} tickLine={false} axisLine={false} />
          <YAxis tick={axis} allowDecimals={false} width={32} tickLine={false} axisLine={false} />
          <Tooltip
            {...tooltip}
            cursor={{ fill: "var(--muted)" }}
            formatter={(value) => [String(value), "New members"]}
          />
          <Bar
            isAnimationActive={animate}
            animationDuration={800}
            dataKey="members"
            fill="url(#memberFill)"
            radius={[6, 6, 0, 0]}
            maxBarSize={36}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
