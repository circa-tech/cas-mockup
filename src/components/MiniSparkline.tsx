type MiniSparklineProps = {
  color?: string;
  points: number[];
};

export function MiniSparkline({
  color = "rgb(23, 112, 130)",
  points,
}: MiniSparklineProps) {
  const width = 140;
  const height = 36;
  const padding = 3;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;

  const path = points
    .map((value, index) => {
      const x = padding + index * stepX;
      const y =
        height - padding - ((value - min) / span) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      className="mini-sparkline"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-hidden="true"
    >
      <path
        className="mini-sparkline-path"
        d={path}
        fill="none"
        pathLength={100}
        strokeDasharray={100}
        strokeDashoffset={100}
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
