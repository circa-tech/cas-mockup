import type { LinePoint } from "../components/SimpleLineChart";
import type { WellMapPoint } from "../data/mockupData";
import { throwApiError } from "./apiError";

type GroundwaterMeasurement = {
  flowRate: string | number;
  measurementDate: string;
  measurementTime: string;
  totalizer: string | number;
  waterTableDepth?: string | number | null;
};

type WellMeasurement = {
  aquiferSector?: string | null;
  codigoObra?: string | null;
  createdAt: string;
  groundwaterMeasurement: GroundwaterMeasurement;
  id: number;
  lat?: number | null;
  lng?: number | null;
  name?: string | null;
  provider?: string | null;
  wellId?: string | null;
};

export type WellRegistryEntry = {
  active: boolean;
  aquiferSector?: string | null;
  centroControlRut?: string | null;
  codigoObra: string;
  createdAt: string;
  id: string;
  lat: number;
  lng: number;
  name: string;
  provider?: string | null;
  updatedAt: string;
};

export type CreateWellRegistryEntryPayload = {
  aquiferSector?: string | null;
  centroControlRut?: string | null;
  codigoObra: string;
  lat: number;
  lng: number;
  name: string;
  provider?: string | null;
};

export type GrantWellAccessPayload = {
  firebaseUid: string;
  permission: "read" | "write" | "admin";
};

export type IngestWellMeasurementPayload = {
  codigoObra: string;
  companyRut: string;
  flowRate: string;
  measurementDate: string;
  measurementTime: string;
  waterTableDepth: string | null;
  totalizer: string;
  userRut: string;
};

