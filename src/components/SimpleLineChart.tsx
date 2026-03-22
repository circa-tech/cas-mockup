import { useState } from "react";

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

const makeLinePath = (
  points: { x: number; y: number }[],
  mode: "linear" | "step",
) => {
  if (points.length === 0) {
    return "";
  }

  if (mode === "linear") {
    return points
      .map((point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
      )
      .join(" ");
  }

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    path += ` H ${current.x.toFixed(2)} V ${current.y.toFixed(2)}`;
    if (index === points.length - 1) {
      path += ` L ${current.x.toFixed(2)} ${current.y.toFixed(2)}`;
    }
    path += previous.x === current.x ? "" : "";
  }

  return path;
};

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
  const [hoverPoint, setHoverPoint] = useState<{
    color: string;
    label: string;
    seriesLabel: string;
    value: number;
    x: number;
    y: number;
  } | null>(null);
  const width = 900;
  const height = 360;
  const paddingLeft = 64;
  const paddingRight = 18;
  const paddingTop = 24;
  const paddingBottom = xLabelAngle === 0 ? 54 : 108;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const pointCount = series[0]?.points.length ?? 0;
  const stepX = pointCount > 1 ? chartWidth / (pointCount - 1) : chartWidth;
  const span = maxValue - minValue || 1;
  const yTicks = 5;

  const chartSeries = series.map((item) => ({
    ...item,
    coordinates: item.points.map((point, index) => ({
      x: paddingLeft + index * stepX,
      y:
        paddingTop +
        chartHeight -
        ((point.value - minValue) / span) * chartHeight,
    })),
  }));
  const hoverValueText = hoverPoint
    ? `${hoverPoint.seriesLabel}: ${hoverPoint.value.toFixed(2)} ${unit}`
    : "";
  const tooltipWidth = hoverPoint
    ? Math.max(132, hoverPoint.label.length * 6.5, hoverValueText.length * 6.5) + 18
    : 0;
  const tooltipHeight = 44;
  const rawTooltipX = hoverPoint ? hoverPoint.x + 12 : 0;
  const tooltipX = hoverPoint
    ? Math.max(
        paddingLeft,
        Math.min(rawTooltipX, width - paddingRight - tooltipWidth),
      )
    : 0;
  const rawTooltipY = hoverPoint ? hoverPoint.y - tooltipHeight - 10 : 0;
  const tooltipY = hoverPoint
    ? rawTooltipY < paddingTop
      ? hoverPoint.y + 10
      : rawTooltipY
    : 0;

  return (
    <div className="simple-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="simple-chart-svg"
        role="img"
        onMouseLeave={() => setHoverPoint(null)}
      >
        <line
          x1={paddingLeft}
          y1={paddingTop}
          x2={paddingLeft}
          y2={paddingTop + chartHeight}
          className="chart-axis-line"
        />
        <line
          x1={paddingLeft}
          y1={paddingTop + chartHeight}
          x2={width - paddingRight}
          y2={paddingTop + chartHeight}
          className="chart-axis-line"
        />

        {Array.from({ length: yTicks + 1 }).map((_, tickIndex) => {
          const tickValue = minValue + (span / yTicks) * tickIndex;
          const y = paddingTop + chartHeight - (chartHeight / yTicks) * tickIndex;

          return (
            <g key={tickIndex}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                className="chart-grid-line"
              />
              <text x={paddingLeft - 12} y={y + 4} className="chart-axis-label chart-axis-label--left">
                {tickValue.toFixed(1)}
              </text>
            </g>
          );
        })}

        {chartSeries.map((item) => (
          <path
            key={item.label}
            d={makeLinePath(item.coordinates, mode)}
            fill="none"
            stroke={item.color}
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {chartSeries.map((item) =>
          item.coordinates.map((point, index) => (
            <circle
              key={`${item.label}-${item.points[index].label}`}
              cx={point.x}
              cy={point.y}
              r="3"
              fill={item.color}
            >
              <title>{`${item.points[index].label} · ${item.label}: ${item.points[index].value.toFixed(2)} ${unit}`}</title>
            </circle>
          )),
        )}
        {chartSeries.map((item) =>
          item.coordinates.map((point, index) => (
            <circle
              key={`hover-${item.label}-${item.points[index].label}`}
              cx={point.x}
              cy={point.y}
              r="10"
              className="chart-hover-target"
              onMouseEnter={() =>
                setHoverPoint({
                  color: item.color,
                  label: item.points[index].label,
                  seriesLabel: item.label,
                  value: item.points[index].value,
                  x: point.x,
                  y: point.y,
                })
              }
            />
          )),
        )}
        {hoverPoint && (
          <>
            <line
              x1={hoverPoint.x}
              y1={paddingTop}
              x2={hoverPoint.x}
              y2={paddingTop + chartHeight}
              className="chart-hover-line"
            />
            <g transform={`translate(${tooltipX}, ${tooltipY})`}>
              <rect width={tooltipWidth} height={tooltipHeight} rx="6" className="chart-tooltip-box" />
              <text x={9} y={16} className="chart-tooltip-label">
                {hoverPoint.label}
              </text>
              <text x={9} y={33} className="chart-tooltip-value" fill={hoverPoint.color}>
                {hoverValueText}
              </text>
            </g>
          </>
        )}

        {series[0]?.points.map((point, index) =>
          index % labelEvery === 0 || index === series[0].points.length - 1 ? (
            <text
              key={point.label}
              x={paddingLeft + index * stepX}
              y={height - 16}
              className="chart-axis-label"
              textAnchor="middle"
              transform={
                xLabelAngle !== 0
                  ? `rotate(${xLabelAngle} ${paddingLeft + index * stepX} ${height - 16})`
                  : undefined
              }
            >
              {point.label}
            </text>
          ) : null,
        )}

        <text
          x={20}
          y={paddingTop + chartHeight / 2}
          className="chart-axis-label chart-axis-label--left"
          transform={`rotate(-90 20 ${paddingTop + chartHeight / 2})`}
        >
          {unit}
        </text>

        <text x={paddingLeft + chartWidth / 2} y={height - 12} className="chart-axis-label chart-axis-label--bottom">
          {xAxisLabel}
        </text>
      </svg>

      <div className="chart-legend">
        {series.map((item) => (
          <span key={item.label} className="legend-item">
            <span
              className="legend-swatch"
              style={{ backgroundColor: item.color }}
              aria-hidden="true"
            />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
