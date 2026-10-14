import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type DotItemDotProps,
} from "recharts";
import { RemoteDataState } from "./RemoteDataState";

export type LinePoint = {
  condition?: "static" | "dynamic" | "unknown";
  label: string;
  timestamp?: number;
  value: number;
};

export type LineSeries = {
  color: string;
  connectNulls?: boolean;
  conditionPointColors?: Partial<Record<"static" | "dynamic" | "unknown", string>>;
  label: string;
  markerShape?: "circle" | "square";
  points: LinePoint[];
  strokeDasharray?: string;
  unit?: string;
  yAxisId?: "primary" | "secondary";
};

type SimpleLineChartProps = {
  xAxisLabel?: string;
  labelEvery?: number;
  maxValue: number;
  minValue: number;
  mode?: "linear" | "step";
  primaryAxisLabel?: string;
  primaryAxisReversed?: boolean;
  series: LineSeries[];
  showDots?: boolean;
  secondaryMaxValue?: number;
  secondaryMinValue?: number;
  unit: string;
  xLabelAngle?: number;
};

type ChartRow = {
  label: string;
  timestamp?: number;
  [key: string]: number | string | undefined;
};

const buildRows = (series: LineSeries[]): ChartRow[] => {
  if (series.length === 0) {
    return [];
  }

  const rowsByKey = new Map<string, ChartRow>();
  const insertionOrder = new Map<string, number>();
  series.forEach((item) => {
    item.points.forEach((point) => {
      const key = point.timestamp === undefined ? `label:${point.label}` : `time:${point.timestamp}`;
      let row = rowsByKey.get(key);
      if (!row) {
        row = { label: point.label, ...(point.timestamp === undefined ? {} : { timestamp: point.timestamp }) };
        rowsByKey.set(key, row);
        insertionOrder.set(key, insertionOrder.size);
      }
      row[item.label] = point.value;
      if (point.condition) row[`${item.label}__condition`] = point.condition;
    });
  });

  return [...rowsByKey.entries()]
    .sort(([leftKey, left], [rightKey, right]) => {
      if (left.timestamp !== undefined && right.timestamp !== undefined) {
        return left.timestamp - right.timestamp;
      }
      return (insertionOrder.get(leftKey) ?? 0) - (insertionOrder.get(rightKey) ?? 0);
    })
    .map(([, row]) => row);
};

export function SimpleLineChart({
  xAxisLabel = "Fecha",
  labelEvery = 1,
  maxValue,
  minValue,
  mode = "linear",
  primaryAxisLabel,
  primaryAxisReversed = false,
  series,
  showDots = true,
  secondaryMaxValue,
  secondaryMinValue,
  unit,
  xLabelAngle = 0,
}: SimpleLineChartProps) {
  const rows = buildRows(series);
  if (!rows.length) {
    return (
      <RemoteDataState
        className="is-chart"
        tone="empty"
        title="No hay mediciones para esta selección"
        message="La última consulta no devolvió datos para el período seleccionado."
      />
    );
  }
  const rowCount = rows.length;
  const hasRotatedLabels = xLabelAngle !== 0;
  const showXAxisTitle = !hasRotatedLabels && xAxisLabel.trim().length > 0;
  const hasSecondaryAxis = series.some((item) => item.yAxisId === "secondary");

  return (
    <div className="simple-chart">
      <div className="simple-chart-recharts-shell">
        <ResponsiveContainer height={338} width="100%">
          <LineChart data={rows} margin={{ bottom: hasRotatedLabels ? 18 : 22, left: 8, right: hasSecondaryAxis ? 18 : 8, top: 12 }}>
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
              yAxisId="primary"
              axisLine={{ stroke: "hsl(210 18% 84%)" }}
              domain={[minValue, maxValue]}
              reversed={primaryAxisReversed}
              tick={{ fill: "hsl(215 14% 50%)", fontSize: 11 }}
              tickFormatter={(value: number) => value.toFixed(1)}
              tickLine={false}
              width={46}
              label={primaryAxisLabel || unit ? {
                value: primaryAxisLabel ?? unit,
                angle: -90,
                position: "insideLeft",
                dx: -5,
                style: { fill: "hsl(215 14% 50%)", fontSize: 11 },
              } : undefined}
            />
            {hasSecondaryAxis && (
              <YAxis
                yAxisId="secondary"
                orientation="right"
                axisLine={{ stroke: "hsl(210 18% 84%)" }}
                domain={[secondaryMinValue ?? minValue, secondaryMaxValue ?? maxValue]}
                tick={{ fill: "hsl(215 14% 50%)", fontSize: 11 }}
                tickFormatter={(value: number) => value.toFixed(1)}
                tickLine={false}
                width={54}
              />
            )}
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
              formatter={(value, name) => {
                const seriesUnit = series.find((item) => item.label === String(name))?.unit ?? unit;
                return [
                  `${Number(value ?? 0).toFixed(2)}${seriesUnit ? ` ${seriesUnit}` : ""}`,
                  String(name),
                ];
              }}
              labelStyle={{ color: "hsl(215 14% 40%)", fontWeight: 600 }}
            />
            <Legend
              align="center"
              height={24}
              iconType="plainline"
              verticalAlign="bottom"
              wrapperStyle={{ bottom: 0, fontSize: 10, transform: "translateY(12px)" }}
            />
            {series.map((item, index) => (
              <Line
                key={item.label}
                yAxisId={item.yAxisId ?? "primary"}
                activeDot={{ r: 4 }}
                animationBegin={index * 120}
                animationDuration={780}
                connectNulls={item.connectNulls ?? false}
                dataKey={item.label}
                dot={!showDots
                  ? false
                  : item.conditionPointColors
                  ? (dotProps: DotItemDotProps) => {
                      if (typeof dotProps.cx !== "number" || typeof dotProps.cy !== "number") {
                        return null;
                      }
                      const conditionKey = typeof dotProps.dataKey === "string"
                        ? `${dotProps.dataKey}__condition`
                        : "";
                      const conditionValue: unknown = conditionKey
                        ? dotProps.payload?.[conditionKey]
                        : undefined;
                      const condition = conditionValue === "static" || conditionValue === "dynamic"
                        ? conditionValue
                        : "unknown";
                      const fill = item.conditionPointColors?.[condition] ?? item.color;
                      return item.markerShape === "square"
                        ? <rect
                            height={7}
                            width={7}
                            x={dotProps.cx - 3.5}
                            y={dotProps.cy - 3.5}
                            fill={fill}
                            stroke={item.color}
                            strokeWidth={1.5}
                          />
                        : <circle
                            cx={dotProps.cx}
                            cy={dotProps.cy}
                            r={3.5}
                            fill={fill}
                            stroke={item.color}
                            strokeWidth={1.5}
                          />;
                    }
                  : { r: 2 }}
                isAnimationActive
                name={item.label}
                stroke={item.color}
                strokeDasharray={item.strokeDasharray}
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