export type WellsCapabilities = {
  canAddMeasurements: boolean;
  canCreateWells: boolean;
  canDeleteMeasurements: boolean;
  canManageAccess: boolean;
  canViewWells: boolean;
  isAdmin: boolean;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

export const fetchWellMapPoints = async (idToken: string): Promise<WellMapPoint[]> => {
  if (!apiBaseUrl) {
    throw new Error("Missing VITE_API_BASE_URL");
  }

  const response = await fetch(`${apiBaseUrl}/api/v1/wells/groundwater-measurements`, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!response.ok) {
    await throwApiError(response, "Wells measurements");
  }

  const measurements = (await response.json()) as WellMeasurement[];
  return mapMeasurementsToWells(measurements);
};

export const fetchWellsAdminStatus = async (
  idToken: string,
): Promise<WellsCapabilities> => {
  const response = await requestWells("admin/me", idToken);
  return response.json() as Promise<WellsCapabilities>;
};

export const fetchWellRegistryEntries = async (
  idToken: string,
): Promise<WellRegistryEntry[]> => {
  const response = await requestWells("registry", idToken);
  return response.json() as Promise<WellRegistryEntry[]>;
};

export const fetchMyWellRegistryEntries = async (
  idToken: string,
): Promise<WellRegistryEntry[]> => {
  const response = await requestWells("registry/mine", idToken);
  return response.json() as Promise<WellRegistryEntry[]>;
};

export const createWellRegistryEntry = async (
  idToken: string,
  payload: CreateWellRegistryEntryPayload,
): Promise<WellRegistryEntry> => {
  const response = await requestWells("registry", idToken, {
    body: JSON.stringify(payload),
    method: "POST",
  });
  return response.json() as Promise<WellRegistryEntry>;
};

export const grantWellAccess = async (
  idToken: string,
  wellId: string,
  payload: GrantWellAccessPayload,
): Promise<void> => {
  await requestWells(`registry/${wellId}/access`, idToken, {
    body: JSON.stringify(payload),
    method: "POST",
  });
};

export const ingestWellMeasurement = async (
  idToken: string,
  payload: IngestWellMeasurementPayload,
): Promise<void> => {
  await requestWells("groundwater-measurements", idToken, {
    body: JSON.stringify({
      credentials: {
        companyRut: payload.companyRut,
        userRut: payload.userRut,
      },
      groundwaterMeasurement: {
        flowRate: toDecimalString(payload.flowRate),
        measurementDate: payload.measurementDate,
        measurementTime: normalizeTime(payload.measurementTime),
        totalizer: toIntegerString(payload.totalizer),
        waterTableDepth:
          payload.waterTableDepth === null || payload.waterTableDepth.trim() === ""
            ? null
            : toDecimalString(payload.waterTableDepth),
      },
    }),
    headers: {
      sourceTimestamp: toSourceTimestamp(new Date()),
      workCode: payload.codigoObra,
    },
    method: "POST",
  });
};

const requestWells = async (
  path: string,
  idToken: string,
  init?: RequestInit,
): Promise<Response> => {
  if (!apiBaseUrl) {
    throw new Error("Missing VITE_API_BASE_URL");
  }

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${idToken}`);
  if (init?.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${apiBaseUrl}/api/v1/wells/${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    await throwApiError(response, `Wells ${path}`);
  }

  return response;
};

const toDecimalString = (value: string): string => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Los campos caudal y nivel freatico deben ser numeros positivos.");
  }
  return parsed.toFixed(2);
};

const toIntegerString = (value: string): string => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("El totalizador debe ser un numero entero positivo.");
  }
  return String(parsed);
};

const normalizeTime = (value: string): string => {
  if (/^\d{2}:\d{2}$/.test(value)) {
    return `${value}:00`;
  }
  return value;
};

const toSourceTimestamp = (value: Date): string => {
  const pad = (input: number) => String(input).padStart(2, "0");
  const year = value.getFullYear();
  const month = pad(value.getMonth() + 1);
  const day = pad(value.getDate());
  const hours = pad(value.getHours());
  const minutes = pad(value.getMinutes());
  const seconds = pad(value.getSeconds());
  const offsetMinutes = -value.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const offsetHours = pad(Math.floor(absoluteOffset / 60));
  const offsetRemainder = pad(absoluteOffset % 60);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}${offsetRemainder}`;
};

const mapMeasurementsToWells = (measurements: WellMeasurement[]): WellMapPoint[] => {
  const grouped = new Map<string, WellMeasurement[]>();

  measurements.forEach((measurement) => {
    const wellKey = measurement.wellId ?? measurement.codigoObra;
    if (!wellKey) {
      return;
    }

    grouped.set(wellKey, [...(grouped.get(wellKey) ?? []), measurement]);
  });

  return [...grouped.entries()].flatMap(([wellKey, rows]) => {
    const sortedRows = [...rows].sort(compareByMeasurementTimestamp);
    const latest = sortedRows[sortedRows.length - 1];

    if (!latest || !hasRegistryLocation(latest)) {
      return [];
    }

    return {
      id: wellKey,
      name: latest.name ?? latest.codigoObra ?? wellKey,
      lat: latest.lat,
      lng: latest.lng,
      lastUpdate: toMeasurementIso(latest.groundwaterMeasurement),
      sourceType: "telemetry",
      provider: latest.provider ?? "Sin proveedor",
      aquiferSector: latest.aquiferSector ?? "Sin sector",
      levelSeries: buildLevelSeries(sortedRows),
      status: "stale",
    };
  });
};

const hasRegistryLocation = (
  measurement: WellMeasurement,
): measurement is WellMeasurement & { lat: number; lng: number; name: string } =>
  typeof measurement.lat === "number" &&
  !Number.isNaN(measurement.lat) &&
  typeof measurement.lng === "number" &&
  !Number.isNaN(measurement.lng) &&
  typeof measurement.name === "string" &&
  measurement.name.trim().length > 0;

const compareByMeasurementTimestamp = (left: WellMeasurement, right: WellMeasurement) =>
  toMeasurementIso(left.groundwaterMeasurement).localeCompare(
    toMeasurementIso(right.groundwaterMeasurement),
  );

const buildLevelSeries = (measurements: WellMeasurement[]): LinePoint[] => {
  const points = measurements.flatMap((measurement) => {
    const value = toNumber(measurement.groundwaterMeasurement.waterTableDepth);
    if (value === null) {
      return [];
    }

    return {
      label: toChartLabel(measurement.groundwaterMeasurement.measurementDate),
      value,
    };
  });

  return points.slice(-18);
};

const toMeasurementIso = (measurement: GroundwaterMeasurement) =>
  `${measurement.measurementDate}T${measurement.measurementTime}-03:00`;

const toChartLabel = (value: string) => {
  const [, month, day] = value.split("-");
  return month && day ? `${day}/${month}` : value;
};

const toNumber = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};
