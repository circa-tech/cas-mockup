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

type CompleteWeatherStationApiPoint = WeatherStationApiPoint & {
  humidityValue: number;
  lastUpdate: string;
  pressureValue: number;
  temperatureValue: number;
  windValue: number;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

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

const requireNumber = (
  value: number | null | undefined,
  fieldName: string,
  stationId: string,
) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Weather station ${stationId} is missing ${fieldName}`);
  }

  return value;
};

const hasCompleteStationData = (
  station: WeatherStationApiPoint,
): station is CompleteWeatherStationApiPoint =>
  typeof station.lastUpdate === "string" &&
  station.lastUpdate.trim().length > 0 &&
  typeof station.temperatureValue === "number" &&
  !Number.isNaN(station.temperatureValue) &&
  typeof station.humidityValue === "number" &&
  !Number.isNaN(station.humidityValue) &&
  typeof station.windValue === "number" &&
  !Number.isNaN(station.windValue) &&
  typeof station.pressureValue === "number" &&
  !Number.isNaN(station.pressureValue);

const mapSnapshotToStations = (snapshot: WeatherStationSnapshot): MeteoStationPoint[] =>
  snapshot.stations.flatMap((station) => {
    if (!hasCompleteStationData(station)) {
      return [];
    }

    return {
      id: station.id,
      name: station.name,
      lat: station.lat,
      lng: station.lng,
      lastUpdate: station.lastUpdate,
      sourceType: "telemetry",
      status: station.status ?? "stale",
      temperatureValue: requireNumber(station.temperatureValue, "temperatureValue", station.id),
      humidityValue: requireNumber(station.humidityValue, "humidityValue", station.id),
      windValue: requireNumber(station.windValue, "windValue", station.id),
      pressureValue: requireNumber(station.pressureValue, "pressureValue", station.id),
    };
  });
