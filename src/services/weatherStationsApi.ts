import { apiFetch } from "../offline/apiFetch";
import type { MeteoMeasurement, MeteoStationPoint } from "../data/mockupData";
import { throwApiError } from "./apiError";

type WeatherStationSnapshot = {
  etag?: string | null;
  generatedAt: string;
  stations: WeatherStationApiPoint[];
};

type WeatherStationApiPoint = {
  id: string;
  lastUpdate?: string | null;
  lat: number;
  lng: number;
  name: string;
  measurements?: WeatherStationApiMeasurement[];
  sourceType?: "telemetry";
  status?: "fresh" | "warning" | "stale";
  temperatureValue?: number | null;
};

type WeatherStationApiMeasurement = {
  measurementName: string;
  portNumber?: number | null;
  recordedAt?: string | null;
  sensorName?: string | null;
  unit?: string | null;
  value?: number | null;
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

const mapMeasurement = (measurement: WeatherStationApiMeasurement): MeteoMeasurement => ({
  measurementName: measurement.measurementName,
  portNumber: measurement.portNumber ?? null,
  recordedAt: measurement.recordedAt ?? "",
  sensorName: measurement.sensorName ?? "",
  unit: measurement.unit ?? null,
  value: finiteMetric(measurement.value),
});

// One unavailable sensor must not hide the entire station (or climate tab).
export const mapSnapshotToStations = (snapshot: WeatherStationSnapshot): MeteoStationPoint[] => {
  const stations = snapshot.stations.flatMap((station) => {
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
      measurements: (station.measurements ?? []).map(mapMeasurement),
    }];
  });

  if (stations.some((station) => station.id === "zentra-z6-05550")) return stations;

  return [
    ...stations,
    {
      id: "zentra-z6-05550",
      name: "Lautaro",
      lat: -28.0414415,
      lng: -69.9828402,
      lastUpdate: "Sin datos",
      sourceType: "telemetry",
      status: "stale",
      temperatureValue: null,
      measurements: [],
    },
  ];
};
