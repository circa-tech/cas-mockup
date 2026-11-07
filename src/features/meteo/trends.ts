import { dateInChile, formatShortDateTimeParts } from "../../utils/date";
import { formatMeteoValue } from "./metrics";
import type { MeteoTrend, MeteoTrendPoint } from "./types";

export const trendTimestamp = (value: string) => Date.parse(value.length === 10 ? `${value}T12:00:00Z` : value);

export const validTrendPoints = (series: MeteoTrend) => {
  if (!Array.isArray(series.points) || series.points.length > 150) return [];
  return series.points.filter((point) => typeof point.timestamp === "string" && Number.isFinite(trendTimestamp(point.timestamp)))
    .map((point) => ({ ...point, value: typeof point.value === "number" && Number.isFinite(point.value) ? point.value : null }))
    .sort((a, b) => trendTimestamp(a.timestamp) - trendTimestamp(b.timestamp));
};

export const trendSegments = (points: MeteoTrendPoint[]) => {
  const result: (MeteoTrendPoint & { value: number })[][] = [];
  let segment: (MeteoTrendPoint & { value: number })[] = [];
  for (const point of points) {
    if (point.value == null) { if (segment.length) result.push(segment); segment = []; }
    else segment.push({ ...point, value: point.value });
  }
  if (segment.length) result.push(segment);
  return result;
};

export const formatTrendTooltip = (point: MeteoTrendPoint, series: MeteoTrend, now: Date, decimals = 2, unit = series.unit) => {
  const parts = formatShortDateTimeParts(point.timestamp.length === 10 ? `${point.timestamp}T12:00:00Z` : point.timestamp);
  const label = series.daily
    ? point.timestamp.slice(0, 10) === dateInChile(now) ? "hoy (hasta ahora)" : parts.date
    : `${parts.date}, ${parts.time}`;
  return `${label} · ${formatMeteoValue(point.value, decimals, unit)}`;
};

export type PlotPoint = MeteoTrendPoint & { value: number; x: number; y: number };

// Monotone cubic interpolation passes through each sample without inventing peaks.
export const smoothTrendPath = (points: PlotPoint[]) => {
  if (!points.length) return "";
  const slopes = points.slice(1).map((point, index) => (point.y - points[index].y) / Math.max(0.001, point.x - points[index].x));
  const tangents = points.map((_, index) => index === 0 ? slopes[0] ?? 0 : index === points.length - 1 ? slopes[index - 1] : (slopes[index - 1] + slopes[index]) / 2);
  for (let i = 0; i < slopes.length; i++) {
    const slope = slopes[i];
    if (!slope) { tangents[i] = 0; tangents[i + 1] = 0; continue; }
    if (tangents[i] / slope < 0) tangents[i] = 0;
    if (tangents[i + 1] / slope < 0) tangents[i + 1] = 0;
    const magnitude = Math.hypot(tangents[i] / slope, tangents[i + 1] / slope);
    if (magnitude > 3) { const scale = 3 / magnitude; tangents[i] *= scale; tangents[i + 1] *= scale; }
  }
  return points.reduce((path, point, index) => {
    if (!index) return `M${point.x},${point.y}`;
    const previous = points[index - 1], dx = (point.x - previous.x) / 3;
    return `${path} C${previous.x + dx},${previous.y + dx * tangents[index - 1]} ${point.x - dx},${point.y - dx * tangents[index]} ${point.x},${point.y}`;
  }, "");
};

const secondaryNames = new Set(["soil temperature", "water content", "saturation extract ec", "electrical conductivity", "ndvi", "reference pressure"]);
export const secondaryHasTrend = (name: string) => secondaryNames.has(name.trim().toLowerCase());
