import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type BarSeries = {
  color: string;
  label: string;
  value: number;
};

export type BarGroup = {
  label: string;
  series: BarSeries[];
};

type SimpleBarChartProps = {
  groups: BarGroup[];
  maxValue: number;
  tickStep?: number;
  unit: string;
  xLabelAngle?: number;
};

type BarRow = {
  label: string;
  [key: string]: number | string;
};

const buildRows = (groups: BarGroup[]): BarRow[] =>
  groups.map((group) => {
    const row: BarRow = { label: group.label };
    group.series.forEach((series) => {
      row[series.label] = series.value;
    });
    return row;
  });

const getSeriesOrder = (groups: BarGroup[]) => {
  const labels = new Set<string>();
  groups.forEach((group) => {
    group.series.forEach((series) => labels.add(series.label));
  });
  return Array.from(labels);
};

const getSeriesColors = (groups: BarGroup[]) => {
  const palette = new Map<string, string>();
  groups.forEach((group) => {
    group.series.forEach((series) => {
      if (!palette.has(series.label)) {
        palette.set(series.label, series.color);
      }
    });
  });
  return palette;
};

type LegendItem = {
  color?: string;
  value?: string | number;
};

const renderLegend = ({ payload }: { payload?: readonly LegendItem[] }) => (
  <div className="chart-legend">
    {(payload ?? []).map((entry) => (
      <span key={String(entry.value ?? "")} className="legend-item">
        <span
          className="legend-swatch"
          style={{ backgroundColor: entry.color ?? "rgb(59, 169, 206)" }}
          aria-hidden="true"
        />
        {String(entry.value ?? "")}
      </span>
    ))}
  </div>
);

export function SimpleBarChart({
  groups,
  maxValue,
  tickStep,
  unit,
  xLabelAngle = 0,
}: SimpleBarChartProps) {
  const rows = buildRows(groups);
  const seriesLabels = getSeriesOrder(groups);
  const colors = getSeriesColors(groups);

  return (
    <div className="simple-chart">
      <div className="simple-chart-recharts-shell">
        <ResponsiveContainer height={310} width="100%">
          <BarChart data={rows} margin={{ bottom: xLabelAngle === 0 ? 14 : 44, left: 6, right: 8, top: 10 }} barGap={4}>
            <CartesianGrid stroke="hsl(210 18% 89%)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              angle={xLabelAngle}
              dataKey="label"
              tick={{ fill: "hsl(215 14% 50%)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "hsl(210 18% 84%)" }}
              textAnchor={xLabelAngle === 0 ? "middle" : "end"}
            />
            <YAxis
              axisLine={{ stroke: "hsl(210 18% 84%)" }}
              domain={[0, maxValue]}
              tick={{ fill: "hsl(215 14% 50%)", fontSize: 11 }}
              tickLine={false}
              width={40}
              ticks={
                tickStep && tickStep > 0
                  ? Array.from({ length: Math.floor(maxValue / tickStep) + 1 }, (_, index) => index * tickStep)
                  : undefined
              }
              label={{
                value: unit,
                angle: -90,
                position: "insideLeft",
                dx: -6,
                style: { fill: "hsl(215 14% 50%)", fontSize: 11 },
              }}
            />
            <Tooltip
              animationDuration={150}
              contentStyle={{
                background: "hsl(0 0% 100%)",
                border: "1px solid hsl(210 18% 84%)",
                borderRadius: "8px",
                boxShadow: "0 8px 16px rgba(16, 44, 92, 0.14)",
                fontSize: "12px",
              }}
              cursor={{ fill: "rgba(30, 79, 154, 0.06)" }}
              formatter={(value, name) => [`${Number(value ?? 0).toFixed(2)} ${unit}`, String(name)]}
              labelStyle={{ color: "hsl(215 14% 40%)", fontWeight: 600 }}
            />
            <Legend content={renderLegend} verticalAlign="top" />
            {seriesLabels.map((label, index) => (
              <Bar
                key={label}
                animationBegin={index * 80}
                animationDuration={640}
                dataKey={label}
                fill={colors.get(label) ?? "rgb(59, 169, 206)"}
                isAnimationActive
                maxBarSize={30}
                name={label}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
