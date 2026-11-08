import type { MeteoDerivedData, MeteoDerivedMetric } from "./types";
import { dateInChile } from "../../utils/date";

export const meteoMetrics = [
  { key: "air_temperature", label: "Temperatura del aire", unit: "°C", decimals: 2, main: "current", stats: ["max", "min", "mean"] },
  { key: "relative_humidity", label: "Humedad relativa", unit: "%", decimals: 0, main: "current", stats: ["mean", "max", "min"] },
  { key: "atmospheric_pressure", label: "Presión atmosférica", unit: "kPa", decimals: 2, main: "current", stats: ["mean"] },
  { key: "vpd", label: "Déficit de presión de vapor (DPV)", unit: "kPa", decimals: 2, main: "current", stats: ["mean"] },
  { key: "precipitation", label: "Precipitación", unit: "mm", decimals: 2, main: "total", stats: [] },
  { key: "solar_radiation", label: "Radiación solar", unit: "MJ/m²", decimals: 1, main: "total", stats: ["max"] },
  { key: "wind", label: "Viento", unit: "m/s", decimals: 2, main: "mean", stats: ["gust", "direction"] },
] as const;

export const formatMeteoValue = (value: number | null | undefined, decimals = 2, unit = "") =>
  typeof value !== "number" || !Number.isFinite(value) ? "Sin datos" :
    `${new Intl.NumberFormat("es-CL", { maximumFractionDigits: decimals }).format(value)}${unit ? ` ${unit}` : ""}`;

const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
export const formatWindDirection = (degrees: number | null | undefined, hasWindData: boolean) => {
  if (typeof degrees !== "number" || !Number.isFinite(degrees)) return hasWindData ? "Variable" : "Sin datos";
  const direction = ((degrees % 360) + 360) % 360;
  return `${Math.round(direction) % 360}° (${directions[Math.round(direction / 22.5) % 16]})`;
};

// A cached snapshot may span midnight. Its current readings are still useful, but
// yesterday's sums must never be presented as today's observations.
export const currentDayMetric = (data: MeteoDerivedData | null | undefined, key: string, now: Date): MeteoDerivedMetric => {
  const metric = data?.metrics[key] ?? {};
  return data?.date === dateInChile(now) ? metric : {
    current: metric.current, recorded_at: metric.recorded_at, unit: metric.unit,
  };
};
