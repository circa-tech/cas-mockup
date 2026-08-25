import type { LineSeries } from "../components/SimpleLineChart";
import { chartPalette } from "../data/mockupData";
import { throwApiError } from "./apiError";

export type ModisSnowBasinId = "ae" | "jorquera" | "pulido" | "manflas";

export type ModisSnowCoveragePoint = {
  anopar: number | null;
  esteano: number | null;
  fecha: string;
};

export type ModisSnowCoverageSeries = Record<ModisSnowBasinId, ModisSnowCoveragePoint[]>;

export type ModisSnowImageBounds = {
  east: number;
  north: number;
  south: number;
  west: number;
};

export type ModisSnowLatestImage = {
  bounds: ModisSnowImageBounds | null;
  crs: string | null;
  imageDate: string | null;
  objectUrl: string;
};

export type ModisSnowBasinsGeoJson = {
  type: "FeatureCollection";
  features: any[];
  crs?: unknown;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
const SNOW_CURRENT_COLOR = chartPalette.chart1;
const SNOW_PREVIOUS_COLOR = chartPalette.chart3;

const parseImageBounds = (rawBounds: string | null): ModisSnowImageBounds | null => {
  if (!rawBounds) {
    return null;
  }

  try {
    const bounds: unknown = JSON.parse(rawBounds);
    if (
      typeof bounds !== "object" ||
      bounds === null ||
      Array.isArray(bounds) ||
      !["south", "west", "north", "east"].every(
        (key) => typeof (bounds as Record<string, unknown>)[key] === "number",
      )
    ) {
      return null;
    }

    return bounds as ModisSnowImageBounds;
  } catch {
    return null;
  }
};

const requestModisSnow = async (
  path: string,
  idToken: string,
): Promise<Response> => {
  if (!apiBaseUrl) {
    throw new Error("Missing VITE_API_BASE_URL");
  }

  const response = await fetch(`${apiBaseUrl}/api/v1/modis-snow/${path}`, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!response.ok) {
    await throwApiError(response, `MODIS Snow ${path}`);
  }

  return response;
};

export const fetchModisSnowCoverageSeries = async (
  idToken: string,
): Promise<ModisSnowCoverageSeries> => {
  const response = await requestModisSnow("coverage-series", idToken);
  return response.json() as Promise<ModisSnowCoverageSeries>;
};

export const fetchModisSnowLatestImage = async (
  idToken: string,
): Promise<ModisSnowLatestImage> => {
  const response = await requestModisSnow("latest-image", idToken);
  const blob = await response.blob();
  const imageDate = response.headers.get("X-Image-Date");
  return {
    bounds: parseImageBounds(response.headers.get("X-Image-Bounds")),
    crs: response.headers.get("X-Image-CRS"),
    imageDate,
    objectUrl: URL.createObjectURL(blob),
  };
};

export const fetchModisSnowBasinsGeoJson = async (
  idToken: string,
): Promise<ModisSnowBasinsGeoJson> => {
  const response = await requestModisSnow("basins-geojson", idToken);
  return response.json() as Promise<ModisSnowBasinsGeoJson>;
};

export const toModisSnowLineSeries = (
  points: ModisSnowCoveragePoint[],
): LineSeries[] => [
  {
    label: "Este año",
    color: SNOW_CURRENT_COLOR,
    points: points.map((point) => ({
      label: point.fecha,
      value: point.esteano ?? 0,
    })),
  },
  {
    label: "Año anterior",
    color: SNOW_PREVIOUS_COLOR,
    points: points.map((point) => ({
      label: point.fecha,
      value: point.anopar ?? 0,
    })),
  },
];
