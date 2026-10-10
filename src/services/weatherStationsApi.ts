import { apiFetch } from "../offline/apiFetch";
import { MeteoStationPoint } from "../data/mockupData";
import { throwApiError } from "./apiError";

type WeatherStationSnapshot = {
  etag?: string | null;
  generatedAt: string;
  stations: WeatherStationApiPoint[];
};

type WeatherStationApiPoint = {
  humidityValue?: number | null;
  id: string;
  lastUpdate?: string | null;
  lat: number;
  lng: number;
  name: string;
  pressureValue?: number | null;
  sourceType?: "telemetry";
  status?: "fresh" | "warning" | "stale";
  temperatureValue?: number | null;
  windValue?: number | null;
};

const apiBaseUrl = import.meta.env?.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

export const fetchWeatherStationPoints = async (
  idToken: string | null,
): Promise<MeteoStationPoint[]> => {
  if (!apiBaseUrl) {
    throw new Error("Missing VITE_API_BASE_URL");
  }

  const headers = new Headers({ Authorization: `Bearer ${idToken}` });
  const response = await apiFetch(`${apiBaseUrl}/api/v1/weather-stations/snapshot`, {
    headers,
  });
  if (!response.ok) await throwApiError(response, "Weather station snapshot");
  const snapshot = (await response.json()) as WeatherStationSnapshot;
  return mapSnapshotToStations(snapshot);
};

const finiteMetric = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

// One unavailable sensor must not hide the entire station (or climate tab).
export const mapSnapshotToStations = (snapshot: WeatherStationSnapshot): MeteoStationPoint[] =>
  snapshot.stations.flatMap((station) => {
    if (!Number.isFinite(station.lat) || !Number.isFinite(station.lng)) return [];
    return [{
      id: station.id,
      name: station.name,
      lat: station.lat,
      lng: station.lng,
      lastUpdate: station.lastUpdate || "Sin datos",
      sourceType: "telemetry" as const,
      status: station.status ?? "stale",
      temperatureValue: finiteMetric(station.temperatureValue),
      humidityValue: finiteMetric(station.humidityValue),
      windValue: finiteMetric(station.windValue),
      pressureValue: finiteMetric(station.pressureValue),
    }];
  });
