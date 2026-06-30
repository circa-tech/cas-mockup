import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

export type OverviewMiniSeries = {
  color: string;
  label: string;
  values: number[];
};

type OverviewMiniLineProps = {
  labels?: string[];
  lines: OverviewMiniSeries[];
  unit: string;
};

const toOverviewMiniDateLabel = (value: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [, month, day] = value.split("-");
    return `${day}/${month}`;
  }

  return value.length > 8 ? value.slice(0, 8) : value;
};

const buildOverviewMiniRows = (
  labels: string[] | undefined,
  lines: OverviewMiniSeries[],
) => {
  const pointsLength = Math.max(0, ...lines.map((line) => line.values.length));
  return Array.from({ length: pointsLength }, (_, index) => {
    const row: Record<string, number | string> = {
      label: labels?.[index] ?? `P${index + 1}`,
    };
    lines.forEach((line) => {
      row[line.label] = line.values[index] ?? 0;
    });
    return row;
  });
};

export function OverviewMiniLine({ labels, lines, unit }: OverviewMiniLineProps) {
  const rows = useMemo(() => buildOverviewMiniRows(labels, lines), [labels, lines]);

  return (
    <div className="overview-mini-chart">
      <ResponsiveContainer height={196} width="100%">
        <LineChart data={rows} margin={{ bottom: 10, left: 8, right: 8, top: 6 }}>
          <CartesianGrid stroke="hsl(210 18% 91%)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            angle={-28}
            axisLine={{ stroke: "hsl(210 18% 86%)" }}
            dataKey="label"
            height={42}
            interval="preserveStartEnd"
            minTickGap={10}
            tick={{ fill: "hsl(215 14% 50%)", fontSize: 10 }}
            tickFormatter={(value: string) => toOverviewMiniDateLabel(value)}
            tickLine={false}
            tickMargin={4}
            textAnchor="end"
          />
          <YAxis
            axisLine={{ stroke: "hsl(210 18% 86%)" }}
            tick={{ fill: "hsl(215 14% 50%)", fontSize: 10 }}
            tickLine={false}
            width={42}
          />
          <RechartsTooltip
            animationDuration={120}
            contentStyle={{
              background: "hsl(0 0% 100%)",
              border: "1px solid hsl(210 18% 87%)",
              borderRadius: "8px",
              boxShadow: "0 8px 16px rgba(16, 44, 92, 0.12)",
              fontSize: "11px",
            }}
            cursor={{ stroke: "hsl(215 38% 70%)", strokeDasharray: "3 3" }}
            formatter={(value, name) => [
              `${Number(value ?? 0).toFixed(2)} ${unit}`,
              String(name),
            ]}
            labelFormatter={(label) => String(toOverviewMiniDateLabel(String(label)))}
          />
          {lines.map((line, index) => (
            <Line
              key={line.label}
              activeDot={{ r: 4 }}
              animationBegin={index * 90}
              animationDuration={620}
              dataKey={line.label}
              dot={{ r: 2 }}
              isAnimationActive
              stroke={line.color}
              strokeWidth={2.1}
              type="monotone"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
