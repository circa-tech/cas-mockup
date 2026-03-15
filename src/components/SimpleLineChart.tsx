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
  maxValue: number;
  minValue: number;
  mode?: "linear" | "step";
  series: LineSeries[];
  unit: string;
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
  maxValue,
  minValue,
  mode = "linear",
  series,
  unit,
}: SimpleLineChartProps) {
  const width = 900;
  const height = 360;
  const paddingLeft = 64;
  const paddingRight = 18;
  const paddingTop = 24;
  const paddingBottom = 54;
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

  return (
    <div className="simple-chart">
      <svg viewBox={`0 0 ${width} ${height}`} className="simple-chart-svg" role="img">
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
            />
          )),
        )}

        {series[0]?.points.map((point, index) => (
          <text
            key={point.label}
            x={paddingLeft + index * stepX}
            y={height - 16}
            className="chart-axis-label"
            textAnchor="middle"
          >
            {point.label}
          </text>
        ))}

        <text
          x={20}
          y={paddingTop + chartHeight / 2}
          className="chart-axis-label chart-axis-label--left"
          transform={`rotate(-90 20 ${paddingTop + chartHeight / 2})`}
        >
          {unit}
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
