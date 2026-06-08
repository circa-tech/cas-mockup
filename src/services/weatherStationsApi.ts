import { MeteoStationPoint } from "../data/mockupData";

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

const snapshotCacheKey = "cas_weather_stations_snapshot";
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

type CachedSnapshot = {
  etag: string | null;
  snapshot: WeatherStationSnapshot;
};

export const fetchWeatherStationPoints = async (
  idToken: string,
): Promise<MeteoStationPoint[]> => {
  if (!apiBaseUrl) {
    throw new Error("Missing VITE_API_BASE_URL");
  }

  const cached = readCachedSnapshot();
  const headers = new Headers({
    Authorization: `Bearer ${idToken}`,
  });
  if (cached?.etag) {
    headers.set("If-None-Match", cached.etag);
  }

  const response = await fetch(`${apiBaseUrl}/api/v1/weather-stations/snapshot`, {
    headers,
  });

  if (response.status === 304 && cached) {
    return mapSnapshotToStations(cached.snapshot);
  }

  if (!response.ok) {
    throw new Error(`Weather station snapshot request failed: ${response.status}`);
  }

  const snapshot = (await response.json()) as WeatherStationSnapshot;
  writeCachedSnapshot({
    etag: response.headers.get("ETag") ?? snapshot.etag ?? null,
    snapshot,
  });

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

const readCachedSnapshot = (): CachedSnapshot | null => {
  try {
    const raw = window.localStorage.getItem(snapshotCacheKey);
    return raw ? (JSON.parse(raw) as CachedSnapshot) : null;
  } catch {
    return null;
  }
};

const writeCachedSnapshot = (snapshot: CachedSnapshot) => {
  try {
    window.localStorage.setItem(snapshotCacheKey, JSON.stringify(snapshot));
  } catch {
    // Cache failures should not block the dashboard.
  }
};
