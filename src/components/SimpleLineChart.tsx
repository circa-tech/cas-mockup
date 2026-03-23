import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type LinePoint = {
  label: string;
  value: number;
};

export type LineSeries = {
  color: string;
  label: string;
  points: LinePoint[];
};

type SimpleLineChartProps = {
  xAxisLabel?: string;
  labelEvery?: number;
  maxValue: number;
  minValue: number;
  mode?: "linear" | "step";
  series: LineSeries[];
  unit: string;
  xLabelAngle?: number;
};

type ChartRow = {
  label: string;
  [key: string]: number | string;
};

const buildRows = (series: LineSeries[]): ChartRow[] => {
  if (series.length === 0 || series[0].points.length === 0) {
    return [];
  }

  return series[0].points.map((point, index) => {
    const row: ChartRow = { label: point.label };

    series.forEach((item) => {
      row[item.label] = item.points[index]?.value ?? 0;
    });

    return row;
  });
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

export function SimpleLineChart({
  xAxisLabel = "Fecha",
  labelEvery = 1,
  maxValue,
  minValue,
  mode = "linear",
  series,
  unit,
  xLabelAngle = 0,
}: SimpleLineChartProps) {
  const rows = buildRows(series);
  const rowCount = rows.length;
  const hasRotatedLabels = xLabelAngle !== 0;
  const showXAxisTitle = !hasRotatedLabels && xAxisLabel.trim().length > 0;

  return (
    <div className="simple-chart">
      <div className="simple-chart-recharts-shell">
        <ResponsiveContainer height={338} width="100%">
          <LineChart data={rows} margin={{ bottom: hasRotatedLabels ? 18 : 22, left: 8, right: 8, top: 12 }}>
            <CartesianGrid stroke="hsl(210 18% 89%)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              angle={xLabelAngle}
              dataKey="label"
              height={hasRotatedLabels ? 56 : 42}
              interval={0}
              minTickGap={8}
              tick={{ fill: "hsl(215 14% 50%)", fontSize: 11 }}
              tickFormatter={(value: string, index: number) =>
                index % labelEvery === 0 || index === rowCount - 1 ? value : ""
              }
              tickLine={false}
              axisLine={{ stroke: "hsl(210 18% 84%)" }}
              textAnchor={hasRotatedLabels ? "end" : "middle"}
              label={
                showXAxisTitle
                  ? {
                      value: xAxisLabel,
                      position: "insideBottom",
                      dy: 10,
                      style: { fill: "hsl(215 14% 50%)", fontSize: 11 },
                    }
                  : undefined
              }
            />
            <YAxis
              axisLine={{ stroke: "hsl(210 18% 84%)" }}
              domain={[minValue, maxValue]}
              tick={{ fill: "hsl(215 14% 50%)", fontSize: 11 }}
              tickFormatter={(value: number) => value.toFixed(1)}
              tickLine={false}
              width={46}
              label={{
                value: unit,
                angle: -90,
                position: "insideLeft",
                dx: -5,
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
              cursor={{ stroke: "hsl(215 38% 68%)", strokeDasharray: "3 3" }}
              formatter={(value, name) => [`${Number(value ?? 0).toFixed(2)} ${unit}`, String(name)]}
              labelStyle={{ color: "hsl(215 14% 40%)", fontWeight: 600 }}
            />
            <Legend content={renderLegend} verticalAlign="top" />
            {series.map((item, index) => (
              <Line
                key={item.label}
                activeDot={{ r: 4 }}
                animationBegin={index * 120}
                animationDuration={780}
                dataKey={item.label}
                dot={{ r: 2 }}
                isAnimationActive
                name={item.label}
                stroke={item.color}
                strokeWidth={2.2}
                type={mode === "step" ? "stepAfter" : "monotone"}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
