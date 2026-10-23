"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
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

/** Section 7.2: 12-month line chart of collection totals per month (PKR, net). */
export function CollectionTrend({ data }: { data: Point[] }) {
  const rows = data.map((point) => ({ month: label(point.month), total: Number(point.value) }));
  return (
    <div
      className="h-64"
      role="img"
      aria-label="Collection totals per month for the last 12 months"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="month" tick={axis} />
          <YAxis tick={axis} tickFormatter={(value: number) => pkr.format(value)} width={72} />
          <Tooltip formatter={(value) => [`PKR ${pkr.format(Number(value))}`, "Collections"]} />
          <Line
            isAnimationActive={false}
            type="monotone"
            dataKey="total"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Section 7.2: 12-month bar chart of new members per month. */
export function NewMemberTrend({ data }: { data: Point[] }) {
  const rows = data.map((point) => ({ month: label(point.month), members: Number(point.value) }));
  return (
    <div className="h-64" role="img" aria-label="New members per month for the last 12 months">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="month" tick={axis} />
          <YAxis tick={axis} allowDecimals={false} width={32} />
          <Tooltip formatter={(value) => [String(value), "New members"]} />
          <Bar
            isAnimationActive={false}
            dataKey="members"
            fill="var(--primary)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
