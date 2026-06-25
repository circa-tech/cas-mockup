import { BarGroup } from "../components/SimpleBarChart";
import { LineSeries } from "../components/SimpleLineChart";
import { chartPalette, EtrDownloadFormat, EtrDownloadVariable } from "../data/mockupData";
import { throwApiError } from "./apiError";

export type GeoJsonFeatureCollection = {
  type: "FeatureCollection";
  features: unknown[];
  crs?: unknown;
};

export type EtrStdAe = {
  fecha: string;
  etr: number | null;
  etmax: number | null;
};

export type EtrSeriePoint = {
  fecha: string;
  etr: number | null;
  etmax: number | null;
};

export type EtrCultPoint = {
  cultivo: string;
  etr: number | null;
  etmax: number | null;
};

export type EtrPolyPoint = EtrSeriePoint;

export type KcPolyPoint = {
  fecha: string;
  kc: number | null;
};

export type LaiPolyPoint = {
  fecha: string;
  lai: number | null;
};

export type EtrDataCuad = {
  anos: number[];
  meses: number[];
  dias: number[];
};

export type EtrDownCuad = {
  url: string | null;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
const ETR_COLOR = chartPalette.chart2;
const ETMAX_COLOR = chartPalette.chart4;

const requestEtr = async <T>(
  path: string,
  idToken: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> => {
  if (!apiBaseUrl) {
    throw new Error("Missing VITE_API_BASE_URL");
  }

  const url = new URL(`${apiBaseUrl}/api/v1/et-lat/${path}`, window.location.origin);
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!response.ok) {
    await throwApiError(response, `ET-LAT ${path}`);
  }

  return response.json() as Promise<T>;
};

export const fetchEtrStdAe = (idToken: string) =>
  requestEtr<EtrStdAe>("std-ae", idToken);

export const fetchEtrSerieEt = (idToken: string, sectorId?: string) =>
  requestEtr<EtrSeriePoint[]>("serie-et", idToken, {
    sector_id: sectorId ? Number(sectorId) : undefined,
  });

export const fetchEtrCult = (idToken: string, sectorId?: string) =>
  requestEtr<EtrCultPoint[]>("et-cult", idToken, {
    sector_id: sectorId ? Number(sectorId) : undefined,
  });

export const fetchEtrSectorMap = (idToken: string) =>
  requestEtr<GeoJsonFeatureCollection>("mapa-sectores", idToken);

export const fetchEtrUsoMap = (idToken: string) =>
  requestEtr<GeoJsonFeatureCollection>("mapa-cult", idToken);

export const fetchEtrQuadrantMap = (idToken: string) =>
  requestEtr<GeoJsonFeatureCollection>("mapa-cuadrantes", idToken);

export const fetchEtrPoly = (idToken: string, usoId: string) =>
  requestEtr<EtrPolyPoint[]>("et-poly", idToken, {
    uso_id: Number(usoId),
  });

export const fetchKcPoly = (idToken: string, usoId: string) =>
  requestEtr<KcPolyPoint[]>("kc-poly", idToken, {
    uso_id: Number(usoId),
  });

export const fetchLaiPoly = (idToken: string, usoId: string) =>
  requestEtr<LaiPolyPoint[]>("lai-poly", idToken, {
    uso_id: Number(usoId),
  });

export const fetchEtrDataCuad = (
  idToken: string,
  {
    quadrantId,
    variable,
    year,
    month,
  }: {
    quadrantId: string;
    variable: EtrDownloadVariable;
    year?: number;
    month?: number;
  },
) =>
  requestEtr<EtrDataCuad>("data-cuad", idToken, {
    cuadrante_id: Number(quadrantId),
    variable,
    ano: year,
    mes: month,
  });

export const fetchEtrDownCuad = (
  idToken: string,
  {
    day,
    month,
    quadrantId,
    variable,
    format,
    year,
  }: {
    day: number;
    format: EtrDownloadFormat;
    month: number;
    quadrantId: string;
    variable: EtrDownloadVariable;
    year: number;
  },
) =>
  requestEtr<EtrDownCuad>("down-cuad", idToken, {
    cuadrante_id: Number(quadrantId),
    variable,
    ano: year,
    mes: month,
    dia: day,
    format,
  });

export const fetchEtrDownCuadImageBlob = async (
  idToken: string,
  {
    day,
    month,
    quadrantId,
    variable,
    format,
    year,
  }: {
    day: number;
    format: EtrDownloadFormat;
    month: number;
    quadrantId: string;
    variable: EtrDownloadVariable;
    year: number;
  },
) => {
  if (!apiBaseUrl) {
    throw new Error("Missing VITE_API_BASE_URL");
  }

  const url = new URL(`${apiBaseUrl}/api/v1/et-lat/down-cuad-image`, window.location.origin);
  url.searchParams.set("cuadrante_id", String(Number(quadrantId)));
  url.searchParams.set("variable", variable);
  url.searchParams.set("ano", String(year));
  url.searchParams.set("mes", String(month));
  url.searchParams.set("dia", String(day));
  url.searchParams.set("format", format);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`ET-LAT down-cuad-image request failed: ${response.status}`);
  }

  return response.blob();
};

export const toEtrBarGroups = (points: EtrCultPoint[]): BarGroup[] =>
  points.map((point) => ({
    label: point.cultivo,
    series: [
      { label: "ETR", value: point.etr ?? 0, color: ETR_COLOR },
      { label: "ETMAX", value: point.etmax ?? 0, color: ETMAX_COLOR },
    ],
  }));

export const toEtrEtmaxSeries = (points: EtrSeriePoint[]): LineSeries[] => [
  {
    label: "ETR media",
    color: ETR_COLOR,
    points: points.map((point) => ({
      label: point.fecha,
      value: point.etr ?? 0,
    })),
  },
  {
    label: "ETMAX media",
    color: ETMAX_COLOR,
    points: points.map((point) => ({
      label: point.fecha,
      value: point.etmax ?? 0,
    })),
  },
];

export const toSingleMetricSeries = (
  points: { fecha: string; value: number | null }[],
  label: string,
  color: string,
): LineSeries[] => [
  {
    label,
    color,
    points: points.map((point) => ({
      label: point.fecha,
      value: point.value ?? 0,
    })),
  },
];
