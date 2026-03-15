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

export function SimpleBarChart({
  groups,
  maxValue,
  tickStep,
  unit,
  xLabelAngle = 0,
}: SimpleBarChartProps) {
  const width = 760;
  const height = 320;
  const paddingLeft = 52;
  const paddingRight = 20;
  const paddingTop = 24;
  const paddingBottom = xLabelAngle === 0 ? 62 : 84;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const groupWidth = chartWidth / groups.length;
  const innerGap = 10;
  const barWidth = Math.min(28, (groupWidth - innerGap * 3) / 2);
  const step = tickStep ?? Math.max(1, Math.round(maxValue / 5));
  const ticks = Array.from(
    { length: Math.floor(maxValue / step) + 1 },
    (_, index) => index * step,
  );

  return (
    <div className="simple-chart">
      <svg viewBox={`0 0 ${width} ${height}`} className="simple-chart-svg" role="img">
        {ticks.map((tick) => {
          const y = paddingTop + chartHeight - (tick / maxValue) * chartHeight;

          return (
            <g key={tick}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                className="chart-grid-line"
              />
              <text x={paddingLeft - 12} y={y + 4} className="chart-axis-label chart-axis-label--left">
                {tick}
              </text>
            </g>
          );
        })}

        {groups.map((group, groupIndex) => {
          const originX = paddingLeft + groupIndex * groupWidth;

          return (
            <g key={group.label}>
              {group.series.map((series, seriesIndex) => {
                const x = originX + innerGap + seriesIndex * (barWidth + innerGap);
                const barHeight = (series.value / maxValue) * chartHeight;
                const y = paddingTop + chartHeight - barHeight;

                return (
                  <rect
                    key={series.label}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx="1"
                    fill={series.color}
                  />
                );
              })}

              <text
                x={originX + groupWidth / 2}
                y={height - 16}
                className="chart-axis-label"
                textAnchor="middle"
                transform={
                  xLabelAngle !== 0
                    ? `rotate(${xLabelAngle} ${originX + groupWidth / 2} ${height - 16})`
                    : undefined
                }
              >
                {group.label}
              </text>
            </g>
          );
        })}

        <text
          x={16}
          y={paddingTop + chartHeight / 2}
          className="chart-axis-label chart-axis-label--left"
          transform={`rotate(-90 16 ${paddingTop + chartHeight / 2})`}
        >
          {unit}
        </text>
      </svg>
    </div>
  );
}
