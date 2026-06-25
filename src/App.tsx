import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CloudRain,
  CloudSun,
  Droplets,
  Gauge,
  LoaderCircle,
  LogIn,
  LogOut,
  MapPinned,
  Radio,
  Save,
  ShieldCheck,
  Snowflake,
  Sun,
  Thermometer,
  UserRound,
  Waves,
} from "lucide-react";
import {
  Cell,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EtrMap, type EtrSectorSelection } from "./components/EtrMap";
import {
  defaultEtrQuadrantSelection,
  EtrQuadrantMap,
  type EtrQuadrantSelection,
} from "./components/EtrQuadrantMap";
import {
  buildEtrUsoSelection,
  defaultEtrUsoMapSelection,
  EtrUsoMap,
  type EtrUsoFeature,
  type EtrUsoSelection,
} from "./components/EtrUsoMap";
import { KpiCard } from "./components/KpiCard";
import { MiniSparkline } from "./components/MiniSparkline";
import { SimpleBarChart } from "./components/SimpleBarChart";
import { SimpleLineChart, type LineSeries } from "./components/SimpleLineChart";
import { SnowCoverageMap } from "./components/SnowCoverageMap";
import { StatusLeafletMap } from "./components/StatusLeafletMap";
import {
  buildEtrDownloadFilename,
  chartPalette,
  computeOverviewCards,
  etrDownloadFormats,
  etrDownloadMonthLabels,
  etrDownloadVariables,
  EtrDownloadFormat,
  EtrDownloadVariable,
  etrLastUpdateIso,
  etrOverviewBarGroups,
  etrOverviewSeasonSeries,
  etrRegions,
  etrStats,
  getEtrDownloadDays,
  getEtrDownloadMonths,
  getEtrDownloadYears,
  getFreshnessStatus,
  ManualWellEntry,
  MeteoStationPoint,
  meteoStationPoints,
  mockNowIso,
  snowJorqueraSeries,
  snowLastUpdateIso,
  snowManflasSeries,
  snowOverviewSeries,
  snowPulidoSeries,
  staleThresholdDaysDefault,
  ViewId,
  views,
  wellMapPoints,
  WellMapPoint,
  waterQualityRecords,
  WaterQualityStatus,
} from "./data/mockupData";
import {
  getSnowBalanceDisplayRows,
  getSnowBalanceRecord,
  getSnowBalanceYears,
  snowBalanceBasinLabels,
  snowBalanceLatestYear,
  SnowBalanceBasinId,
} from "./data/snowBalanceData";
import {
  isFirebaseConfigured,
  signInWithEmailPassword,
  signInWithGoogle,
  signOutFromGoogle,
  subscribeToAuthSession,
} from "./services/firebaseAuth";
import {
  fetchAdminRoles,
  fetchAdminUsers,
  updateAdminUserRole,
  type AdminRole,
  type AdminUser,
} from "./services/adminApi";
import {
  fetchEtrCult,
  fetchEtrDataCuad,
  fetchEtrDownCuad,
  fetchEtrDownCuadImageBlob,
  fetchEtrPoly,
  fetchEtrQuadrantMap,
  fetchEtrSectorMap,
  fetchEtrSerieEt,
  fetchEtrStdAe,
  fetchEtrUsoMap,
  fetchKcPoly,
  fetchLaiPoly,
  GeoJsonFeatureCollection,
  toEtrBarGroups,
  toEtrEtmaxSeries,
  toSingleMetricSeries,
} from "./services/etrApi";
import { fetchWeatherStationPoints } from "./services/weatherStationsApi";
import {
  fetchModisSnowBasinsGeoJson,
  fetchModisSnowCoverageSeries,
  fetchModisSnowLatestImage,
  toModisSnowLineSeries,
} from "./services/modisSnowApi";
import type { ModisSnowBasinsGeoJson } from "./services/modisSnowApi";
import {
  createWellRegistryEntry,
  fetchWellAccessEntries,
  fetchMyWellRegistryEntries,
  fetchWellMapPoints,
  fetchWellRegistryEntries,
  fetchWellsAdminStatus,
  ingestWellMeasurement,
  revokeWellAccess,
  setWellAccess,
  type IngestWellMeasurementPayload,
  type WellAccessEntry,
  type WellsCapabilities,
  type WellRegistryEntry,
} from "./services/wellsApi";
import { downloadMockQuadrantPng } from "./utils/mockQuadrantExport";

const monthLabels = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const navIconMap = {
  overview: Gauge,
  etr: Droplets,
  snow: Snowflake,
  wells: Waves,
  meteo: Thermometer,
  admin: ShieldCheck,
} as const;

type RemoteLoadStatus = "idle" | "loading" | "ready" | "error";

const etrLoadingStats = [
  { label: "Última fecha disponible", value: "Cargando..." },
  { label: "ETR media", value: "Cargando..." },
  { label: "ETMAX media", value: "Cargando..." },
];

const etrUnavailableStats = [
  { label: "Última fecha disponible", value: "Sin datos" },
  { label: "ETR media", value: "Sin datos" },
  { label: "ETMAX media", value: "Sin datos" },
];

const authStorageKey = "cas_mockup_is_logged_in";
const authUserStorageKey = "cas_mockup_user_name";
const defaultAuthUserName = "Camila Rojas";

const freshnessClassMap = {
  fresh: "is-good",
  warning: "is-warning",
  stale: "is-danger",
} as const;

const freshnessLabelMap = {
  fresh: "Actualizado < 24 h",
  warning: "Actualizado 24-48 h",
  stale: "Sin reporte > 48 h",
} as const;

const freshnessCompactLabelMap = {
  fresh: "OK",
  warning: "Seguim.",
  stale: "Alerta",
} as const;

const productFreshnessLabelMap = {
  fresh: "Actualizado",
  warning: "Actualizacion pendiente",
  stale: "Sin actualizacion reciente",
} as const;

const etrFreshnessLabelMap = {
  fresh: "Actualizado",
  warning: "En ventana de actualizacion",
  stale: "Sin actualizacion reciente",
} as const;

const qualityClassMap: Record<WaterQualityStatus, string> = {
  good: "is-good",
  watch: "is-warning",
  alert: "is-danger",
};

const qualityLabelMap: Record<WaterQualityStatus, string> = {
  good: "Buena",
  watch: "Atención",
  alert: "Alerta",
};

const sourceLabelMap = {
  telemetry: "Telemetría",
  manual: "Manual",
} as const;

const getStationWeatherSummary = (station: MeteoStationPoint) => {
  if (station.humidityValue >= 52 || (station.temperatureValue <= 15.5 && station.humidityValue >= 47)) {
    return {
      icon: CloudRain,
      label: "Precipitaciones",
      tone: "rain",
    } as const;
  }

  if (station.humidityValue >= 44) {
    return {
      icon: CloudSun,
      label: "Parcial nublado",
      tone: "cloud",
    } as const;
  }

  return {
    icon: Sun,
    label: "Soleado",
    tone: "sun",
  } as const;
};

type ManualFormState = {
  date: string;
  level: string;
  note: string;
  operator: string;
  time: string;
  wellId: string;
};

function Panel({
  children,
  className,
  title,
  subtitle,
}: {
  children: ReactNode;
  className?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <section className={`panel ${className ?? ""}`.trim()}>
      <header className="panel-header">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </header>
      <div className="panel-content">{children}</div>
    </section>
  );
}

function RemoteDataState({
  className,
  icon,
  message,
  title,
  tone = "loading",
}: {
  className?: string;
  icon?: ReactNode;
  message: string;
  title: string;
  tone?: "loading" | "error";
}) {
  const Icon = tone === "loading" ? LoaderCircle : AlertTriangle;
  const stateClassName = [
    "data-state",
    `is-${tone}`,
    icon ? "has-custom-icon" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={stateClassName}
      role={tone === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      <span className="data-state-icon" aria-hidden="true">
        {icon ?? <Icon size={18} />}
      </span>
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}

const toChartDateLabel = (date: string) => {
  const parsed = new Date(`${date}T00:00:00`);
  const month = monthLabels[parsed.getMonth()] ?? "N/A";
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${month} ${day}`;
};

type WellRegistryFormState = {
  aquiferSector: string;
  centroControlRut: string;
  codigoObra: string;
  lat: string;
  lng: string;
  name: string;
  provider: string;
};

type WellMeasurementFormState = {
  codigoObra: string;
  companyRut: string;
  flowRate: string;
  measurementDate: string;
  measurementTime: string;
  totalizer: string;
  userRut: string;
  waterTableDepth: string;
};

function WellRegistryAdminPanel({
  authIdToken,
  canManageAccess,
  currentUserUid,
  entries,
  form,
  message,
  onChange,
  onSubmit,
  status,
}: {
  authIdToken: string | null;
  canManageAccess: boolean;
  currentUserUid: string | null;
  entries: WellRegistryEntry[];
  form: WellRegistryFormState;
  message: string | null;
  onChange: (next: Partial<WellRegistryFormState>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  status: RemoteLoadStatus;
}) {
  const [selectedAccessWellId, setSelectedAccessWellId] = useState("");
  const [accessEntries, setAccessEntries] = useState<WellAccessEntry[]>([]);
  const [accessStatus, setAccessStatus] = useState<RemoteLoadStatus>("idle");
  const [accessMessage, setAccessMessage] = useState<string | null>(null);
  const [accessFirebaseUid, setAccessFirebaseUid] = useState("");
  const [accessPermission, setAccessPermission] =
    useState<WellAccessEntry["permission"]>("write");
  const previewLat = Number.parseFloat(form.lat);
  const previewLng = Number.parseFloat(form.lng);
  const hasPreviewLocation = Number.isFinite(previewLat) && Number.isFinite(previewLng);
  const selectedAccessWell = entries.find((entry) => entry.id === selectedAccessWellId);

  useEffect(() => {
    if (!selectedAccessWellId && entries.length > 0) {
      setSelectedAccessWellId(entries[0].id);
    }
  }, [entries, selectedAccessWellId]);

  useEffect(() => {
    let isMounted = true;
    if (!canManageAccess || !authIdToken || !selectedAccessWellId) {
      setAccessEntries([]);
      setAccessStatus("idle");
      return () => {
        isMounted = false;
      };
    }

    setAccessStatus("loading");
    setAccessMessage(null);
    fetchWellAccessEntries(authIdToken, selectedAccessWellId)
      .then((nextEntries) => {
        if (isMounted) {
          setAccessEntries(nextEntries);
          setAccessStatus("ready");
        }
      })
      .catch((error) => {
        if (isMounted) {
          setAccessEntries([]);
          setAccessStatus("error");
          setAccessMessage(
            toRemoteErrorMessage(error, "No fue posible cargar los accesos del pozo."),
          );
        }
      });

    return () => {
      isMounted = false;
    };
  }, [authIdToken, canManageAccess, selectedAccessWellId]);

  const refreshAccessEntries = async () => {
    if (!authIdToken || !selectedAccessWellId) {
      return;
    }
    setAccessEntries(await fetchWellAccessEntries(authIdToken, selectedAccessWellId));
  };

  const handleAccessSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authIdToken || !selectedAccessWellId || !accessFirebaseUid.trim()) {
      return;
    }
    setAccessStatus("loading");
    setAccessMessage(null);
    try {
      await setWellAccess(
        authIdToken,
        selectedAccessWellId,
        accessFirebaseUid.trim(),
        accessPermission,
      );
      await refreshAccessEntries();
      setAccessFirebaseUid("");
      setAccessStatus("ready");
      setAccessMessage("Acceso actualizado.");
    } catch (error) {
      setAccessStatus("error");
      setAccessMessage(toRemoteErrorMessage(error, "No fue posible actualizar el acceso."));
    }
  };

  const handleAccessRevoke = async (firebaseUid: string) => {
    if (!authIdToken || !selectedAccessWellId) {
      return;
    }
    setAccessStatus("loading");
    setAccessMessage(null);
    try {
      await revokeWellAccess(authIdToken, selectedAccessWellId, firebaseUid);
      await refreshAccessEntries();
      setAccessStatus("ready");
      setAccessMessage("Acceso revocado.");
    } catch (error) {
      setAccessStatus("error");
      setAccessMessage(toRemoteErrorMessage(error, "No fue posible revocar el acceso."));
    }
  };

  return (
    <Panel
      title="Administracion de pozos"
      subtitle={`${entries.length} pozos en registry`}
    >
      <form className="manual-entry-form" onSubmit={onSubmit}>
        <div className="manual-two-col">
          <label>
            <span>Codigo obra</span>
            <input
              type="text"
              value={form.codigoObra}
              placeholder="OB-0101-114"
              onChange={(event) => onChange({ codigoObra: event.target.value })}
              required
            />
          </label>
          <label>
            <span>Nombre</span>
            <input
              type="text"
              value={form.name}
              placeholder="Pozo Norte"
              onChange={(event) => onChange({ name: event.target.value })}
              required
            />
          </label>
        </div>

        <div className="manual-two-col">
          <label>
            <span>Latitud</span>
            <input
              type="number"
              step="0.000001"
              value={form.lat}
              placeholder="-27.360000"
              onChange={(event) => onChange({ lat: event.target.value })}
              required
            />
          </label>
          <label>
            <span>Longitud</span>
            <input
              type="number"
              step="0.000001"
              value={form.lng}
              placeholder="-70.330000"
              onChange={(event) => onChange({ lng: event.target.value })}
              required
            />
          </label>
        </div>

        <div className="manual-two-col">
          <label>
            <span>Provider</span>
            <input
              type="text"
              value={form.provider}
              placeholder="Proveedor Norte"
              onChange={(event) => onChange({ provider: event.target.value })}
            />
          </label>
          <label>
            <span>Centro control RUT</span>
            <input
              type="text"
              value={form.centroControlRut}
              placeholder="77555666-7"
              onChange={(event) => onChange({ centroControlRut: event.target.value })}
            />
          </label>
        </div>

        <label>
          <span>Sector acuifero</span>
          <input
            type="text"
            value={form.aquiferSector}
            placeholder="Acuifero 1"
            onChange={(event) => onChange({ aquiferSector: event.target.value })}
          />
        </label>

        {message && <p className="login-error">{message}</p>}
        <button type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Guardando..." : "Crear pozo"}
        </button>
      </form>

      <div className="registry-map-preview">
        {hasPreviewLocation ? (
          <StatusLeafletMap
            className="is-registry-preview"
            points={[
              {
                id: "new-well-preview",
                lat: previewLat,
                lastUpdate: new Date().toISOString(),
                lng: previewLng,
                name: form.name || form.codigoObra || "Nuevo pozo",
                sourceType: "manual",
                status: "fresh",
              },
            ]}
            selectedPointId="new-well-preview"
          />
        ) : (
          <RemoteDataState
            className="is-compact"
            icon={<MapPinned size={18} />}
            message="Ingresa latitud y longitud para previsualizar el punto."
            title="Sin ubicacion"
            tone="loading"
          />
        )}
      </div>

      {entries.length > 0 && (
        <div className="registry-list">
          {entries.slice(0, 6).map((entry) => (
            <div className="registry-row" key={entry.id}>
              <div>
                <strong>{entry.name}</strong>
                <span>{entry.codigoObra}</span>
              </div>
              <span>{entry.provider ?? "Sin provider"}</span>
            </div>
          ))}
        </div>
      )}

      {canManageAccess && entries.length > 0 && (
        <div className="well-access-admin">
          <h4>Accesos por pozo</h4>
          <label>
            <span>Pozo</span>
            <select
              value={selectedAccessWellId}
              onChange={(event) => setSelectedAccessWellId(event.target.value)}
            >
              {entries.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} - {entry.codigoObra}
                </option>
              ))}
            </select>
          </label>

          <form className="manual-entry-form" onSubmit={handleAccessSubmit}>
            <div className="manual-two-col">
              <label>
                <span>Firebase UID</span>
                <input
                  type="text"
                  value={accessFirebaseUid}
                  placeholder="UID del usuario"
                  onChange={(event) => setAccessFirebaseUid(event.target.value)}
                  required
                />
              </label>
              <label>
                <span>Permiso</span>
                <select
                  value={accessPermission}
                  onChange={(event) =>
                    setAccessPermission(event.target.value as WellAccessEntry["permission"])}
                >
                  <option value="read">Lectura</option>
                  <option value="write">Lectura y mediciones</option>
                  <option value="admin">Administrar acceso</option>
                </select>
              </label>
            </div>
            <button type="submit" disabled={accessStatus === "loading"}>
              {accessStatus === "loading" ? "Guardando..." : "Asignar acceso"}
            </button>
          </form>

          {accessMessage && <p className="login-error">{accessMessage}</p>}
          <div className="registry-list">
            {accessEntries.map((entry) => (
              <div className="registry-row" key={entry.id}>
                <div>
                  <strong>{entry.firebaseUid}</strong>
                  <span>
                    {entry.firebaseUid === currentUserUid ? "Tu usuario · " : ""}
                    {entry.permission}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={accessStatus === "loading"}
                  onClick={() => handleAccessRevoke(entry.firebaseUid)}
                >
                  Revocar
                </button>
              </div>
            ))}
            {accessStatus === "ready" && accessEntries.length === 0 && (
              <p>Sin usuarios asignados a {selectedAccessWell?.name ?? "este pozo"}.</p>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

function WellMeasurementIngestPanel({
  csvMessage,
  entries,
  form,
  message,
  onChange,
  onCsvUpload,
  onSubmit,
  status,
}: {
  csvMessage: string | null;
  entries: WellRegistryEntry[];
  form: WellMeasurementFormState;
  message: string | null;
  onChange: (next: Partial<WellMeasurementFormState>) => void;
  onCsvUpload: (file: File) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  status: RemoteLoadStatus;
}) {
  const hasRegistryEntries = entries.length > 0;

  return (
    <div className="measurement-upload-grid">
      <Panel
        title="Agregar medicion"
        subtitle="Carga directa desde el mockup"
      >
        <form className="manual-entry-form" onSubmit={onSubmit}>
          <label>
            <span>Pozo</span>
            <select
              value={form.codigoObra}
              onChange={(event) => onChange({ codigoObra: event.target.value })}
              required
              disabled={!hasRegistryEntries}
            >
              <option value="">Selecciona un pozo</option>
              {entries.map((entry) => (
                <option key={entry.id} value={entry.codigoObra}>
                  {entry.name} - {entry.codigoObra}
                </option>
              ))}
            </select>
          </label>

          <div className="manual-two-col">
            <label>
              <span>RUT empresa</span>
              <input
                type="text"
                value={form.companyRut}
                placeholder="77555666-7"
                onChange={(event) => onChange({ companyRut: event.target.value })}
                required
              />
            </label>
            <label>
              <span>RUT usuario</span>
              <input
                type="text"
                value={form.userRut}
                placeholder="20999888-7"
                onChange={(event) => onChange({ userRut: event.target.value })}
                required
              />
            </label>
          </div>

          <div className="manual-two-col">
            <label>
              <span>Fecha medicion</span>
              <input
                type="date"
                value={form.measurementDate}
                onChange={(event) => onChange({ measurementDate: event.target.value })}
                required
              />
            </label>
            <label>
              <span>Hora medicion</span>
              <input
                type="time"
                value={form.measurementTime}
                onChange={(event) => onChange({ measurementTime: event.target.value })}
                required
              />
            </label>
          </div>

          <div className="manual-two-col">
            <label>
              <span>Caudal</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.flowRate}
                placeholder="1.00"
                onChange={(event) => onChange({ flowRate: event.target.value })}
                required
              />
            </label>
            <label>
              <span>Nivel freatico</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.waterTableDepth}
                placeholder="9.85"
                onChange={(event) => onChange({ waterTableDepth: event.target.value })}
              />
            </label>
          </div>

          <label>
            <span>Totalizador</span>
            <input
              type="number"
              min="0"
              step="1"
              value={form.totalizer}
              placeholder="1010"
              onChange={(event) => onChange({ totalizer: event.target.value })}
              required
            />
          </label>

          {message && <p className="login-error">{message}</p>}
          <button type="submit" disabled={status === "loading" || !hasRegistryEntries}>
            {status === "loading" ? "Guardando..." : "Guardar medicion"}
          </button>
        </form>
      </Panel>

      <Panel title="Carga CSV" subtitle="Carga una o varias mediciones">
        <div className="csv-upload-box">
          <input
            accept=".csv,text/csv"
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                onCsvUpload(file);
              }
              event.currentTarget.value = "";
            }}
          />
          <p>
            Encabezados esperados: codigoObra, companyRut, userRut, flowRate,
            measurementDate, measurementTime, waterTableDepth, totalizer.
          </p>
          {csvMessage && <p className="login-error">{csvMessage}</p>}
        </div>
      </Panel>
    </div>
  );
}

const toSummaryUpdateIso = (date: string, fallback: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return `${date}T00:00:00-03:00`;
  }

  return fallback;
};

const formatDateTime = (value: string) => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("es-CL", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
};

const formatRelativeAge = (lastUpdate: string, now: Date) => {
  const diffMs = Math.max(0, now.getTime() - new Date(lastUpdate).getTime());
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < hour) {
    return `Hace ${Math.max(1, Math.round(diffMs / minute))} min`;
  }

  if (diffMs < day) {
    return `Hace ${Math.round(diffMs / hour)} h`;
  }

  return `Hace ${Math.round(diffMs / day)} días`;
};

const technicalRemoteErrorPatterns = [
  /credentials? invalid/i,
  /firestore unavailable/i,
  /getting metadata from plugin failed/i,
  /reauthentication is needed/i,
  /gcloud auth application-default login/i,
];

const toRemoteErrorMessage = (error: unknown, fallback: string) => {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.trim();
  if (message.length === 0) {
    return fallback;
  }

  if (technicalRemoteErrorPatterns.some((pattern) => pattern.test(message))) {
    return fallback;
  }

  return message;
};

const parseCsv = (input: string): string[][] => {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let isQuoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const nextChar = input[index + 1];

    if (char === '"' && isQuoted && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      isQuoted = !isQuoted;
      continue;
    }

    if (char === "," && !isQuoted) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !isQuoted) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(current.trim());
      current = "";
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    current += char;
  }

  row.push(current.trim());
  if (row.some((cell) => cell.length > 0)) {
    rows.push(row);
  }

  return rows;
};

const parseMeasurementCsv = (input: string): IngestWellMeasurementPayload[] => {
  const [headerRow, ...dataRows] = parseCsv(input);
  if (!headerRow || dataRows.length === 0) {
    throw new Error("El CSV debe incluir encabezado y al menos una fila.");
  }

  const headers = headerRow.map((header) => header.trim());
  const requiredHeaders = [
    "codigoObra",
    "companyRut",
    "userRut",
    "flowRate",
    "measurementDate",
    "measurementTime",
    "totalizer",
  ];
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    throw new Error(`Faltan columnas requeridas: ${missingHeaders.join(", ")}.`);
  }

  const columnIndex = new Map(headers.map((header, index) => [header, index]));
  const readCell = (row: string[], header: string) => row[columnIndex.get(header) ?? -1] ?? "";

  return dataRows.map((row, index) => {
    const payload: IngestWellMeasurementPayload = {
      codigoObra: readCell(row, "codigoObra"),
      companyRut: readCell(row, "companyRut"),
      flowRate: readCell(row, "flowRate"),
      measurementDate: readCell(row, "measurementDate"),
      measurementTime: readCell(row, "measurementTime"),
      totalizer: readCell(row, "totalizer"),
      userRut: readCell(row, "userRut"),
      waterTableDepth: readCell(row, "waterTableDepth") || null,
    };

    const missingValues = requiredHeaders.filter((header) => {
      const value = payload[header as keyof IngestWellMeasurementPayload];
      return typeof value !== "string" || value.trim().length === 0;
    });
    if (missingValues.length > 0) {
      throw new Error(`Fila ${index + 2}: faltan valores en ${missingValues.join(", ")}.`);
    }

    return payload;
  });
};

const getCurrentValue = (points: { value: number }[]) =>
  points[points.length - 1]?.value ?? 0;

const getDailyChangeValue = (points: { value: number }[]) => {
  const last = points[points.length - 1]?.value ?? 0;
  const reference = points[Math.max(0, points.length - 2)]?.value ?? last;
  return last - reference;
};

const getRangeValue = (points: { value: number }[]) => {
  if (points.length === 0) {
    return 0;
  }

  const values = points.map((point) => point.value);
  return Math.max(...values) - Math.min(...values);
};

const upsertSeriesPoint = (
  points: { label: string; value: number }[],
  label: string,
  value: number,
) => {
  const next = points.filter((point) => point.label !== label);
  next.push({ label, value });
  return next.slice(-18);
};

const toOverviewMiniDateLabel = (value: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [, month, day] = value.split("-");
    return `${day}/${month}`;
  }

  return value.length > 8 ? value.slice(0, 8) : value;
};

type OverviewMiniSeries = {
  color: string;
  label: string;
  values: number[];
};

const buildOverviewMiniRows = (
  labels: string[] | undefined,
  lines: OverviewMiniSeries[],
) => {
  const pointsLength = Math.max(0, ...lines.map((line) => line.values.length));
  return Array.from({ length: pointsLength }, (_, index) => {
    const row: Record<string, number | string> = {
      label: labels?.[index] ?? `P${index + 1}`,
    };
    lines.forEach((line) => {
      row[line.label] = line.values[index] ?? 0;
    });
    return row;
  });
};

function OverviewMiniLine({
  labels,
  lines,
  unit,
}: {
  labels?: string[];
  lines: OverviewMiniSeries[];
  unit: string;
}) {
  const rows = useMemo(() => buildOverviewMiniRows(labels, lines), [labels, lines]);

  return (
    <div className="overview-mini-chart">
      <ResponsiveContainer height={196} width="100%">
        <LineChart data={rows} margin={{ bottom: 10, left: 8, right: 8, top: 6 }}>
          <CartesianGrid stroke="hsl(210 18% 91%)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            angle={-28}
            axisLine={{ stroke: "hsl(210 18% 86%)" }}
            dataKey="label"
            height={42}
            interval="preserveStartEnd"
            minTickGap={10}
            tick={{ fill: "hsl(215 14% 50%)", fontSize: 10 }}
            tickFormatter={(value: string) => toOverviewMiniDateLabel(value)}
            tickLine={false}
            tickMargin={4}
            textAnchor="end"
          />
          <YAxis
            axisLine={{ stroke: "hsl(210 18% 86%)" }}
            tick={{ fill: "hsl(215 14% 50%)", fontSize: 10 }}
            tickLine={false}
            width={42}
          />
          <RechartsTooltip
            animationDuration={120}
            contentStyle={{
              background: "hsl(0 0% 100%)",
              border: "1px solid hsl(210 18% 87%)",
              borderRadius: "8px",
              boxShadow: "0 8px 16px rgba(16, 44, 92, 0.12)",
              fontSize: "11px",
            }}
            cursor={{ stroke: "hsl(215 38% 70%)", strokeDasharray: "3 3" }}
            formatter={(value, name) => [`${Number(value ?? 0).toFixed(2)} ${unit}`, String(name)]}
            labelFormatter={(label) => String(toOverviewMiniDateLabel(String(label)))}
          />
          {lines.map((line, index) => (
            <Line
              key={line.label}
              activeDot={{ r: 4 }}
              animationBegin={index * 90}
              animationDuration={620}
              dataKey={line.label}
              dot={{ r: 2 }}
              isAnimationActive
              stroke={line.color}
              strokeWidth={2.1}
              type="monotone"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const defaultEtrSectorSelection: EtrSectorSelection = {
  sectorId: "19",
  sectorName: "Aguas arriba Embalse Lautaro",
  regionId: "valle-bajo",
  regionLabel: "Valle bajo",
};

const getSectorSeed = (sectorId: string) => {
  const parsed = Number.parseInt(sectorId, 10);
  return Number.isNaN(parsed) ? 1 : parsed;
};

const buildSectorBarGroups = (sectorId: string, baseGroups: typeof etrOverviewBarGroups) => {
  const seed = getSectorSeed(sectorId);

  return baseGroups.map((group, groupIndex) => ({
    ...group,
    series: group.series.map((series, seriesIndex) => {
      const factor = 0.88 + ((seed * 13 + groupIndex * 7 + seriesIndex * 11) % 30) / 100;
      const bias = seriesIndex === 0 ? -0.25 : 0.25;
      const value = Math.max(0.2, Number((series.value * factor + bias).toFixed(1)));
      return {
        ...series,
        value,
      };
    }),
  }));
};

const buildSectorSeasonSeries = (
  sectorId: string,
  baseSeries: typeof etrOverviewSeasonSeries,
) => {
  const seed = getSectorSeed(sectorId);

  return baseSeries.map((series, seriesIndex) => ({
    ...series,
    points: series.points.map((point, index) => {
      const wave = (((seed + index * 3 + seriesIndex * 5) % 9) - 4) * 0.02;
      const drift = ((seed % 5) - 2) * 0.01;
      return {
        ...point,
        value: Math.max(0, Number((point.value + wave + drift).toFixed(2))),
      };
    }),
  }));
};

type EtrSubTabId = "sector" | "usage" | "downloads";

const getSeriesDomain = (
  series: LineSeries[],
  {
    clampMin = 0,
    minSpan = 0.2,
    padRatio = 0.12,
  }: { clampMin?: number; minSpan?: number; padRatio?: number } = {},
) => {
  const values = series.flatMap((line) => line.points.map((point) => point.value));
  const min = values.length > 0 ? Math.min(...values) : clampMin;
  const max = values.length > 0 ? Math.max(...values) : clampMin + minSpan;
  const span = Math.max(minSpan, max - min);
  const lower = Math.max(clampMin, Number((min - span * padRatio).toFixed(2)));
  const upper = Number((max + span * padRatio).toFixed(2));
  return {
    max: Math.max(lower + minSpan, upper),
    min: lower,
  };
};

const getBarGroupsMaxValue = (groups: ReturnType<typeof toEtrBarGroups>, fallback: number) => {
  const values = groups.flatMap((group) => group.series.map((series) => series.value));
  if (values.length === 0) {
    return fallback;
  }

  return Math.max(fallback, Math.ceil(Math.max(...values) / 5) * 5);
};

type EtrUsoRecord = {
  cultivo: string;
  etmaxValue: number;
  etrEtmaxSeries: LineSeries[];
  etrValue: number;
  kcSeries: LineSeries[];
  laiSeries: LineSeries[];
  lastDate: string;
};

const toUsoDisplayMetric = (rawValue: number) =>
  Number((rawValue * 0.1).toFixed(1));

const buildUsoDateLabels = (latestDate: string, total = 18) => {
  const parsed = new Date(`${latestDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return Array.from({ length: total }, (_, index) => `P-${total - index}`);
  }

  return Array.from({ length: total }, (_, index) => {
    const pointDate = new Date(parsed);
    pointDate.setDate(parsed.getDate() - (total - index - 1) * 8);
    return pointDate.toISOString().slice(0, 10);
  });
};

const buildUsageTrend = ({
  amplitude,
  baseline,
  floor,
  labels,
  seed,
}: {
  amplitude: number;
  baseline: number;
  floor: number;
  labels: string[];
  seed: number;
}) => {
  const total = labels.length;
  const values = labels.map((_, index) => {
    const progress = total <= 1 ? 1 : index / (total - 1);
    const trend = (progress - 0.5) * baseline * 0.2;
    const wave = Math.sin((index + seed * 0.11) / 2.6) * amplitude;
    const jitter = ((((seed * 19 + index * 7) % 7) - 3) * amplitude) / 12;
    return Math.max(floor, Number((baseline + trend + wave + jitter).toFixed(2)));
  });

  values[values.length - 1] = Number(baseline.toFixed(2));
  return values;
};

const buildEtrUsoRecordFromSelection = (selection: EtrUsoSelection): EtrUsoRecord => {
  const parsedSeed = Number.parseInt(selection.usoId, 10);
  const seed = Number.isNaN(parsedSeed) ? 1 : parsedSeed;
  const labels = buildUsoDateLabels(selection.date, 18);
  const etrValue = toUsoDisplayMetric(selection.etrRaw);
  const etmaxValue = toUsoDisplayMetric(selection.etmaxRaw);
  const kcValue = Math.max(
    0.2,
    Math.min(1.35, Number((etmaxValue > 0 ? etrValue / etmaxValue : 0.55).toFixed(2))),
  );
  const laiValue = Math.max(
    0.5,
    Math.min(
      5.8,
      Number((0.8 + kcValue * 3 + ((seed % 5) - 2) * 0.12).toFixed(2)),
    ),
  );

  const etrSeriesValues = buildUsageTrend({
    amplitude: Math.max(0.05, etrValue * 0.16),
    baseline: etrValue,
    floor: 0.02,
    labels,
    seed,
  });
  const etmaxSeriesValues = buildUsageTrend({
    amplitude: Math.max(0.07, etmaxValue * 0.14),
    baseline: etmaxValue,
    floor: 0.04,
    labels,
    seed: seed + 3,
  });
  const kcSeriesValues = buildUsageTrend({
    amplitude: Math.max(0.05, kcValue * 0.2),
    baseline: kcValue,
    floor: 0.05,
    labels,
    seed: seed + 7,
  });
  const laiSeriesValues = buildUsageTrend({
    amplitude: Math.max(0.1, laiValue * 0.16),
    baseline: laiValue,
    floor: 0.2,
    labels,
    seed: seed + 11,
  });

  return {
    cultivo: selection.cultivo,
    etmaxValue,
    etrEtmaxSeries: [
      {
        color: chartPalette.chart2,
        label: "ETR media",
        points: labels.map((label, index) => ({
          label,
          value: etrSeriesValues[index] ?? etrValue,
        })),
      },
      {
        color: chartPalette.chart4,
        label: "ETMAX media",
        points: labels.map((label, index) => ({
          label,
          value: etmaxSeriesValues[index] ?? etmaxValue,
        })),
      },
    ],
    etrValue,
    kcSeries: [
      {
        color: chartPalette.chart5,
        label: "Kc media",
        points: labels.map((label, index) => ({
          label,
          value: kcSeriesValues[index] ?? kcValue,
        })),
      },
    ],
    laiSeries: [
      {
        color: chartPalette.chart1,
        label: "LAI media",
        points: labels.map((label, index) => ({
          label,
          value: laiSeriesValues[index] ?? laiValue,
        })),
      },
    ],
    lastDate: selection.date,
  };
};

function EtrSectorTab({
  authIdToken,
  isLoggedIn,
}: {
  authIdToken: string | null;
  isLoggedIn: boolean;
}) {
  const [selectedSector, setSelectedSector] = useState<EtrSectorSelection>(
    defaultEtrSectorSelection,
  );
  const [overviewStatus, setOverviewStatus] = useState<RemoteLoadStatus>("idle");
  const [selectedSectorStatus, setSelectedSectorStatus] =
    useState<RemoteLoadStatus>("idle");
  const [sectorMapData, setSectorMapData] = useState<GeoJsonFeatureCollection | null>(null);
  const [stats, setStats] = useState(etrStats);
  const [overviewBarGroups, setOverviewBarGroups] = useState(etrOverviewBarGroups);
  const [overviewSeasonSeries, setOverviewSeasonSeries] = useState(etrOverviewSeasonSeries);
  const [selectedSectorBarGroups, setSelectedSectorBarGroups] = useState(
    buildSectorBarGroups(defaultEtrSectorSelection.sectorId, etrOverviewBarGroups),
  );
  const [selectedSectorSeasonSeries, setSelectedSectorSeasonSeries] = useState(
    buildSectorSeasonSeries(defaultEtrSectorSelection.sectorId, etrOverviewSeasonSeries),
  );
  const selectedRegion = useMemo(
    () => etrRegions.find((region) => region.id === selectedSector.regionId) ?? etrRegions[0],
    [selectedSector.regionId],
  );
  const overviewBarMaxValue = useMemo(
    () => getBarGroupsMaxValue(overviewBarGroups, 25),
    [overviewBarGroups],
  );
  const selectedBarMaxValue = useMemo(
    () => getBarGroupsMaxValue(selectedSectorBarGroups, 35),
    [selectedSectorBarGroups],
  );
  const selectedSeasonMax = useMemo(() => {
    const max = Math.max(
      ...selectedSectorSeasonSeries.flatMap((series) =>
        series.points.map((point) => point.value),
      ),
    );
    return Math.max(1.8, Math.ceil(max * 10) / 10);
  }, [selectedSectorSeasonSeries]);

  useEffect(() => {
    let isMounted = true;

    if (!isLoggedIn) {
      setOverviewStatus("idle");
      setSectorMapData(null);
      setStats(etrStats);
      setOverviewBarGroups(etrOverviewBarGroups);
      setOverviewSeasonSeries(etrOverviewSeasonSeries);
      return () => {
        isMounted = false;
      };
    }

    setOverviewStatus("loading");
    setSectorMapData(null);

    if (!authIdToken) {
      return () => {
        isMounted = false;
      };
    }

    Promise.all([
      fetchEtrStdAe(authIdToken),
      fetchEtrSerieEt(authIdToken),
      fetchEtrCult(authIdToken),
      fetchEtrSectorMap(authIdToken),
    ])
      .then(([stdAe, serieEt, etCult, sectorMap]) => {
        if (!isMounted) {
          return;
        }

        setStats([
          { label: "Última fecha disponible", value: stdAe.fecha },
          { label: "ETR media", value: `${(stdAe.etr ?? 0).toFixed(1)} mm/día` },
          { label: "ETMAX media", value: `${(stdAe.etmax ?? 0).toFixed(1)} mm/día` },
        ]);
        setOverviewSeasonSeries(toEtrEtmaxSeries(serieEt));
        setOverviewBarGroups(toEtrBarGroups(etCult));
        setSectorMapData(sectorMap);
        setOverviewStatus("ready");
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setSectorMapData(null);
        setOverviewStatus("error");
      });

    return () => {
      isMounted = false;
    };
  }, [authIdToken, isLoggedIn]);

  useEffect(() => {
    let isMounted = true;

    const fallbackBarGroups = buildSectorBarGroups(selectedSector.sectorId, selectedRegion.barGroups);
    const fallbackSeasonSeries = buildSectorSeasonSeries(
      selectedSector.sectorId,
      selectedRegion.seasonSeries,
    );

    if (!isLoggedIn) {
      setSelectedSectorStatus("idle");
      setSelectedSectorBarGroups(fallbackBarGroups);
      setSelectedSectorSeasonSeries(fallbackSeasonSeries);
      return () => {
        isMounted = false;
      };
    }

    setSelectedSectorStatus("loading");

    if (!authIdToken) {
      return () => {
        isMounted = false;
      };
    }

    Promise.all([
      fetchEtrCult(authIdToken, selectedSector.sectorId),
      fetchEtrSerieEt(authIdToken, selectedSector.sectorId),
    ])
      .then(([etCult, serieEt]) => {
        if (!isMounted) {
          return;
        }

        setSelectedSectorBarGroups(toEtrBarGroups(etCult));
        setSelectedSectorSeasonSeries(toEtrEtmaxSeries(serieEt));
        setSelectedSectorStatus("ready");
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setSelectedSectorStatus("error");
      });

    return () => {
      isMounted = false;
    };
  }, [
    authIdToken,
    isLoggedIn,
    selectedRegion.barGroups,
    selectedRegion.seasonSeries,
    selectedSector.sectorId,
  ]);

  const statsForCards = isLoggedIn
    ? overviewStatus === "ready"
      ? stats
      : overviewStatus === "error"
        ? etrUnavailableStats
        : etrLoadingStats
    : stats;
  const showOverviewData = !isLoggedIn || overviewStatus === "ready";
  const showSelectedSectorData = !isLoggedIn || selectedSectorStatus === "ready";
  const overviewStateTone = overviewStatus === "error" ? "error" : "loading";
  const selectedStateTone = selectedSectorStatus === "error" ? "error" : "loading";

  return (
    <div className="view-stack">
      <div className="stat-grid">
        <KpiCard
          delayMs={0}
          icon={Gauge}
          title={statsForCards[0].label}
          value={statsForCards[0].value}
          note="Disponibilidad ET-LAT"
          noteTone="neutral"
        />
        <KpiCard
          delayMs={80}
          icon={Droplets}
          title={statsForCards[1].label}
          value={statsForCards[1].value}
          note="Balance hídrico base"
          noteTone="positive"
        />
        <KpiCard
          delayMs={160}
          icon={MapPinned}
          title={statsForCards[2].label}
          value={statsForCards[2].value}
          note="Potencial atmosférico"
          noteTone="neutral"
        />
      </div>

      <div className="etr-summary-grid">
        <Panel
          title="Distribución de ETR (mm) por clase de cultivo en la última fecha disponible"
        >
          {showOverviewData ? (
            <SimpleBarChart
              chartHeight={338}
              groups={overviewBarGroups}
              maxValue={overviewBarMaxValue}
              tickStep={5}
              unit="mm"
              xLabelAngle={-18}
            />
          ) : (
            <RemoteDataState
              className="is-chart"
              title={overviewStateTone === "error" ? "No se pudo cargar ET-LAT" : "Cargando ET-LAT"}
              message={
                overviewStateTone === "error"
                  ? "El servicio no respondió con datos reales para el resumen por sector."
                  : "Consultando el servicio en GCP para evitar mostrar datos de mockup."
              }
              tone={overviewStateTone}
            />
          )}
        </Panel>

        <Panel
          title="Comportamiento de ETR y ETmax en la temporada (mm)"
        >
          {showOverviewData ? (
            <SimpleLineChart
              labelEvery={3}
              maxValue={1.8}
              minValue={0}
              series={overviewSeasonSeries}
              unit="mm"
              xLabelAngle={-45}
            />
          ) : (
            <RemoteDataState
              className="is-chart"
              title={overviewStateTone === "error" ? "No se pudo cargar ET-LAT" : "Cargando ET-LAT"}
              message={
                overviewStateTone === "error"
                  ? "El servicio no respondió con la serie real de temporada."
                  : "Esperando la serie real de ETR y ETmax desde GCP."
              }
              tone={overviewStateTone}
            />
          )}
        </Panel>
      </div>

      <div className="etr-top-grid">
        <Panel
          className="panel-etr-map"
          title="Mapa sectores y áreas de gestión CAS Copiapó"
        >
          {showOverviewData ? (
            <EtrMap
              geoJson={isLoggedIn ? sectorMapData ?? undefined : undefined}
              selectedSectorId={selectedSector.sectorId}
              selectedSummaryLabel={`${selectedSector.sectorName} · ${selectedSector.regionLabel}`}
              onSelect={setSelectedSector}
            />
          ) : (
            <RemoteDataState
              className="is-map"
              title={overviewStateTone === "error" ? "Mapa no disponible" : "Cargando mapa ET-LAT"}
              message={
                overviewStateTone === "error"
                  ? "No se pudo obtener la geometría real de sectores desde GCP."
                  : "Esperando la geometría real de sectores."
              }
              tone={overviewStateTone}
            />
          )}
        </Panel>

        <Panel
          className="panel-etr-bar"
          title="Distribución de ETR (mm) por clase de cultivo en la última fecha disponible"
          subtitle={`${selectedSector.sectorName} · ${selectedRegion.label}`}
        >
          {showSelectedSectorData ? (
            <SimpleBarChart
              chartHeight="100%"
              groups={selectedSectorBarGroups}
              maxValue={selectedBarMaxValue}
              tickStep={5}
              unit="mm"
              xLabelAngle={-16}
            />
          ) : (
            <RemoteDataState
              className="is-chart"
              title={
                selectedStateTone === "error"
                  ? "No se pudo cargar el sector"
                  : "Cargando sector"
              }
              message={
                selectedStateTone === "error"
                  ? "El servicio no respondió con datos reales para el sector seleccionado."
                  : "Consultando datos reales para el sector seleccionado."
              }
              tone={selectedStateTone}
            />
          )}
        </Panel>
      </div>

      <Panel
        title="Variación temporal de la ETR y ETmax"
        subtitle={`${selectedSector.sectorName} · ${selectedRegion.label}`}
        className="panel-accent-blue"
      >
        {showSelectedSectorData ? (
          <SimpleLineChart
            labelEvery={2}
            maxValue={selectedSeasonMax}
            minValue={0}
            series={selectedSectorSeasonSeries}
            unit="mm"
            xLabelAngle={-45}
          />
        ) : (
          <RemoteDataState
            className="is-chart"
            title={
              selectedStateTone === "error"
                ? "No se pudo cargar la serie"
                : "Cargando serie del sector"
            }
            message={
              selectedStateTone === "error"
                ? "El servicio no respondió con la serie real para el sector seleccionado."
                : "Esperando la serie real de ETR y ETmax."
            }
            tone={selectedStateTone}
          />
        )}
      </Panel>
    </div>
  );
}

function EtrUsageTab({
  authIdToken,
  isLoggedIn,
}: {
  authIdToken: string | null;
  isLoggedIn: boolean;
}) {
  const [selectedUso, setSelectedUso] = useState<EtrUsoSelection>(
    defaultEtrUsoMapSelection,
  );
  const [mapStatus, setMapStatus] = useState<RemoteLoadStatus>("idle");
  const [usageStatus, setUsageStatus] = useState<RemoteLoadStatus>("idle");
  const [usoMapData, setUsoMapData] = useState<GeoJsonFeatureCollection | null>(null);
  const [remoteUsageRecord, setRemoteUsageRecord] = useState<EtrUsoRecord | null>(null);
  const fallbackUsageRecord = useMemo(
    () => buildEtrUsoRecordFromSelection(selectedUso),
    [selectedUso],
  );
  const usageRecord = remoteUsageRecord ?? fallbackUsageRecord;
  const etrEtmaxDomain = useMemo(
    () =>
      getSeriesDomain(usageRecord.etrEtmaxSeries, {
        clampMin: 0,
        minSpan: 0.35,
        padRatio: 0.16,
      }),
    [usageRecord.etrEtmaxSeries],
  );
  const kcDomain = useMemo(
    () =>
      getSeriesDomain(usageRecord.kcSeries, {
        clampMin: 0,
        minSpan: 0.2,
        padRatio: 0.14,
      }),
    [usageRecord.kcSeries],
  );
  const laiDomain = useMemo(
    () =>
      getSeriesDomain(usageRecord.laiSeries, {
        clampMin: 0,
        minSpan: 0.4,
        padRatio: 0.16,
      }),
    [usageRecord.laiSeries],
  );

  useEffect(() => {
    let isMounted = true;

    if (!isLoggedIn) {
      setMapStatus("idle");
      setUsoMapData(null);
      return () => {
        isMounted = false;
      };
    }

    setMapStatus("loading");
    setUsoMapData(null);
    setRemoteUsageRecord(null);

    if (!authIdToken) {
      return () => {
        isMounted = false;
      };
    }

    fetchEtrUsoMap(authIdToken)
      .then((geoJson) => {
        if (!isMounted) {
          return;
        }

        setUsoMapData(geoJson);
        const features = geoJson.features as EtrUsoFeature[];
        const defaultFeature =
          features.find((feature) => String(feature.properties?.uso_id ?? feature.id) === "855") ??
          features[0];
        if (defaultFeature) {
          setSelectedUso(buildEtrUsoSelection(defaultFeature));
        }
        setMapStatus("ready");
      })
      .catch(() => {
        if (isMounted) {
          setUsoMapData(null);
          setMapStatus("error");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [authIdToken, isLoggedIn]);

  useEffect(() => {
    let isMounted = true;

    if (!isLoggedIn) {
      setUsageStatus("idle");
      setRemoteUsageRecord(null);
      return () => {
        isMounted = false;
      };
    }

    if (!authIdToken || mapStatus !== "ready" || !selectedUso.usoId) {
      setUsageStatus(mapStatus === "error" ? "error" : "loading");
      setRemoteUsageRecord(null);
      return () => {
        isMounted = false;
      };
    }

    setUsageStatus("loading");
    setRemoteUsageRecord(null);

    Promise.all([
      fetchEtrPoly(authIdToken, selectedUso.usoId),
      fetchKcPoly(authIdToken, selectedUso.usoId),
      fetchLaiPoly(authIdToken, selectedUso.usoId),
    ])
      .then(([etPoly, kcPoly, laiPoly]) => {
        if (!isMounted) {
          return;
        }

        if (etPoly.length === 0) {
          setUsageStatus("error");
          return;
        }

        const lastEtPoint = etPoly[etPoly.length - 1];
        setRemoteUsageRecord({
          cultivo: selectedUso.cultivo,
          etmaxValue: lastEtPoint.etmax ?? fallbackUsageRecord.etmaxValue,
          etrEtmaxSeries: toEtrEtmaxSeries(etPoly),
          etrValue: lastEtPoint.etr ?? fallbackUsageRecord.etrValue,
          kcSeries: toSingleMetricSeries(
            kcPoly.map((point) => ({ fecha: point.fecha, value: point.kc })),
            "Kc media",
            chartPalette.chart5,
          ),
          laiSeries: toSingleMetricSeries(
            laiPoly.map((point) => ({ fecha: point.fecha, value: point.lai })),
            "LAI media",
            chartPalette.chart1,
          ),
          lastDate: lastEtPoint.fecha,
        });
        setUsageStatus("ready");
      })
      .catch(() => {
        if (isMounted) {
          setRemoteUsageRecord(null);
          setUsageStatus("error");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [
    authIdToken,
    fallbackUsageRecord,
    isLoggedIn,
    mapStatus,
    selectedUso.cultivo,
    selectedUso.usoId,
  ]);

  const showMapData = !isLoggedIn || mapStatus === "ready";
  const showUsageData = !isLoggedIn || usageStatus === "ready";
  const mapStateTone = mapStatus === "error" ? "error" : "loading";
  const usageStateTone = usageStatus === "error" ? "error" : "loading";

  return (
    <div className="view-stack">
      <div className="etr-usage-top-grid">
        <Panel
          className="panel-etr-map"
          title="Mapa de uso de suelo agrícola Valle de Copiapó"
        >
          {showMapData ? (
            <EtrUsoMap
              geoJson={isLoggedIn ? usoMapData ?? undefined : undefined}
              selectedSummaryLabel={`${selectedUso.cultivo} · Uso ${selectedUso.usoId}`}
              selectedUsoId={selectedUso.usoId}
              onSelect={setSelectedUso}
            />
          ) : (
            <RemoteDataState
              className="is-map"
              title={
                mapStateTone === "error"
                  ? "Mapa de usos no disponible"
                  : "Cargando mapa de usos"
              }
              message={
                mapStateTone === "error"
                  ? "No se pudo obtener la geometría real de usos agrícolas desde GCP."
                  : "Esperando la geometría real de usos agrícolas."
              }
              tone={mapStateTone}
            />
          )}
        </Panel>

        <Panel
          title="Variables para el polígono seleccionado"
          subtitle={`Uso ${selectedUso.usoId} · ${usageRecord.cultivo}`}
        >
          {showUsageData ? (
            <div className="etr-usage-cards">
              <article className="etr-usage-card">
                <span>Cultivo</span>
                <strong>{usageRecord.cultivo}</strong>
              </article>
              <article className="etr-usage-card">
                <span>ETR para {usageRecord.lastDate}</span>
                <strong>{usageRecord.etrValue.toFixed(1)} mm/día</strong>
              </article>
              <article className="etr-usage-card">
                <span>ETMAX para {usageRecord.lastDate}</span>
                <strong>{usageRecord.etmaxValue.toFixed(1)} mm/día</strong>
              </article>
            </div>
          ) : (
            <RemoteDataState
              className="is-compact"
              title={
                usageStateTone === "error"
                  ? "Polígono no disponible"
                  : "Cargando polígono"
              }
              message={
                usageStateTone === "error"
                  ? "No se pudo obtener la serie real para el uso seleccionado."
                  : "Consultando variables reales para el uso seleccionado."
              }
              tone={usageStateTone}
            />
          )}
        </Panel>
      </div>

      <Panel
        title="Variación temporal de la ETR y ETmax"
        subtitle={`Uso ${selectedUso.usoId} · ${usageRecord.cultivo}`}
        className="panel-accent-blue"
      >
        {showUsageData ? (
          <SimpleLineChart
            labelEvery={3}
            maxValue={etrEtmaxDomain.max}
            minValue={etrEtmaxDomain.min}
            series={usageRecord.etrEtmaxSeries}
            unit="mm"
            xLabelAngle={-45}
          />
        ) : (
          <RemoteDataState
            className="is-chart"
            title={
              usageStateTone === "error"
                ? "Serie ETR no disponible"
                : "Cargando serie ETR"
            }
            message={
              usageStateTone === "error"
                ? "El servicio no respondió con la serie real de ETR y ETmax."
                : "Esperando datos reales de ETR y ETmax."
            }
            tone={usageStateTone}
          />
        )}
      </Panel>

      <div className="etr-usage-chart-grid">
        <Panel title="Variación temporal del Kc">
          {showUsageData ? (
            <SimpleLineChart
              labelEvery={3}
              maxValue={kcDomain.max}
              minValue={kcDomain.min}
              series={usageRecord.kcSeries}
              unit="Kc"
              xLabelAngle={-45}
            />
          ) : (
            <RemoteDataState
              className="is-chart"
              title={
                usageStateTone === "error" ? "Serie Kc no disponible" : "Cargando serie Kc"
              }
              message={
                usageStateTone === "error"
                  ? "El servicio no respondió con la serie real de Kc."
                  : "Esperando datos reales de Kc."
              }
              tone={usageStateTone}
            />
          )}
        </Panel>
        <Panel title="Variación temporal del LAI">
          {showUsageData ? (
            <SimpleLineChart
              labelEvery={3}
              maxValue={laiDomain.max}
              minValue={laiDomain.min}
              series={usageRecord.laiSeries}
              unit="LAI"
              xLabelAngle={-45}
            />
          ) : (
            <RemoteDataState
              className="is-chart"
              title={
                usageStateTone === "error" ? "Serie LAI no disponible" : "Cargando serie LAI"
              }
              message={
                usageStateTone === "error"
                  ? "El servicio no respondió con la serie real de LAI."
                  : "Esperando datos reales de LAI."
              }
              tone={usageStateTone}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

function EtrDownloadsTab({
  authIdToken,
  isLoggedIn,
}: {
  authIdToken: string | null;
  isLoggedIn: boolean;
}) {
  const [selectedQuadrant, setSelectedQuadrant] = useState<EtrQuadrantSelection>(
    defaultEtrQuadrantSelection,
  );
  const [selectedVariable, setSelectedVariable] = useState<EtrDownloadVariable>("ETR");
  const [selectedFormat, setSelectedFormat] = useState<EtrDownloadFormat>("PNG");
  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedMonth, setSelectedMonth] = useState(1);
  const [selectedDay, setSelectedDay] = useState(1);
  const [downloadFeedback, setDownloadFeedback] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [quadrantMapData, setQuadrantMapData] = useState<GeoJsonFeatureCollection | null>(null);
  const [quadrantMapStatus, setQuadrantMapStatus] =
    useState<RemoteLoadStatus>("idle");
  const [yearsStatus, setYearsStatus] = useState<RemoteLoadStatus>("idle");
  const [monthsStatus, setMonthsStatus] = useState<RemoteLoadStatus>("idle");
  const [daysStatus, setDaysStatus] = useState<RemoteLoadStatus>("idle");

  const fallbackYears = useMemo(
    () => getEtrDownloadYears(selectedQuadrant.quadrantId, selectedVariable),
    [selectedQuadrant.quadrantId, selectedVariable],
  );
  const fallbackMonths = useMemo(
    () =>
      getEtrDownloadMonths(
        selectedQuadrant.quadrantId,
        selectedVariable,
        selectedYear,
    ),
    [selectedQuadrant.quadrantId, selectedVariable, selectedYear],
  );
  const fallbackDays = useMemo(
    () =>
      getEtrDownloadDays(
        selectedQuadrant.quadrantId,
        selectedVariable,
        selectedYear,
        selectedMonth,
    ),
    [selectedQuadrant.quadrantId, selectedVariable, selectedYear, selectedMonth],
  );
  const [years, setYears] = useState(fallbackYears);
  const [months, setMonths] = useState(fallbackMonths);
  const [days, setDays] = useState(fallbackDays);

  useEffect(() => {
    let isMounted = true;

    if (!isLoggedIn) {
      setQuadrantMapStatus("idle");
      setQuadrantMapData(null);
      return () => {
        isMounted = false;
      };
    }

    setQuadrantMapStatus("loading");
    setQuadrantMapData(null);

    if (!authIdToken) {
      return () => {
        isMounted = false;
      };
    }

    fetchEtrQuadrantMap(authIdToken)
      .then((geoJson) => {
        if (isMounted) {
          setQuadrantMapData(geoJson);
          setQuadrantMapStatus("ready");
        }
      })
      .catch(() => {
        if (isMounted) {
          setQuadrantMapData(null);
          setQuadrantMapStatus("error");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [authIdToken, isLoggedIn]);

  useEffect(() => {
    let isMounted = true;

    if (!isLoggedIn) {
      setYearsStatus("idle");
      setYears(fallbackYears);
      return () => {
        isMounted = false;
      };
    }

    setYearsStatus("loading");

    if (!authIdToken) {
      return () => {
        isMounted = false;
      };
    }

    fetchEtrDataCuad(authIdToken, {
      quadrantId: selectedQuadrant.quadrantId,
      variable: selectedVariable,
    })
      .then((data) => {
        if (isMounted) {
          setYears(data.anos);
          setYearsStatus(data.anos.length > 0 ? "ready" : "error");
        }
      })
      .catch(() => {
        if (isMounted) {
          setYearsStatus("error");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [
    authIdToken,
    fallbackYears,
    isLoggedIn,
    selectedQuadrant.quadrantId,
    selectedVariable,
  ]);

  useEffect(() => {
    let isMounted = true;

    if (!isLoggedIn) {
      setMonthsStatus("idle");
      setMonths(fallbackMonths);
      return () => {
        isMounted = false;
      };
    }

    setMonthsStatus("loading");

    if (!authIdToken) {
      return () => {
        isMounted = false;
      };
    }

    fetchEtrDataCuad(authIdToken, {
      quadrantId: selectedQuadrant.quadrantId,
      variable: selectedVariable,
      year: selectedYear,
    })
      .then((data) => {
        if (isMounted) {
          setMonths(data.meses);
          setMonthsStatus(data.meses.length > 0 ? "ready" : "error");
        }
      })
      .catch(() => {
        if (isMounted) {
          setMonthsStatus("error");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [
    authIdToken,
    fallbackMonths,
    isLoggedIn,
    selectedQuadrant.quadrantId,
    selectedVariable,
    selectedYear,
  ]);

  useEffect(() => {
    let isMounted = true;

    if (!isLoggedIn) {
      setDaysStatus("idle");
      setDays(fallbackDays);
      return () => {
        isMounted = false;
      };
    }

    setDaysStatus("loading");

    if (!authIdToken) {
      return () => {
        isMounted = false;
      };
    }

    fetchEtrDataCuad(authIdToken, {
      quadrantId: selectedQuadrant.quadrantId,
      variable: selectedVariable,
      year: selectedYear,
      month: selectedMonth,
    })
      .then((data) => {
        if (isMounted) {
          setDays(data.dias);
          setDaysStatus(data.dias.length > 0 ? "ready" : "error");
        }
      })
      .catch(() => {
        if (isMounted) {
          setDaysStatus("error");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [
    authIdToken,
    fallbackDays,
    isLoggedIn,
    selectedMonth,
    selectedQuadrant.quadrantId,
    selectedVariable,
    selectedYear,
  ]);

  useEffect(() => {
    const latestYear = years.length > 0 ? Math.max(...years) : 2025;
    if (!years.includes(selectedYear)) {
      setSelectedYear(latestYear);
    }
  }, [selectedYear, years]);

  useEffect(() => {
    const latestMonth = months.length > 0 ? Math.max(...months) : 1;
    if (!months.includes(selectedMonth)) {
      setSelectedMonth(latestMonth);
    }
  }, [months, selectedMonth]);

  useEffect(() => {
    const latestDay = days.length > 0 ? Math.max(...days) : 1;
    if (!days.includes(selectedDay)) {
      setSelectedDay(latestDay);
    }
  }, [days, selectedDay]);

  const selectedMonthLabel =
    etrDownloadMonthLabels[selectedMonth - 1] ?? `Mes ${selectedMonth}`;
  const showQuadrantMapData = !isLoggedIn || quadrantMapStatus === "ready";
  const dateStatuses = [yearsStatus, monthsStatus, daysStatus];
  const datesHaveError =
    isLoggedIn && dateStatuses.some((status) => status === "error");
  const datesAreLoading =
    isLoggedIn &&
    !datesHaveError &&
    (!authIdToken || dateStatuses.some((status) => status !== "ready"));
  const quadrantMapTone = quadrantMapStatus === "error" ? "error" : "loading";

  const handleFakeDownload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsDownloading(true);

    const filename = buildEtrDownloadFilename({
      day: selectedDay,
      format: selectedFormat,
      month: selectedMonth,
      quadrantId: selectedQuadrant.quadrantId,
      variable: selectedVariable,
      year: selectedYear,
    });
    try {
      if (selectedFormat === "PNG") {
        let overlayUrl: string | undefined;
        if (authIdToken) {
          const overlayBlob = await fetchEtrDownCuadImageBlob(authIdToken, {
            day: selectedDay,
            format: selectedFormat,
            month: selectedMonth,
            quadrantId: selectedQuadrant.quadrantId,
            variable: selectedVariable,
            year: selectedYear,
          });
          overlayUrl = URL.createObjectURL(overlayBlob);
        }

        try {
          await downloadMockQuadrantPng({
            filename,
            overlayUrl,
            quadrantId: selectedQuadrant.quadrantId,
          });
        } finally {
          if (overlayUrl) {
            URL.revokeObjectURL(overlayUrl);
          }
        }
        setDownloadFeedback(`Exportacion visual solicitada: ${filename}`);
        return;
      }

      if (authIdToken) {
        const response = await fetchEtrDownCuad(authIdToken, {
          day: selectedDay,
          format: selectedFormat,
          month: selectedMonth,
          quadrantId: selectedQuadrant.quadrantId,
          variable: selectedVariable,
          year: selectedYear,
        });
        if (!response.url) {
          throw new Error("El servicio no retornó una URL de descarga.");
        }
        window.location.assign(response.url);
        setDownloadFeedback(`Descarga solicitada: ${filename}`);
        return;
      }

      setDownloadFeedback(
        `Solicitud TIFF simulada: ${filename}. Esta descarga se habilitará con un servicio raster real.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado al exportar PNG.";
      setDownloadFeedback(message);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="view-stack">
      <div className="etr-download-grid">
        <Panel className="panel-etr-map" title="Cuadrantes disponibles para descarga">
          {showQuadrantMapData ? (
            <EtrQuadrantMap
              geoJson={isLoggedIn ? quadrantMapData ?? undefined : undefined}
              selectedQuadrantId={selectedQuadrant.quadrantId}
              selectedSummaryLabel={selectedQuadrant.quadrantLabel}
              onSelect={(selection) => {
                setSelectedQuadrant(selection);
                setDownloadFeedback("");
              }}
            />
          ) : (
            <RemoteDataState
              className="is-map"
              title={
                quadrantMapTone === "error"
                  ? "Cuadrantes no disponibles"
                  : "Cargando cuadrantes"
              }
              message={
                quadrantMapTone === "error"
                  ? "No se pudo obtener la grilla real de cuadrantes desde GCP."
                  : "Esperando la grilla real de cuadrantes."
              }
              tone={quadrantMapTone}
            />
          )}
        </Panel>

        <Panel
          title="Descarga de imágenes"
          subtitle={selectedQuadrant.quadrantLabel}
        >
          {datesAreLoading || datesHaveError ? (
            <RemoteDataState
              className="is-compact"
              title={datesHaveError ? "Fechas no disponibles" : "Cargando fechas"}
              message={
                datesHaveError
                  ? "No se pudo obtener la disponibilidad real para la descarga."
                  : "Consultando años, meses y días disponibles en GCP."
              }
              tone={datesHaveError ? "error" : "loading"}
            />
          ) : (
            <>
              <div className="etr-download-copy">
                <p>
                  En la plataforma original los cuadrados corresponden a cuadrantes de
                  descarga sobre base satelital. Aquí simulamos descarga raster por
                  cuadrante, variable, fecha y formato.
                </p>
              </div>

              <form className="etr-download-form" onSubmit={handleFakeDownload}>
                <label>
                  <span>Variable</span>
                  <select
                    value={selectedVariable}
                    onChange={(event) =>
                      setSelectedVariable(event.target.value as EtrDownloadVariable)
                    }
                  >
                    {etrDownloadVariables.map((variable) => (
                      <option key={variable.value} value={variable.value}>
                        {variable.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Formato</span>
                  <select
                    value={selectedFormat}
                    onChange={(event) =>
                      setSelectedFormat(event.target.value as EtrDownloadFormat)
                    }
                  >
                    {etrDownloadFormats.map((format) => (
                      <option key={format.value} value={format.value}>
                        {format.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Año</span>
                  <select
                    value={selectedYear}
                    onChange={(event) => setSelectedYear(Number(event.target.value))}
                  >
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Mes</span>
                  <select
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(Number(event.target.value))}
                  >
                    {months.map((month) => (
                      <option key={month} value={month}>
                        {etrDownloadMonthLabels[month - 1] ?? `Mes ${month}`}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Día</span>
                  <select
                    value={selectedDay}
                    onChange={(event) => setSelectedDay(Number(event.target.value))}
                  >
                    {days.map((day) => (
                      <option key={day} value={day}>
                        {String(day).padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                </label>

                <button type="submit" disabled={isDownloading}>
                  {isDownloading ? "Procesando..." : "Descargar"}
                </button>
              </form>

              <p className="etr-download-selected">
                Selección actual: {selectedQuadrant.quadrantLabel} · {selectedVariable} ·{" "}
                {selectedFormat} · {selectedYear} · {selectedMonthLabel} ·{" "}
                {String(selectedDay).padStart(2, "0")}
              </p>
              <p className="etr-download-note">
                Nota mockup: la descarga PNG compone un recorte satelital por cuadrante
                con la capa raster disponible. TIFF usa el servicio raster real.
              </p>
              {downloadFeedback && (
                <p className="etr-download-feedback">{downloadFeedback}</p>
              )}
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

function EtrView({
  authIdToken,
  isLoggedIn,
}: {
  authIdToken: string | null;
  isLoggedIn: boolean;
}) {
  const [activeEtrTab, setActiveEtrTab] = useState<EtrSubTabId>("sector");

  useEffect(() => {
    if (!isLoggedIn && activeEtrTab !== "sector") {
      setActiveEtrTab("sector");
    }
  }, [activeEtrTab, isLoggedIn]);

  return (
    <div className="view-stack etr-page">
      <div className="view-intro">
        <h2>Monitoreo de Evapotranspiración en el Valle de Copiapó</h2>
      </div>

      <div className="etr-subnav" role="tablist" aria-label="Secciones de ETR">
        <button
          type="button"
          role="tab"
          aria-selected={activeEtrTab === "sector"}
          className={activeEtrTab === "sector" ? "is-active" : ""}
          onClick={() => setActiveEtrTab("sector")}
        >
          Indicadores por sector
        </button>
        {isLoggedIn && (
          <button
            type="button"
            role="tab"
            aria-selected={activeEtrTab === "usage"}
            className={activeEtrTab === "usage" ? "is-active" : ""}
            onClick={() => setActiveEtrTab("usage")}
          >
            Indicadores por uso
          </button>
        )}
        {isLoggedIn && (
          <button
            type="button"
            role="tab"
            aria-selected={activeEtrTab === "downloads"}
            className={activeEtrTab === "downloads" ? "is-active" : ""}
            onClick={() => setActiveEtrTab("downloads")}
          >
            Descarga de imágenes
          </button>
        )}
      </div>

      {!isLoggedIn && (
        <p className="etr-access-note">
          Inicia sesión para habilitar <strong>Indicadores por uso</strong> y{" "}
          <strong>Descarga de imágenes</strong>.
        </p>
      )}

      {activeEtrTab === "sector" && (
        <EtrSectorTab authIdToken={authIdToken} isLoggedIn={isLoggedIn} />
      )}
      {isLoggedIn && activeEtrTab === "usage" && (
        <EtrUsageTab authIdToken={authIdToken} isLoggedIn={isLoggedIn} />
      )}
      {isLoggedIn && activeEtrTab === "downloads" && (
        <EtrDownloadsTab authIdToken={authIdToken} isLoggedIn={isLoggedIn} />
      )}
    </div>
  );
}

const snowBalanceBasins: SnowBalanceBasinId[] = ["jorquera", "pulido", "manflas"];

function SnowView({
  authIdToken,
  isLoggedIn,
}: {
  authIdToken: string | null;
  isLoggedIn: boolean;
}) {
  const [activeSnowTab, setActiveSnowTab] = useState<"coverage" | "balance">("coverage");
  const [coverageStatus, setCoverageStatus] = useState<RemoteLoadStatus>("idle");
  const [imageStatus, setImageStatus] = useState<RemoteLoadStatus>("idle");
  const [basinsStatus, setBasinsStatus] = useState<RemoteLoadStatus>("idle");
  const [latestSnowImage, setLatestSnowImage] = useState<{
    date: string | null;
    url: string | null;
  }>({ date: null, url: null });
  const [overviewSeries, setOverviewSeries] = useState(snowOverviewSeries);
  const [jorqueraSeries, setJorqueraSeries] = useState(snowJorqueraSeries);
  const [pulidoSeries, setPulidoSeries] = useState(snowPulidoSeries);
  const [manflasSeries, setManflasSeries] = useState(snowManflasSeries);
  const [basinsGeoJson, setBasinsGeoJson] = useState<ModisSnowBasinsGeoJson | null>(null);
  const availableBalanceYears = useMemo(() => {
    const [firstBasin, ...remainingBasins] = snowBalanceBasins;
    const firstYears = getSnowBalanceYears(firstBasin);

    return [...new Set(firstYears)]
      .filter((year) =>
        remainingBasins.every((basin) => getSnowBalanceYears(basin).includes(year)),
      )
      .sort((a, b) => b - a);
  }, []);
  const [selectedBalanceYear, setSelectedBalanceYear] = useState<number>(
    availableBalanceYears[0] ?? snowBalanceLatestYear,
  );

  useEffect(() => {
    if (availableBalanceYears.includes(selectedBalanceYear)) {
      return;
    }

    setSelectedBalanceYear(availableBalanceYears[0] ?? snowBalanceLatestYear);
  }, [availableBalanceYears, selectedBalanceYear]);

  useEffect(() => {
    let isMounted = true;
    let objectUrl: string | null = null;

    if (!isLoggedIn) {
      setCoverageStatus("idle");
      setImageStatus("idle");
      setBasinsStatus("idle");
      setLatestSnowImage((previous) => {
        if (previous.url) {
          URL.revokeObjectURL(previous.url);
        }
        return { date: null, url: null };
      });
      setOverviewSeries(snowOverviewSeries);
      setJorqueraSeries(snowJorqueraSeries);
      setPulidoSeries(snowPulidoSeries);
      setManflasSeries(snowManflasSeries);
      setBasinsGeoJson(null);
      return () => {
        isMounted = false;
      };
    }

    setCoverageStatus("loading");
    setImageStatus("loading");
    setBasinsStatus("loading");
    setLatestSnowImage((previous) => {
      if (previous.url) {
        URL.revokeObjectURL(previous.url);
      }
      return { date: null, url: null };
    });
    setBasinsGeoJson(null);

    if (!authIdToken) {
      return () => {
        isMounted = false;
      };
    }

    fetchModisSnowCoverageSeries(authIdToken)
      .then((coverage) => {
        if (!isMounted) {
          return;
        }

        setOverviewSeries(toModisSnowLineSeries(coverage.ae ?? []));
        setJorqueraSeries(toModisSnowLineSeries(coverage.jorquera ?? []));
        setPulidoSeries(toModisSnowLineSeries(coverage.pulido ?? []));
        setManflasSeries(toModisSnowLineSeries(coverage.manflas ?? []));
        setCoverageStatus("ready");
      })
      .catch(() => {
        if (isMounted) {
          setCoverageStatus("error");
        }
      });

    fetchModisSnowLatestImage(authIdToken)
      .then((image) => {
        objectUrl = image.objectUrl;
        if (!isMounted) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        setLatestSnowImage((previous) => {
          if (previous.url) {
            URL.revokeObjectURL(previous.url);
          }
          return { date: image.imageDate, url: image.objectUrl };
        });
        setImageStatus("ready");
      })
      .catch(() => {
        if (isMounted) {
          setLatestSnowImage((previous) => {
            if (previous.url) {
              URL.revokeObjectURL(previous.url);
            }
            return { date: null, url: null };
          });
          setImageStatus("error");
        }
      });

    fetchModisSnowBasinsGeoJson(authIdToken)
      .then((geojson) => {
        if (isMounted) {
          setBasinsGeoJson(geojson);
          setBasinsStatus("ready");
        }
      })
      .catch(() => {
        if (isMounted) {
          setBasinsGeoJson(null);
          setBasinsStatus("error");
        }
      });

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [authIdToken, isLoggedIn]);

  const snowChartLabelEvery = Math.max(
    1,
    Math.ceil((overviewSeries[0]?.points.length ?? 0) / 8),
  );
  const latestImageSubtitle = latestSnowImage.date
    ? `Última imagen disponible (${latestSnowImage.date})`
    : "Última imagen disponible";
  const showSnowCharts = !isLoggedIn || coverageStatus === "ready";
  const snowChartsTone = coverageStatus === "error" ? "error" : "loading";
  const imageTone = imageStatus === "error" ? "error" : "loading";
  const basinsTone = basinsStatus === "error" ? "error" : "loading";

  return (
    <div className="view-stack">
      <div className="view-intro">
        <h2>Sistema de Monitoreo de Cobertura Nival</h2>
      </div>

      <div className="snow-subnav" role="tablist" aria-label="Secciones de nieve">
        <button
          type="button"
          role="tab"
          aria-selected={activeSnowTab === "coverage"}
          className={activeSnowTab === "coverage" ? "is-active" : ""}
          onClick={() => setActiveSnowTab("coverage")}
        >
          Cobertura MODIS
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSnowTab === "balance"}
          className={activeSnowTab === "balance" ? "is-active" : ""}
          onClick={() => setActiveSnowTab("balance")}
        >
          Balance de Masas
        </button>
      </div>

      {activeSnowTab === "coverage" && (
        <div className="snow-grid">
          <Panel title="Cobertura nival" subtitle={latestImageSubtitle}>
            <div className="snow-copy">
              <p>
                La imagen de cobertura nival muestra la presencia o ausencia de nieve
                en la cuenca para una fecha dada.
              </p>
              <p>
                La vista usa la imagen MODIS publicada y las series de evolución anual
                por cuenca disponibles en el servicio.
              </p>
            </div>

            <div className="snow-image-card">
              {latestSnowImage.url ? (
                <div className="snow-latest-image-shell">
                  <img
                    alt="Cobertura nival MODIS"
                    className="snow-latest-image"
                    src={latestSnowImage.url}
                  />
                  {latestSnowImage.date && (
                    <span className="snow-latest-image-date">
                      {latestSnowImage.date}
                    </span>
                  )}
                </div>
              ) : isLoggedIn && imageStatus !== "ready" && basinsStatus !== "ready" ? (
                <RemoteDataState
                  className="is-snow-image"
                  title={
                    imageTone === "error" || basinsTone === "error"
                      ? "Imagen MODIS no disponible"
                      : "Cargando imagen MODIS"
                  }
                  message={
                    imageTone === "error" || basinsTone === "error"
                      ? "No se pudo obtener la imagen o la geometría real desde GCP."
                      : "Esperando la imagen real publicada por el servicio."
                  }
                  tone={imageTone === "error" || basinsTone === "error" ? "error" : "loading"}
                />
              ) : (
                <SnowCoverageMap
                  featureCollection={isLoggedIn ? basinsGeoJson : undefined}
                />
              )}
            </div>
          </Panel>

          <div className="snow-charts">
            <div className="snow-description">
              <h3>Gráficas de evolución diaria de FSCA.</h3>
              <p>
                Los gráficos de evolución diaria de cobertura de nieve (FSCA)
                muestran el porcentaje del área de estudio y de cada cuenca que
                está cubierta con nieve durante los días correspondientes al período
                húmedo (abril-septiembre) del año actual y el anterior.
              </p>
            </div>

            <Panel title="Evolución diaria de la cobertura de nieve en el área de estudio (%)">
              {showSnowCharts ? (
                <SimpleLineChart
                  labelEvery={snowChartLabelEvery}
                  maxValue={100}
                  minValue={0}
                  series={overviewSeries}
                  unit="Cobertura (%)"
                  xLabelAngle={-32}
                />
              ) : (
                <RemoteDataState
                  className="is-chart"
                  title={
                    snowChartsTone === "error"
                      ? "Cobertura no disponible"
                      : "Cargando cobertura"
                  }
                  message={
                    snowChartsTone === "error"
                      ? "El servicio no respondió con la serie real de cobertura."
                      : "Consultando serie real de cobertura MODIS."
                  }
                  tone={snowChartsTone}
                />
              )}
            </Panel>

            <Panel title="Evolución diaria de FSCA de la cuenca de Jorquera">
              {showSnowCharts ? (
                <SimpleLineChart
                  labelEvery={snowChartLabelEvery}
                  maxValue={100}
                  minValue={0}
                  series={jorqueraSeries}
                  unit="Cobertura (%)"
                  xLabelAngle={-32}
                />
              ) : (
                <RemoteDataState
                  className="is-chart"
                  title={
                    snowChartsTone === "error"
                      ? "Jorquera no disponible"
                      : "Cargando Jorquera"
                  }
                  message={
                    snowChartsTone === "error"
                      ? "El servicio no respondió con la serie real de Jorquera."
                      : "Esperando datos reales de FSCA para Jorquera."
                  }
                  tone={snowChartsTone}
                />
              )}
            </Panel>

            <Panel title="Evolución diaria de FSCA de la cuenca de Pulido">
              {showSnowCharts ? (
                <SimpleLineChart
                  labelEvery={snowChartLabelEvery}
                  maxValue={100}
                  minValue={0}
                  series={pulidoSeries}
                  unit="Cobertura (%)"
                  xLabelAngle={-32}
                />
              ) : (
                <RemoteDataState
                  className="is-chart"
                  title={
                    snowChartsTone === "error"
                      ? "Pulido no disponible"
                      : "Cargando Pulido"
                  }
                  message={
                    snowChartsTone === "error"
                      ? "El servicio no respondió con la serie real de Pulido."
                      : "Esperando datos reales de FSCA para Pulido."
                  }
                  tone={snowChartsTone}
                />
              )}
            </Panel>

            <Panel title="Evolución diaria de FSCA de la cuenca de Manflas">
              {showSnowCharts ? (
                <SimpleLineChart
                  labelEvery={snowChartLabelEvery}
                  maxValue={100}
                  minValue={0}
                  series={manflasSeries}
                  unit="Cobertura (%)"
                  xLabelAngle={-32}
                />
              ) : (
                <RemoteDataState
                  className="is-chart"
                  title={
                    snowChartsTone === "error"
                      ? "Manflas no disponible"
                      : "Cargando Manflas"
                  }
                  message={
                    snowChartsTone === "error"
                      ? "El servicio no respondió con la serie real de Manflas."
                      : "Esperando datos reales de FSCA para Manflas."
                  }
                  tone={snowChartsTone}
                />
              )}
            </Panel>
          </div>
        </div>
      )}

      {activeSnowTab === "balance" && (
        <div className="snow-balance-stack">
          <div className="snow-description">
            <h3>Balance de masa de nieve</h3>
            <p>
              Estimación del derretimiento, transporte y pérdidas durante la
              temporada húmeda. Cada cuenca permite seleccionar un año histórico
              y revisar intervalos de confianza (95%) en mm equivalentes de agua en nieve (SWE).
            </p>
          </div>

          <div className="snow-balance-global-controls">
            <label htmlFor="snow-balance-year-global">Año</label>
            <select
              id="snow-balance-year-global"
              value={selectedBalanceYear}
              onChange={(event) => setSelectedBalanceYear(Number(event.target.value))}
            >
              {availableBalanceYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="snow-balance-grid">
            {snowBalanceBasins.map((basin) => {
              const record = getSnowBalanceRecord(basin, selectedBalanceYear);
              const rows = getSnowBalanceDisplayRows(record);

              return (
                <Panel
                  key={basin}
                  title={`Balance de la cuenca del río ${snowBalanceBasinLabels[basin]}`}
                  subtitle={`Intervalos de confianza (95%) · Año ${selectedBalanceYear}`}
                >
                  <div className="snow-balance-chart-layout">
                    <div className="snow-balance-donut">
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={rows}
                            dataKey="value"
                            nameKey="label"
                            innerRadius={52}
                            outerRadius={84}
                            paddingAngle={2}
                            cx="50%"
                            cy="50%"
                          >
                            {rows.map((row) => (
                              <Cell key={`${basin}-${row.componentId}`} fill={row.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            formatter={(value, label) => [
                              `${Number(value ?? 0).toFixed(2)} mm`,
                              String(label ?? ""),
                            ]}
                            contentStyle={{
                              background: "#fff",
                              border: "1px solid hsl(210 18% 86%)",
                              borderRadius: "8px",
                              boxShadow: "0 8px 16px rgba(16, 44, 92, 0.12)",
                              fontSize: "11px",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="snow-balance-legend">
                      {rows.map((row) => (
                        <div key={`${basin}-legend-${row.componentId}`} className="snow-balance-legend-row">
                          <span className="snow-balance-legend-main">
                            <i
                              className="snow-balance-dot"
                              style={{ backgroundColor: row.color }}
                            />
                            {row.label}
                          </span>
                          <strong>{row.percent.toFixed(1)}%</strong>
                        </div>
                      ))}
                      <p className="snow-balance-total">
                        Total estimado: <strong>{record.total.toFixed(2)} mm SWE</strong>
                      </p>
                    </div>
                  </div>

                  <div className="snow-balance-table-wrap">
                    <table className="snow-balance-table">
                      <thead>
                        <tr>
                          <th>Componente</th>
                          <th>Máximo (mm)</th>
                          <th>Mínimo (mm)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={`${basin}-row-${row.componentId}`}>
                            <td>{row.label}</td>
                            <td>{row.max.toFixed(2)}</td>
                            <td>{row.min.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewView({
  cards,
  etrErrorMessage,
  etrSeries,
  meteoErrorMessage,
  meteoStatus,
  onOpenView,
  snowErrorMessage,
  snowSeries,
  stations,
  wellsErrorMessage,
  wellsStatus,
  wells,
}: {
  cards: ReturnType<typeof computeOverviewCards>;
  etrErrorMessage: string | null;
  etrSeries: LineSeries[];
  meteoErrorMessage: string | null;
  meteoStatus: RemoteLoadStatus;
  onOpenView: (viewId: Exclude<ViewId, "overview">) => void;
  snowErrorMessage: string | null;
  snowSeries: LineSeries[];
  stations: MeteoStationPoint[];
  wellsErrorMessage: string | null;
  wellsStatus: RemoteLoadStatus;
  wells: WellMapPoint[];
}) {
  const etrMiniLines = etrSeries.map((line) => ({
    color: line.color,
    label: line.label,
    values: line.points.slice(-12).map((point) => point.value),
  }));
  const etrMiniLabels = etrSeries[0]?.points
    .slice(-12)
    .map((point) => point.label) ?? [];

  const snowMiniLines = snowSeries.map((line) => ({
    color: line.color,
    label: line.label,
    values: line.points.map((point) => point.value),
  }));
  const snowMiniLabels = snowSeries[0]?.points.map((point) => point.label) ?? [];

  const recentWells = [...wells]
    .sort((a, b) => new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime())
    .slice(0, 4)
    .map((well) => ({
      id: well.id,
      name: well.name.replace("Pozo ", ""),
      level: getCurrentValue(well.levelSeries),
      dailyChange: getDailyChangeValue(well.levelSeries),
      status: well.status,
    }));

  const meteoSnapshot = [...stations]
    .sort((a, b) => new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime())
    .slice(0, 3)
    .map((station) => ({
      id: station.id,
      name: station.name.replace("Estación ", ""),
      humidity: station.humidityValue,
      status: station.status,
      temperature: station.temperatureValue,
    }));

  return (
    <div className="view-stack">
      <div className="view-intro">
        <h2>Resumen operativo</h2>
        <p>Acceso rápido a ET-LAT, MODIS-Snow, Pozos y Meteo.</p>
      </div>
      <div className="overview-grid">
        {cards.map((card) => {
          const isNetworkCard = card.targetView === "wells" || card.targetView === "meteo";
          const wellsHasNoData = card.targetView === "wells" && wells.length === 0;
          const wellsIsLoading = wellsHasNoData && wellsStatus === "loading";
          const meteoHasNoData = card.targetView === "meteo" && stations.length === 0;
          const meteoIsLoading = meteoHasNoData && meteoStatus === "loading";
          const cardStatusLabel = isNetworkCard
            ? card.status === "stale"
              ? "Red con alertas"
              : card.status === "warning"
                ? "Red en seguimiento"
                : "Red estable"
            : card.targetView === "etr"
              ? etrFreshnessLabelMap[card.status]
            : productFreshnessLabelMap[card.status];

          const cardSecondaryKpi =
            card.targetView === "wells"
              ? wellsIsLoading
                ? "Cargando datos reales"
                : wellsHasNoData
                  ? wellsErrorMessage ?? "Sin datos disponibles"
                  : `${wells.length} pozos monitoreados`
              : card.targetView === "meteo"
                ? meteoIsLoading
                  ? "Cargando datos reales"
                  : meteoHasNoData
                    ? meteoErrorMessage ?? "Sin datos disponibles"
                    : `${stations.length} estaciones monitoreadas`
                : card.targetView === "etr" && etrErrorMessage
                  ? etrErrorMessage
                  : card.targetView === "snow" && snowErrorMessage
                    ? snowErrorMessage
                : card.secondaryKpi;
          const cardPrimaryKpi =
            card.targetView === "wells" && wellsHasNoData
              ? wellsIsLoading
                ? "Pozos Cargando..."
                : "Pozos Sin datos"
            : card.targetView === "meteo" && meteoHasNoData
              ? meteoIsLoading
                ? "Temp media red Cargando..."
                : "Temp media red Sin datos"
              : card.primaryKpi;
          return (
            <button
              key={card.id}
              type="button"
              className="overview-card"
              onClick={() => onOpenView(card.targetView)}
            >
              <div className="overview-card-header">
                <h3>{card.title}</h3>
                <span className={`status-pill ${freshnessClassMap[card.status]}`}>
                  {cardStatusLabel}
                </span>
              </div>
              <strong>{cardPrimaryKpi}</strong>
              <p>{cardSecondaryKpi}</p>
              {card.targetView === "etr" && (
                <OverviewMiniLine labels={etrMiniLabels} lines={etrMiniLines} unit="mm" />
              )}
              {card.targetView === "snow" && (
                <OverviewMiniLine labels={snowMiniLabels} lines={snowMiniLines} unit="%" />
              )}
              {card.targetView === "wells" && (
                <div className="overview-mini-table">
                  <div className="overview-mini-table-head">
                    <span>Pozo</span>
                    <span>Nivel</span>
                    <span>Cambio</span>
                    <span>Estado</span>
                  </div>
                  {recentWells.map((well) => (
                    <div key={well.id} className="overview-mini-table-row">
                      <span className="overview-mini-name">{well.name}</span>
                      <span>{well.level.toFixed(2)} m</span>
                      <span className={`overview-mini-delta ${well.dailyChange >= 0 ? "is-up" : "is-down"}`}>
                        {well.dailyChange >= 0 ? "+" : ""}
                        {well.dailyChange.toFixed(2)} m
                      </span>
                      <span className={`overview-mini-status ${well.status}`}>
                        {freshnessCompactLabelMap[well.status]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {card.targetView === "meteo" && !meteoHasNoData && (
                <div className="overview-mini-table">
                  <div className="overview-mini-table-head">
                    <span>Estación</span>
                    <span>Temp</span>
                    <span>HR</span>
                    <span>Estado</span>
                  </div>
                  {meteoSnapshot.map((station) => (
                    <div key={station.id} className="overview-mini-table-row">
                      <span className="overview-mini-name">{station.name}</span>
                      <span>{station.temperature.toFixed(1)}°C</span>
                      <span>{station.humidity.toFixed(0)}%</span>
                      <span className={`overview-mini-status ${station.status}`}>
                        {freshnessCompactLabelMap[station.status]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <small>Última actualización: {formatDateTime(card.lastUpdate)}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WellsView({
  authIdToken,
  canAddMeasurements,
  canCreateWells,
  canManageAccess,
  currentUserUid,
  errorMessage,
  isLoggedIn,
  manualEntries,
  manualForm,
  now,
  onManualChange,
  onManualSubmit,
  onWellRegistryChange,
  onWellRegistrySubmit,
  onWellMeasurementChange,
  onWellMeasurementCsvUpload,
  onWellMeasurementSubmit,
  onSelectWell,
  selectedWellId,
  status,
  wellMeasurementCsvMessage,
  wellMeasurementForm,
  wellMeasurementMessage,
  wellMeasurementStatus,
  wellRegistryEntries,
  wellRegistryForm,
  wellRegistryMessage,
  wellRegistryStatus,
  wells,
}: {
  authIdToken: string | null;
  canAddMeasurements: boolean;
  canCreateWells: boolean;
  canManageAccess: boolean;
  currentUserUid: string | null;
  errorMessage: string | null;
  isLoggedIn: boolean;
  manualEntries: ManualWellEntry[];
  manualForm: ManualFormState;
  now: Date;
  onManualChange: (next: Partial<ManualFormState>) => void;
  onManualSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onWellRegistryChange: (next: Partial<WellRegistryFormState>) => void;
  onWellRegistrySubmit: (event: FormEvent<HTMLFormElement>) => void;
  onWellMeasurementChange: (next: Partial<WellMeasurementFormState>) => void;
  onWellMeasurementCsvUpload: (file: File) => void;
  onWellMeasurementSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSelectWell: (wellId: string) => void;
  selectedWellId: string;
  status: RemoteLoadStatus;
  wellMeasurementCsvMessage: string | null;
  wellMeasurementForm: WellMeasurementFormState;
  wellMeasurementMessage: string | null;
  wellMeasurementStatus: RemoteLoadStatus;
  wellRegistryEntries: WellRegistryEntry[];
  wellRegistryForm: WellRegistryFormState;
  wellRegistryMessage: string | null;
  wellRegistryStatus: RemoteLoadStatus;
  wells: WellMapPoint[];
}) {
  const [activeWellsTab, setActiveWellsTab] =
    useState<"monitoring" | "measurement" | "admin">("monitoring");
  const canUseMeasurementForm = canAddMeasurements && wellRegistryEntries.length > 0;
  const waterByWell = useMemo(
    () => new Map(waterQualityRecords.map((record) => [record.wellId, record])),
    [],
  );

  useEffect(() => {
    if (
      (activeWellsTab === "admin" && !canCreateWells) ||
      (activeWellsTab === "measurement" && !canUseMeasurementForm)
    ) {
      setActiveWellsTab("monitoring");
    }
  }, [activeWellsTab, canCreateWells, canUseMeasurementForm]);

  const wellsSubnav = canCreateWells || canUseMeasurementForm ? (
    <div className="snow-subnav" role="tablist" aria-label="Secciones de pozos">
      <button
        type="button"
        role="tab"
        aria-selected={activeWellsTab === "monitoring"}
        className={activeWellsTab === "monitoring" ? "is-active" : ""}
        onClick={() => setActiveWellsTab("monitoring")}
      >
        Monitoreo de pozos
      </button>
      {canUseMeasurementForm && (
        <button
          type="button"
          role="tab"
          aria-selected={activeWellsTab === "measurement"}
          className={activeWellsTab === "measurement" ? "is-active" : ""}
          onClick={() => setActiveWellsTab("measurement")}
        >
          Agregar medicion
        </button>
      )}
      {canCreateWells && (
        <button
          type="button"
          role="tab"
          aria-selected={activeWellsTab === "admin"}
          className={activeWellsTab === "admin" ? "is-active" : ""}
          onClick={() => setActiveWellsTab("admin")}
        >
          Administracion de pozos
        </button>
      )}
    </div>
  ) : null;

  if (canCreateWells && activeWellsTab === "admin") {
    return (
      <div className="view-stack">
        <div className="view-intro">
          <h2>Pozos y calidad de agua</h2>
          <p>
            Mapa operativo con estado por frescura de dato, fuente de captura y panel
            de detalle por pozo.
          </p>
        </div>

        {wellsSubnav}

        <WellRegistryAdminPanel
          authIdToken={authIdToken}
          canManageAccess={canManageAccess}
          currentUserUid={currentUserUid}
          entries={wellRegistryEntries}
          form={wellRegistryForm}
          message={wellRegistryMessage}
          onChange={onWellRegistryChange}
          onSubmit={onWellRegistrySubmit}
          status={wellRegistryStatus}
        />
      </div>
    );
  }

  if (canUseMeasurementForm && activeWellsTab === "measurement") {
    return (
      <div className="view-stack">
        <div className="view-intro">
          <h2>Pozos y calidad de agua</h2>
          <p>
            Mapa operativo con estado por frescura de dato, fuente de captura y panel
            de detalle por pozo.
          </p>
        </div>

        {wellsSubnav}

        <WellMeasurementIngestPanel
          csvMessage={wellMeasurementCsvMessage}
          entries={wellRegistryEntries}
          form={wellMeasurementForm}
          message={wellMeasurementMessage}
          onChange={onWellMeasurementChange}
          onCsvUpload={onWellMeasurementCsvUpload}
          onSubmit={onWellMeasurementSubmit}
          status={wellMeasurementStatus}
        />
      </div>
    );
  }

  if (isLoggedIn && (status === "loading" || status === "error" || wells.length === 0)) {
    const isLoading = status === "loading";

    return (
      <div className="view-stack">
        <div className="view-intro">
          <h2>Pozos y calidad de agua</h2>
          <p>
            Mapa operativo con estado por frescura de dato, fuente de captura y panel
            de detalle por pozo.
          </p>
        </div>

        {wellsSubnav}

        <Panel
          title={isLoading ? "Cargando pozos" : "Pozos sin datos"}
          subtitle="Lectura de mediciones subterraneas desde la API"
        >
          <RemoteDataState
            message={
              isLoading
                ? "Consultando datos reales de pozos."
                : errorMessage ?? "La API no entrego pozos disponibles para este usuario."
            }
            title={isLoading ? "Cargando datos reales" : "Sin datos disponibles"}
            tone={isLoading ? "loading" : "error"}
          />
        </Panel>
      </div>
    );
  }

  if (wells.length === 0) {
    return (
      <div className="view-stack">
        <div className="view-intro">
          <h2>Pozos y calidad de agua</h2>
          <p>No hay pozos disponibles.</p>
        </div>
      </div>
    );
  }

  const selectedWell = wells.find((well) => well.id === selectedWellId) ?? wells[0];
  const selectedQuality = waterByWell.get(selectedWell.id);
  const wellRows = wells.map((well) => ({
    ...well,
    currentLevel: getCurrentValue(well.levelSeries),
    dailyChange: getDailyChangeValue(well.levelSeries),
    range: getRangeValue(well.levelSeries),
    qualityStatus: waterByWell.get(well.id)?.qualityStatus,
  }));
  const wellsFreshCount = wells.filter((well) => well.status !== "stale").length;
  const wellsStaleCount = wells.filter((well) => well.status === "stale").length;
  const manualWells = wells.filter((well) => well.sourceType === "manual").length;
  const waterAlerts = waterQualityRecords.filter((record) => record.qualityStatus === "alert").length;
  const maxUpdate = wells.reduce((latest, well) => {
    if (!latest) {
      return well.lastUpdate;
    }

    return new Date(well.lastUpdate).getTime() > new Date(latest).getTime()
      ? well.lastUpdate
      : latest;
  }, "");
  const seriesValues = selectedWell.levelSeries.map((point) => point.value);
  const minSeriesValue = seriesValues.length > 0 ? Math.min(...seriesValues) - 0.1 : -0.1;
  const maxSeriesValue = seriesValues.length > 0 ? Math.max(...seriesValues) + 0.1 : 0.1;

  return (
    <div className="view-stack">
      <div className="view-intro">
        <h2>Pozos y calidad de agua</h2>
          <p>
            Mapa operativo con estado por frescura de dato, fuente de captura y panel
            de detalle por pozo.
          </p>
        </div>

        {wellsSubnav}

      <div className="stat-grid">
        <KpiCard
          delayMs={0}
          icon={Waves}
          title="Pozos al día"
          value={`${wellsFreshCount}/${wells.length}`}
          note={`${wellsStaleCount} sin reporte en las últimas 48 h`}
          noteTone={wellsStaleCount > 0 ? "negative" : "positive"}
        />
        <KpiCard
          delayMs={80}
          icon={Radio}
          title="Pozos con carga manual"
          value={String(manualWells)}
          note="Lecturas diarias desde mobile/tablet"
          noteTone="neutral"
        />
        <KpiCard
          delayMs={160}
          icon={Droplets}
          title="Calidad en alerta"
          value={String(waterAlerts)}
          note="Muestras de calidad de agua fuera de rango"
          noteTone={waterAlerts > 0 ? "negative" : "positive"}
        />
        <KpiCard
          delayMs={240}
          icon={Gauge}
          title="Última sincronización global"
          value={formatDateTime(maxUpdate)}
          note={formatRelativeAge(maxUpdate, now)}
          noteTone="neutral"
        />
      </div>

      <div className="map-detail-grid">
        <Panel
          title="Mapa de pozos (Copiapó)"
          subtitle="Semáforo de frescura: verde <24 h · amarillo 24-48 h · rojo >48 h"
        >
          <StatusLeafletMap
            points={wellRows.map((well) => ({
              id: well.id,
              name: well.name,
              lat: well.lat,
              lng: well.lng,
              status: well.status,
              sourceType: well.sourceType,
              lastUpdate: well.lastUpdate,
              qualityStatus: well.qualityStatus,
            }))}
            selectedPointId={selectedWellId}
            onSelect={onSelectWell}
          />
          <div className="map-legend">
            <span><i className="legend-dot fresh" /> Actualizado &lt; 24 h</span>
            <span><i className="legend-dot warning" /> Actualizado 24-48 h</span>
            <span><i className="legend-dot stale" /> Sin reporte &gt; 48 h</span>
            <span><i className="legend-dot quality-alert" /> Urgencia calidad de agua</span>
          </div>
        </Panel>

        <Panel
          title={`Detalle: ${selectedWell.name}`}
          subtitle={`${selectedWell.provider} · ${selectedWell.aquiferSector}`}
        >
          <div className="detail-kpi-grid">
            <article className="detail-kpi">
              <span>Nivel actual</span>
              <strong>{getCurrentValue(selectedWell.levelSeries).toFixed(2)} m</strong>
            </article>
            <article className="detail-kpi">
              <span>Cambio diario</span>
              <strong>
                {getDailyChangeValue(selectedWell.levelSeries) >= 0 ? "+" : ""}
                {getDailyChangeValue(selectedWell.levelSeries).toFixed(2)} m
              </strong>
            </article>
            <article className="detail-kpi">
              <span>Rango del período</span>
              <strong>{getRangeValue(selectedWell.levelSeries).toFixed(2)} m</strong>
            </article>
          </div>

          <div className="status-row">
            <span className={`status-pill ${freshnessClassMap[selectedWell.status]}`}>
              {freshnessLabelMap[selectedWell.status]}
            </span>
            <span className="status-pill is-neutral">
              Fuente: {sourceLabelMap[selectedWell.sourceType]}
            </span>
            <span className="status-pill is-neutral">
              {formatRelativeAge(selectedWell.lastUpdate, now)}
            </span>
          </div>

          {selectedQuality && (
            <div className="quality-box">
              <div className="quality-head">
                <strong>Calidad de agua</strong>
                <span className={`status-pill ${qualityClassMap[selectedQuality.qualityStatus]}`}>
                  {qualityLabelMap[selectedQuality.qualityStatus]}
                </span>
              </div>
              <div className="quality-grid">
                <span>Última muestra: {selectedQuality.lastSampleDate}</span>
                <span>CE: {selectedQuality.conductivity.toFixed(1)} dS/m</span>
                <span>pH: {selectedQuality.pH.toFixed(1)}</span>
                <span>Turbidez: {selectedQuality.turbidity.toFixed(1)} NTU</span>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <div className="detail-grid">
        <Panel
          title="Comparación rápida de pozos"
          subtitle="Seleccione un pozo para ver su serie y detalle"
        >
          <div className="comparison-list">
            {wellRows.map((well) => (
              <button
                key={well.id}
                type="button"
                className={`comparison-row ${selectedWellId === well.id ? "is-selected" : ""}`}
                onClick={() => onSelectWell(well.id)}
              >
                <div className="comparison-main">
                  <strong>{well.name}</strong>
                  <span>{well.provider}</span>
                </div>
                <div className="comparison-metrics">
                  <div>
                    <span>Nivel</span>
                    <strong>{well.currentLevel.toFixed(2)} m</strong>
                  </div>
                  <div>
                    <span>Cambio diario</span>
                    <strong>
                      {well.dailyChange >= 0 ? "+" : ""}
                      {well.dailyChange.toFixed(2)} m
                    </strong>
                  </div>
                </div>
                <MiniSparkline
                  points={well.levelSeries.map((point) => point.value)}
                  color={chartPalette.chart6}
                />
                <span className={`status-pill ${freshnessClassMap[well.status]}`}>
                  {freshnessLabelMap[well.status]}
                </span>
              </button>
            ))}
          </div>
        </Panel>

        {false && (
          <Panel
            title="Carga manual diaria (mobile/tablet)"
            subtitle="Solo para pozos sin telemetría"
          >
          {/*
            <form className="manual-entry-form" onSubmit={onManualSubmit}>
              <label>
                <span>Pozo</span>
                <select
                  value={manualForm.wellId}
                  onChange={(event) => onManualChange({ wellId: event.target.value })}
                >
                  {wells
                    .filter((well) => well.sourceType === "manual")
                    .map((well) => (
                      <option key={well.id} value={well.id}>
                        {well.name}
                      </option>
                    ))}
                </select>
              </label>

              <div className="manual-two-col">
                <label>
                  <span>Fecha</span>
                  <input
                    type="date"
                    value={manualForm.date}
                    onChange={(event) => onManualChange({ date: event.target.value })}
                  />
                </label>
                <label>
                  <span>Hora</span>
                  <input
                    type="time"
                    value={manualForm.time}
                    onChange={(event) => onManualChange({ time: event.target.value })}
                  />
                </label>
              </div>

              <label>
                <span>Nivel (m)</span>
                <input
                  type="number"
                  step="0.01"
                  value={manualForm.level}
                  placeholder="Ej: 3.74"
                  onChange={(event) => onManualChange({ level: event.target.value })}
                  required
                />
              </label>

              <label>
                <span>Operador</span>
                <input
                  type="text"
                  value={manualForm.operator}
                  onChange={(event) => onManualChange({ operator: event.target.value })}
                  required
                />
              </label>

              <label>
                <span>Observación corta</span>
                <input
                  type="text"
                  value={manualForm.note}
                  onChange={(event) => onManualChange({ note: event.target.value })}
                />
              </label>

              <div className="manual-source-pill">Origen: mobile/tablet</div>
              <button type="submit">Guardar registro manual</button>
            </form>
          */}

          <div className="manual-history">
            <h4>Últimas cargas</h4>
            {manualEntries.length === 0 && <p>No hay cargas manuales en esta sesión.</p>}
            {manualEntries.slice(0, 4).map((entry) => {
              const wellName = wells.find((well) => well.id === entry.wellId)?.name ?? entry.wellId;
              return (
                <div key={entry.id} className="manual-history-row">
                  <strong>{wellName}</strong>
                  <span>{entry.date} {entry.time}</span>
                  <span>{entry.level.toFixed(2)} m</span>
                </div>
              );
            })}
          </div>
          </Panel>
        )}
      </div>

      <Panel
        title={`Variación temporal: ${selectedWell.name}`}
        subtitle={`Cambio diario ${getDailyChangeValue(selectedWell.levelSeries) >= 0 ? "+" : ""}${getDailyChangeValue(selectedWell.levelSeries).toFixed(2)} m`}
      >
        <SimpleLineChart
          labelEvery={1}
          maxValue={maxSeriesValue}
          minValue={minSeriesValue}
          mode="linear"
          series={[
            {
              label: selectedWell.name,
              color: chartPalette.chart6,
              points: selectedWell.levelSeries,
            },
          ]}
          unit="m"
          xLabelAngle={-40}
        />
      </Panel>
    </div>
  );
}

function MeteoView({
  errorMessage,
  isLoggedIn,
  now,
  onSelectStation,
  selectedStationId,
  stations,
  status,
}: {
  errorMessage: string | null;
  isLoggedIn: boolean;
  now: Date;
  onSelectStation: (stationId: string) => void;
  selectedStationId: string;
  stations: typeof meteoStationPoints;
  status: RemoteLoadStatus;
}) {
  if (isLoggedIn && (status === "loading" || status === "error" || stations.length === 0)) {
    const isLoading = status === "loading";

    return (
      <div className="view-stack">
        <div className="view-intro">
          <h2>Estaciones meteorolÃ³gicas</h2>
          <p>Tres estaciones con datos individuales y estado de actualizaciÃ³n por punto.</p>
        </div>

        <Panel
          title={isLoading ? "Cargando estaciones" : "Meteo sin datos"}
          subtitle="Lectura del snapshot meteorologico"
        >
          <RemoteDataState
            message={
              isLoading
                ? "Consultando datos reales de estaciones meteorologicas."
                : errorMessage ?? "La API no entrego estaciones meteorologicas disponibles."
            }
            title={isLoading ? "Cargando datos reales" : "Sin datos disponibles"}
            tone={isLoading ? "loading" : "error"}
          />
        </Panel>
      </div>
    );
  }

  const selectedStation = stations.find((station) => station.id === selectedStationId) ?? stations[0];

  return (
    <div className="view-stack">
      <div className="view-intro">
        <h2>Estaciones meteorológicas</h2>
        <p>Tres estaciones con datos individuales y estado de actualización por punto.</p>
      </div>

      {/*
      <div className="stat-grid">
        <KpiCard
          delayMs={0}
          icon={Gauge}
          title="Estaciones al día"
          value={`${stations.filter((station) => station.status !== "stale").length}/3`}
          note={`${stations.filter((station) => station.status === "stale").length} sin reporte en las últimas 48 h`}
          noteTone={stations.some((station) => station.status === "stale") ? "negative" : "positive"}
        />
        <KpiCard
          delayMs={80}
          icon={Gauge}
          title="Última sincronización global"
          value={formatDateTime(
            stations.reduce((latest, station) => {
              if (!latest) {
                return station.lastUpdate;
              }
              return new Date(station.lastUpdate).getTime() > new Date(latest).getTime()
                ? station.lastUpdate
                : latest;
            }, ""),
          )}
          note="Frescura de red meteo"
          noteTone="neutral"
        />
        <KpiCard
          delayMs={160}
          icon={Thermometer}
          title="Temperatura media red"
          value={`${(stations.reduce((total, station) => total + station.temperatureValue, 0) / stations.length).toFixed(1)} °C`}
          note="Promedio simple de las 3 estaciones"
          noteTone="neutral"
        />
      </div>
      */}

      <div className="station-card-grid">
        {stations.map((station) => {
          const weather = getStationWeatherSummary(station);
          const WeatherIcon = weather.icon;

          return (
            <button
              key={station.id}
              type="button"
              className={`station-card ${selectedStationId === station.id ? "is-selected" : ""}`}
              onClick={() => onSelectStation(station.id)}
            >
              <div className="station-card-head">
                <div className="station-card-title">
                  <strong>{station.name}</strong>
                  <span className={`station-weather station-weather--${weather.tone}`}>
                    <WeatherIcon size={14} />
                    {weather.label}
                  </span>
                </div>
                <span className={`status-pill ${freshnessClassMap[station.status]}`}>
                  {freshnessLabelMap[station.status]}
                </span>
              </div>
              <div className="station-card-metrics">
                <span>Temp {station.temperatureValue.toFixed(1)}°C</span>
                <span>HR {station.humidityValue.toFixed(0)}%</span>
                <span>Viento {station.windValue.toFixed(1)} km/h</span>
                <span>Presión {station.pressureValue.toFixed(0)} hPa</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="map-detail-grid">
        <Panel
          title="Mapa de estaciones (Copiapó)"
          subtitle="Semáforo de frescura: verde <24 h · amarillo 24-48 h · rojo >48 h"
        >
          <StatusLeafletMap
            points={stations.map((station) => ({
              id: station.id,
              name: station.name,
              lat: station.lat,
              lng: station.lng,
              status: station.status,
              sourceType: station.sourceType,
              lastUpdate: station.lastUpdate,
            }))}
            selectedPointId={selectedStationId}
            onSelect={onSelectStation}
          />
          <div className="map-legend">
            <span><i className="legend-dot fresh" /> Actualizado &lt; 24 h</span>
            <span><i className="legend-dot warning" /> Actualizado 24-48 h</span>
            <span><i className="legend-dot stale" /> Sin reporte &gt; 48 h</span>
          </div>
        </Panel>

        <Panel title={selectedStation.name} subtitle={`${formatRelativeAge(selectedStation.lastUpdate, now)} · ${formatDateTime(selectedStation.lastUpdate)}`}>
          <div className="detail-kpi-grid">
            <article className="detail-kpi">
              <span>Temperatura</span>
              <strong>{selectedStation.temperatureValue.toFixed(1)}°C</strong>
            </article>
            <article className="detail-kpi">
              <span>Humedad</span>
              <strong>{selectedStation.humidityValue.toFixed(0)}%</strong>
            </article>
            <article className="detail-kpi">
              <span>Viento</span>
              <strong>{selectedStation.windValue.toFixed(1)} km/h</strong>
            </article>
            <article className="detail-kpi">
              <span>Presión</span>
              <strong>{selectedStation.pressureValue.toFixed(0)} hPa</strong>
            </article>
          </div>

          <div className="status-row">
            <span className={`status-pill ${freshnessClassMap[selectedStation.status]}`}>
              {freshnessLabelMap[selectedStation.status]}
            </span>
            <span className="status-pill is-neutral">Fuente: Telemetría</span>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function AdminView({
  authIdToken,
  currentUserUid,
}: {
  authIdToken: string | null;
  currentUserUid: string | null;
}) {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadStatus, setLoadStatus] = useState<RemoteLoadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savingUid, setSavingUid] = useState<string | null>(null);

  const loadAdminData = async () => {
    if (!authIdToken) {
      setLoadStatus("error");
      setErrorMessage("No hay token de sesion disponible.");
      return;
    }

    setLoadStatus("loading");
    setErrorMessage(null);

    try {
      const [nextRoles, nextUsers] = await Promise.all([
        fetchAdminRoles(authIdToken),
        fetchAdminUsers(authIdToken),
      ]);
      setRoles(nextRoles);
      setUsers(nextUsers);
      setLoadStatus("ready");
    } catch {
      setLoadStatus("error");
      setErrorMessage("No fue posible cargar usuarios y roles.");
    }
  };

  useEffect(() => {
    void loadAdminData();
  }, [authIdToken]);

  const handleRoleChange = async (uid: string, role: AdminRole["id"]) => {
    if (!authIdToken) {
      return;
    }
    if (uid === currentUserUid && role !== "general_admin") {
      setErrorMessage("No puedes quitarte el rol General Admin a ti mismo.");
      return;
    }

    setSavingUid(uid);
    setErrorMessage(null);

    try {
      const updated = await updateAdminUserRole(authIdToken, uid, role);
      setUsers((previous) =>
        previous.map((user) =>
          user.uid === uid
            ? { ...user, role: updated.role, permissions: updated.permissions }
            : user,
        ),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No fue posible actualizar el rol del usuario.",
      );
    } finally {
      setSavingUid(null);
    }
  };

  return (
    <div className="view-stack admin-view">
      <div className="view-intro">
        <h2>Administracion de usuarios</h2>
        <p>Roles de acceso para la plataforma.</p>
      </div>

      {loadStatus === "loading" && (
        <RemoteDataState
          title="Cargando usuarios"
          message="Consultando Firebase Auth."
        />
      )}

      {loadStatus === "error" && (
        <RemoteDataState
          title="No fue posible cargar administracion"
          message={errorMessage ?? "Revisa permisos o conexion con la API."}
          tone="error"
        />
      )}

      {loadStatus === "ready" && (
        <>
          <div className="admin-summary-row">
            <article className="admin-summary">
              <span>Usuarios</span>
              <strong>{users.length}</strong>
            </article>
            <article className="admin-summary">
              <span>Admins</span>
              <strong>
                {users.filter((user) => user.permissions.includes("users:manage")).length}
              </strong>
            </article>
          </div>

          {errorMessage ? (
            <div className="admin-inline-error" role="alert">
              {errorMessage}
            </div>
          ) : null}

          <Panel title="Usuarios Firebase" subtitle="Cambio directo de rol por usuario">
            <div className="admin-users-table-wrap">
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Rol</th>
                    <th>Permisos</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.uid} className={user.uid === currentUserUid ? "is-current-user" : ""}>
                      <td>
                        <div className="admin-user-cell">
                          <span className="admin-user-icon">
                            <UserRound size={16} />
                          </span>
                          <div>
                            <strong>{user.displayName || user.email || "Sin nombre"}</strong>
                            <span>{user.email ?? "Sin email"}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="admin-role-control">
                          <select
                            aria-label={`Rol de ${user.email ?? user.uid}`}
                            value={user.role}
                            disabled={savingUid === user.uid || user.uid === currentUserUid}
                            onChange={(event) =>
                              void handleRoleChange(
                                user.uid,
                                event.target.value as AdminRole["id"],
                              )
                            }
                          >
                            {roles.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                          {savingUid === user.uid ? (
                            <span className="admin-saving">
                              <Save size={13} />
                              Guardando
                            </span>
                          ) : null}
                          {user.uid === currentUserUid ? (
                            <span className="admin-current-user">Tu cuenta</span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        {user.permissions.length > 0 ? (
                          <div className="admin-permission-list">
                            {user.permissions.map((permission) => (
                              <span key={permission}>{permission}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="admin-empty-permissions">Sin permisos admin</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

const readStoredAuthFlag = () => {
  if (typeof window === "undefined") {
    return true;
  }

  try {
    const stored = window.localStorage.getItem(authStorageKey);
    if (stored === null) {
      return true;
    }
    return stored === "true";
  } catch {
    return true;
  }
};

const readStoredAuthUserName = () => {
  if (typeof window === "undefined") {
    return defaultAuthUserName;
  }

  try {
    const stored = window.localStorage.getItem(authUserStorageKey);
    if (!stored || stored.trim().length === 0) {
      return defaultAuthUserName;
    }
    return stored;
  } catch {
    return defaultAuthUserName;
  }
};

function LoginView({
  onBack,
  onGoogleLogin,
  onEmailPasswordLogin,
}: {
  onBack: () => void;
  onGoogleLogin: () => Promise<void>;
  onEmailPasswordLogin: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEmailPasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await onEmailPasswordLogin(email, password);
    } catch {
      setErrorMessage("No fue posible iniciar sesión con email y contraseña.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSubmit = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await onGoogleLogin();
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code)
          : null;
      setErrorMessage(
        code
          ? `No fue posible iniciar sesion con Google (${code}).`
          : "No fue posible iniciar sesion con Google.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <div className="site-brand-icon" aria-hidden="true">
            <Droplets size={16} />
          </div>
          <div>
            <h1>Agua con Dato</h1>
            <p>Mockup de acceso para usuarios y administradores.</p>
          </div>
        </div>

        <div className="login-copy">
          <h2>Iniciar sesión</h2>
          <p>
            Acceso con Google o email/contraseña para consultar los snapshots horarios
            publicados desde la plataforma CAS.
          </p>
        </div>

        <form className="login-form" onSubmit={handleEmailPasswordSubmit}>
          <label className="login-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="usuario@ejemplo.com"
              autoComplete="email"
              required
            />
          </label>
          <label className="login-field">
            <span>Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="********"
              autoComplete="current-password"
              required
            />
          </label>
          {errorMessage ? <p className="login-error">{errorMessage}</p> : null}
          <button type="submit" className="login-password-btn" disabled={isSubmitting}>
            {isSubmitting ? "Ingresando..." : "Ingresar con email"}
          </button>
        </form>

        <div className="login-divider" aria-hidden="true">
          <span />
          <strong>o</strong>
          <span />
        </div>

        <button
          type="button"
          className="login-google-btn"
          onClick={handleGoogleSubmit}
          disabled={isSubmitting}
        >
          <span className="login-google-mark" aria-hidden="true">G</span>
          Continuar con Google
        </button>
        <button type="button" className="login-back-btn" onClick={onBack}>
          Volver al dashboard
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const defaultManualWellId =
    wellMapPoints.find((well) => well.sourceType === "manual")?.id ?? wellMapPoints[0].id;
  const [activeView, setActiveView] = useState<ViewId>("overview");
  const [appScreen, setAppScreen] = useState<"dashboard" | "login">("dashboard");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => readStoredAuthFlag());
  const [authUserName, setAuthUserName] = useState<string>(() =>
    readStoredAuthUserName(),
  );
  const [authIdToken, setAuthIdToken] = useState<string | null>(null);
  const [authPermissions, setAuthPermissions] = useState<string[]>([]);
  const [authRole, setAuthRole] = useState("public_user");
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [selectedWellId, setSelectedWellId] = useState(wellMapPoints[0].id);
  const [selectedStationId, setSelectedStationId] = useState(meteoStationPoints[0].id);
  const [manualEntries, setManualEntries] = useState<ManualWellEntry[]>([]);
  const [wellState, setWellState] = useState(wellMapPoints);
  const [stationState, setStationState] = useState<MeteoStationPoint[]>(meteoStationPoints);
  const [meteoStatus, setMeteoStatus] = useState<RemoteLoadStatus>("idle");
  const [meteoErrorMessage, setMeteoErrorMessage] = useState<string | null>(null);
  const [wellsStatus, setWellsStatus] = useState<RemoteLoadStatus>("idle");
  const [wellsErrorMessage, setWellsErrorMessage] = useState<string | null>(null);
  const [wellsCapabilities, setWellsCapabilities] = useState<WellsCapabilities>({
    canAddMeasurements: false,
    canCreateWells: false,
    canDeleteMeasurements: false,
    canManageAccess: false,
    canViewWells: false,
    isAdmin: false,
  });
  const [wellRegistryEntries, setWellRegistryEntries] = useState<WellRegistryEntry[]>([]);
  const [wellRegistryStatus, setWellRegistryStatus] = useState<RemoteLoadStatus>("idle");
  const [wellRegistryMessage, setWellRegistryMessage] = useState<string | null>(null);
  const [wellMeasurementStatus, setWellMeasurementStatus] =
    useState<RemoteLoadStatus>("idle");
  const [wellMeasurementMessage, setWellMeasurementMessage] = useState<string | null>(null);
  const [wellMeasurementCsvMessage, setWellMeasurementCsvMessage] = useState<string | null>(null);
  const [etrOverviewSummary, setEtrOverviewSummary] = useState({
    lastDate: "2025-10-09",
    meanValue: 1.2,
  });
  const [etrErrorMessage, setEtrErrorMessage] = useState<string | null>(null);
  const [etrOverviewSeries, setEtrOverviewSeries] =
    useState<LineSeries[]>(etrOverviewSeasonSeries);
  const [snowOverviewSeriesForSummary, setSnowOverviewSeriesForSummary] =
    useState<LineSeries[]>(snowOverviewSeries);
  const [snowErrorMessage, setSnowErrorMessage] = useState<string | null>(null);
  const [manualForm, setManualForm] = useState<ManualFormState>({
    wellId: defaultManualWellId,
    date: "2026-03-22",
    time: "10:30",
    level: "",
    operator: "Operador CAS",
    note: "",
  });
  const [wellRegistryForm, setWellRegistryForm] = useState<WellRegistryFormState>({
    codigoObra: "",
    name: "",
    lat: "",
    lng: "",
    provider: "",
    centroControlRut: "",
    aquiferSector: "",
  });
  const [wellMeasurementForm, setWellMeasurementForm] = useState<WellMeasurementFormState>({
    codigoObra: "",
    companyRut: "",
    flowRate: "",
    measurementDate: new Date().toISOString().slice(0, 10),
    measurementTime: "10:00",
    totalizer: "",
    userRut: "",
    waterTableDepth: "",
  });
  const canManageUsers = authPermissions.includes("users:manage");
  const hasAuthenticatedApiSession = isLoggedIn && Boolean(authIdToken);
  const availableViews = useMemo(
    () =>
      views.filter(
        (view) =>
          (view.id !== "admin" || canManageUsers) &&
          (view.id !== "wells" || !hasAuthenticatedApiSession || authRole !== "public_user"),
      ),
    [authRole, canManageUsers, hasAuthenticatedApiSession],
  );

  const dashboardNow = useMemo(() => {
    const seed = authIdToken ? Date.now() : new Date(mockNowIso).getTime();
    const manualTimes = manualEntries.map((entry) =>
      new Date(`${entry.date}T${entry.time}:00-03:00`).getTime(),
    );
    return new Date(Math.max(seed, ...manualTimes));
  }, [authIdToken, manualEntries]);

  const wells = useMemo(
    () =>
      wellState.map((well) => ({
        ...well,
        status: getFreshnessStatus(
          well.lastUpdate,
          dashboardNow,
          staleThresholdDaysDefault,
        ),
      })),
    [dashboardNow, wellState],
  );

  const stations = useMemo(
    () =>
      stationState.map((station) => ({
        ...station,
        status: getFreshnessStatus(
          station.lastUpdate,
          dashboardNow,
          staleThresholdDaysDefault,
        ),
      })),
    [dashboardNow, stationState],
  );

  useEffect(() => {
    if (!isFirebaseConfigured) {
      return undefined;
    }

    return subscribeToAuthSession((session) => {
      setIsLoggedIn(session.isLoggedIn);
      setAuthUserName(session.userName);
      setAuthIdToken(session.idToken);
      setAuthPermissions(session.permissions);
      setAuthRole(session.role);
      setAuthUid(session.uid);
    });
  }, []);

  useEffect(() => {
    if (
      (activeView === "admin" && !canManageUsers) ||
      (activeView === "wells" &&
        hasAuthenticatedApiSession &&
        authRole === "public_user")
    ) {
      setActiveView("overview");
    }
  }, [activeView, authRole, canManageUsers, hasAuthenticatedApiSession]);

  useEffect(() => {
    let isMounted = true;

    if (!hasAuthenticatedApiSession) {
      setWellsStatus("idle");
      setWellsErrorMessage(null);
      setWellState(wellMapPoints);
      return () => {
        isMounted = false;
      };
    }

    const idToken = authIdToken;
    if (!idToken) {
      return () => {
        isMounted = false;
      };
    }

    setWellsStatus("loading");
    setWellsErrorMessage(null);
    setWellState([]);

    fetchWellMapPoints(idToken)
      .then((nextWells) => {
        if (isMounted) {
          setWellState(nextWells);
          setWellsStatus(nextWells.length > 0 ? "ready" : "error");
          setWellsErrorMessage(nextWells.length > 0 ? null : "La API respondio sin pozos.");
        }
      })
      .catch((error) => {
        if (isMounted) {
          setWellState([]);
          setWellsStatus("error");
          setWellsErrorMessage(
            toRemoteErrorMessage(error, "No fue posible cargar datos reales de pozos."),
          );
        }
      });

    return () => {
      isMounted = false;
    };
  }, [authIdToken, hasAuthenticatedApiSession]);

  useEffect(() => {
    let isMounted = true;

    if (!hasAuthenticatedApiSession || !authIdToken) {
      setWellsCapabilities({
        canAddMeasurements: false,
        canCreateWells: false,
        canDeleteMeasurements: false,
        canManageAccess: false,
        canViewWells: false,
        isAdmin: false,
      });
      setWellRegistryEntries([]);
      setWellRegistryStatus("idle");
      setWellRegistryMessage(null);
      return () => {
        isMounted = false;
      };
    }

    setWellRegistryStatus("loading");
    setWellRegistryMessage(null);

    fetchWellsAdminStatus(authIdToken)
      .then((capabilities) => {
        if (!isMounted) {
          return;
        }

        setWellsCapabilities(capabilities);
        if (!capabilities.isAdmin) {
          fetchMyWellRegistryEntries(authIdToken)
            .then((entries) => {
              if (isMounted) {
                setWellRegistryEntries(entries);
                setWellRegistryStatus("ready");
              }
            })
            .catch(() => {
              if (isMounted) {
                setWellRegistryEntries([]);
                setWellRegistryStatus("error");
                setWellRegistryMessage("No fue posible cargar tus pozos asignados.");
              }
            });
          return;
        }

        fetchWellRegistryEntries(authIdToken)
          .then((entries) => {
            if (isMounted) {
              setWellRegistryEntries(entries);
              setWellRegistryStatus("ready");
            }
          })
          .catch(() => {
            if (isMounted) {
              setWellRegistryEntries([]);
              setWellRegistryStatus("error");
              setWellRegistryMessage("No fue posible cargar el registry de pozos.");
            }
          });
      })
      .catch(() => {
        if (isMounted) {
          setWellsCapabilities({
            canAddMeasurements: false,
            canCreateWells: false,
            canDeleteMeasurements: false,
            canManageAccess: false,
            canViewWells: false,
            isAdmin: false,
          });
          setWellRegistryEntries([]);
          setWellRegistryStatus("error");
          setWellRegistryMessage("No fue posible verificar permisos admin de pozos.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [authIdToken, hasAuthenticatedApiSession]);

  useEffect(() => {
    let isMounted = true;

    if (!hasAuthenticatedApiSession) {
      setMeteoStatus("idle");
      setMeteoErrorMessage(null);
      setStationState(meteoStationPoints);
      return () => {
        isMounted = false;
      };
    }

    const idToken = authIdToken;
    if (!idToken) {
      return () => {
        isMounted = false;
      };
    }

    setMeteoStatus("loading");
    setMeteoErrorMessage(null);
    setStationState([]);

    fetchWeatherStationPoints(idToken)
      .then((nextStations) => {
        if (isMounted) {
          setStationState(nextStations);
          setMeteoStatus(nextStations.length > 0 ? "ready" : "error");
          setMeteoErrorMessage(
            nextStations.length > 0 ? null : "La API respondio sin estaciones meteorologicas.",
          );
        }
      })
      .catch((error) => {
        if (isMounted) {
          setStationState([]);
          setMeteoStatus("error");
          setMeteoErrorMessage(
            toRemoteErrorMessage(error, "No fue posible cargar datos reales de meteo."),
          );
        }
      });

    return () => {
      isMounted = false;
    };
  }, [authIdToken, hasAuthenticatedApiSession]);

  useEffect(() => {
    let isMounted = true;

    if (!hasAuthenticatedApiSession) {
      setEtrErrorMessage(null);
      setEtrOverviewSummary({
        lastDate: "2025-10-09",
        meanValue: 1.2,
      });
      setEtrOverviewSeries(etrOverviewSeasonSeries);
      return () => {
        isMounted = false;
      };
    }

    const idToken = authIdToken;
    if (!idToken) {
      return () => {
        isMounted = false;
      };
    }

    Promise.allSettled([fetchEtrStdAe(idToken), fetchEtrSerieEt(idToken)])
      .then(([summaryResult, serieResult]) => {
        if (isMounted) {
          const rejected = [summaryResult, serieResult].find(
            (result) => result.status === "rejected",
          );
          setEtrErrorMessage(
            rejected?.status === "rejected"
              ? toRemoteErrorMessage(rejected.reason, "No fue posible cargar ET-LAT.")
              : null,
          );
          if (summaryResult.status === "fulfilled") {
            setEtrOverviewSummary({
              lastDate: summaryResult.value.fecha,
              meanValue: summaryResult.value.etr ?? 0,
            });
          } else {
            setEtrOverviewSummary({
              lastDate: "Sin datos",
              meanValue: 0,
            });
          }

          setEtrOverviewSeries(
            serieResult.status === "fulfilled" ? toEtrEtmaxSeries(serieResult.value) : [],
          );
        }
      })
      .catch((error) => {
        if (isMounted) {
          setEtrErrorMessage(
            toRemoteErrorMessage(error, "No fue posible cargar datos reales de ET-LAT."),
          );
          setEtrOverviewSummary({
            lastDate: "Sin datos",
            meanValue: 0,
          });
          setEtrOverviewSeries([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [authIdToken, hasAuthenticatedApiSession]);

  useEffect(() => {
    let isMounted = true;

    if (!hasAuthenticatedApiSession) {
      setSnowErrorMessage(null);
      setSnowOverviewSeriesForSummary(snowOverviewSeries);
      return () => {
        isMounted = false;
      };
    }

    const idToken = authIdToken;
    if (!idToken) {
      return () => {
        isMounted = false;
      };
    }

    fetchModisSnowCoverageSeries(idToken)
      .then((coverage) => {
        if (isMounted) {
          setSnowOverviewSeriesForSummary(toModisSnowLineSeries(coverage.ae ?? []));
          setSnowErrorMessage(null);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setSnowErrorMessage(
            toRemoteErrorMessage(error, "No fue posible cargar datos reales de MODIS Snow."),
          );
          setSnowOverviewSeriesForSummary([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [authIdToken, hasAuthenticatedApiSession]);

  useEffect(() => {
    if (wells.length === 0) {
      return;
    }

    if (!wells.some((well) => well.id === selectedWellId)) {
      setSelectedWellId(wells[0].id);
    }
  }, [selectedWellId, wells]);

  useEffect(() => {
    if (wellMeasurementForm.codigoObra || wellRegistryEntries.length === 0) {
      return;
    }

    setWellMeasurementForm((previous) => ({
      ...previous,
      codigoObra: wellRegistryEntries[0].codigoObra,
    }));
  }, [wellMeasurementForm.codigoObra, wellRegistryEntries]);

  useEffect(() => {
    if (stations.length === 0) {
      return;
    }

    if (!stations.some((station) => station.id === selectedStationId)) {
      setSelectedStationId(stations[0].id);
    }
  }, [selectedStationId, stations]);

  useEffect(() => {
    try {
      window.localStorage.setItem(authStorageKey, isLoggedIn ? "true" : "false");
    } catch {
      // Ignore persistence errors in mockup mode.
    }
  }, [isLoggedIn]);

  useEffect(() => {
    try {
      window.localStorage.setItem(authUserStorageKey, authUserName);
    } catch {
      // Ignore persistence errors in mockup mode.
    }
  }, [authUserName]);

  const overviewCards = useMemo(
    () => {
      const latestSnowDate = snowOverviewSeriesForSummary[0]?.points.at(-1)?.label;

      return computeOverviewCards({
        etrLastDate: etrOverviewSummary.lastDate,
        etrLastUpdate: hasAuthenticatedApiSession
          ? toSummaryUpdateIso(etrOverviewSummary.lastDate, etrLastUpdateIso)
          : etrLastUpdateIso,
        etrMeanValue: etrOverviewSummary.meanValue,
        meteoStatus,
        now: dashboardNow,
        snowLastUpdate:
          hasAuthenticatedApiSession && latestSnowDate
            ? toSummaryUpdateIso(latestSnowDate, snowLastUpdateIso)
            : snowLastUpdateIso,
        snowSeries: snowOverviewSeriesForSummary,
        stations,
        wells,
      });
    },
    [
      dashboardNow,
      etrOverviewSummary,
      hasAuthenticatedApiSession,
      meteoStatus,
      snowOverviewSeriesForSummary,
      stations,
      wells,
    ],
  );

  const refreshWellsFromApi = async (idToken: string) => {
    const nextWells = await fetchWellMapPoints(idToken);
    setWellState(nextWells);
    setWellsStatus(nextWells.length > 0 ? "ready" : "error");
    setWellsErrorMessage(nextWells.length > 0 ? null : "La API respondio sin pozos.");
    return nextWells;
  };

  const handleManualSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedLevel = Number.parseFloat(manualForm.level);
    if (Number.isNaN(parsedLevel)) {
      return;
    }

    const timestamp = `${manualForm.date}T${manualForm.time}:00-03:00`;
    const chartLabel = toChartDateLabel(manualForm.date);
    const nextEntry: ManualWellEntry = {
      id: `manual-${Date.now()}`,
      wellId: manualForm.wellId,
      date: manualForm.date,
      time: manualForm.time,
      level: parsedLevel,
      operator: manualForm.operator.trim() || "Operador CAS",
      note: manualForm.note.trim(),
      sourceDevice: "mobile/tablet",
    };

    setWellState((previous) =>
      previous.map((well) =>
        well.id === manualForm.wellId
          ? {
              ...well,
              sourceType: "manual",
              lastUpdate: timestamp,
              levelSeries: upsertSeriesPoint(well.levelSeries, chartLabel, parsedLevel),
            }
          : well,
      ),
    );
    setManualEntries((previous) => [nextEntry, ...previous].slice(0, 12));
    setSelectedWellId(manualForm.wellId);
    setManualForm((previous) => ({ ...previous, level: "", note: "" }));
  };

  const handleWellRegistrySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authIdToken) {
      return;
    }

    const lat = Number.parseFloat(wellRegistryForm.lat);
    const lng = Number.parseFloat(wellRegistryForm.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setWellRegistryMessage("Latitud y longitud deben ser numeros validos.");
      setWellRegistryStatus("error");
      return;
    }

    setWellRegistryStatus("loading");
    setWellRegistryMessage(null);

    try {
      await createWellRegistryEntry(authIdToken, {
        codigoObra: wellRegistryForm.codigoObra,
        name: wellRegistryForm.name,
        lat,
        lng,
        provider: wellRegistryForm.provider || null,
        centroControlRut: wellRegistryForm.centroControlRut || null,
        aquiferSector: wellRegistryForm.aquiferSector || null,
      });
      const entries = wellsCapabilities.isAdmin
        ? await fetchWellRegistryEntries(authIdToken)
        : await fetchMyWellRegistryEntries(authIdToken);
      setWellRegistryEntries(entries);
      setWellRegistryForm({
        codigoObra: "",
        name: "",
        lat: "",
        lng: "",
        provider: "",
        centroControlRut: "",
        aquiferSector: "",
      });
      setWellRegistryStatus("ready");
      setWellRegistryMessage("Pozo creado en registry.");
    } catch {
      setWellRegistryStatus("error");
      setWellRegistryMessage(
        "No fue posible crear el pozo. Revisa codigo_obra unico y formato OB.",
      );
    }
  };

  const handleWellMeasurementSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authIdToken) {
      return;
    }

    setWellMeasurementStatus("loading");
    setWellMeasurementMessage(null);

    try {
      await ingestWellMeasurement(authIdToken, {
        codigoObra: wellMeasurementForm.codigoObra,
        companyRut: wellMeasurementForm.companyRut,
        flowRate: wellMeasurementForm.flowRate,
        measurementDate: wellMeasurementForm.measurementDate,
        measurementTime: wellMeasurementForm.measurementTime,
        totalizer: wellMeasurementForm.totalizer,
        userRut: wellMeasurementForm.userRut,
        waterTableDepth: wellMeasurementForm.waterTableDepth || null,
      });
      const nextWells = await refreshWellsFromApi(authIdToken);
      const selected = nextWells.find((well) => well.id === wellMeasurementForm.codigoObra);
      if (selected) {
        setSelectedWellId(selected.id);
      }
      setWellMeasurementStatus("ready");
      setWellMeasurementMessage("Medicion guardada y snapshot actualizado.");
      setWellMeasurementForm((previous) => ({
        ...previous,
        flowRate: "",
        totalizer: "",
        waterTableDepth: "",
      }));
    } catch (error) {
      setWellMeasurementStatus("error");
      setWellMeasurementMessage(
        toRemoteErrorMessage(error, "No fue posible guardar la medicion."),
      );
    }
  };

  const handleWellMeasurementCsvUpload = (file: File) => {
    if (!authIdToken) {
      return;
    }

    setWellMeasurementStatus("loading");
    setWellMeasurementCsvMessage(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const payloads = parseMeasurementCsv(String(reader.result ?? ""));
        for (const payload of payloads) {
          await ingestWellMeasurement(authIdToken, payload);
        }
        await refreshWellsFromApi(authIdToken);
        setWellMeasurementStatus("ready");
        setWellMeasurementCsvMessage(`${payloads.length} mediciones cargadas correctamente.`);
      } catch (error) {
        setWellMeasurementStatus("error");
        setWellMeasurementCsvMessage(
          toRemoteErrorMessage(error, "No fue posible cargar el CSV."),
        );
      }
    };
    reader.onerror = () => {
      setWellMeasurementStatus("error");
      setWellMeasurementCsvMessage("No fue posible leer el archivo CSV.");
    };
    reader.readAsText(file);
  };

  const handleOpenLogin = () => {
    setAppScreen("login");
  };

  const handleGoogleLogin = async () => {
    const session = await signInWithGoogle();

    setIsLoggedIn(session.isLoggedIn);
    setAuthIdToken(session.idToken);
    setAuthPermissions(session.permissions);
    setAuthRole(session.role);
    setAuthUid(session.uid);
    setAuthUserName(session.userName.trim().length > 0 ? session.userName : defaultAuthUserName);
    setActiveView("overview");
    setAppScreen("dashboard");
  };

  const handleEmailPasswordLogin = async (email: string, password: string) => {
    const session = await signInWithEmailPassword(email, password);

    setIsLoggedIn(session.isLoggedIn);
    setAuthIdToken(session.idToken);
    setAuthPermissions(session.permissions);
    setAuthRole(session.role);
    setAuthUid(session.uid);
    setAuthUserName(session.userName.trim().length > 0 ? session.userName : defaultAuthUserName);
    setActiveView("overview");
    setAppScreen("dashboard");
  };

  const handleLogout = async () => {
    await signOutFromGoogle();
    setIsLoggedIn(false);
    setAuthIdToken(null);
    setWellState(wellMapPoints);
    setWellsStatus("idle");
    setWellsCapabilities({
      canAddMeasurements: false,
      canCreateWells: false,
      canDeleteMeasurements: false,
      canManageAccess: false,
      canViewWells: false,
      isAdmin: false,
    });
    setWellRegistryEntries([]);
    setWellRegistryStatus("idle");
    setWellRegistryMessage(null);
    setWellMeasurementStatus("idle");
    setWellMeasurementMessage(null);
    setWellMeasurementCsvMessage(null);
    setAuthPermissions([]);
    setAuthRole("public_user");
    setAuthUid(null);
    setStationState(meteoStationPoints);
    setMeteoStatus("idle");
    setAppScreen("dashboard");
  };

  if (appScreen === "login") {
    return (
      <LoginView
        onBack={() => setAppScreen("dashboard")}
        onGoogleLogin={handleGoogleLogin}
        onEmailPasswordLogin={handleEmailPasswordLogin}
      />
    );
  }

  return (
    <div className="page-shell">
      <header className="site-header">
        <div className="site-brand">
          <div className="site-brand-icon" aria-hidden="true">
            <Droplets size={16} />
          </div>
          <div>
            <h1>Agua con Dato</h1>
            <p>
              Mockup unificado para ET-LAT, MODIS-Snow, Pozos y Meteo sobre una
              infraestructura común.
            </p>
          </div>
        </div>

        <div className="site-header-actions">
          <nav className="top-nav" aria-label="Views">
            {availableViews.map((view) => {
              const Icon = navIconMap[view.id];
              return (
                <button
                  key={view.id}
                  type="button"
                  className={view.id === activeView ? "is-active" : ""}
                  onClick={() => setActiveView(view.id)}
                >
                  <Icon className="nav-icon" size={14} />
                  {view.label}
                </button>
              );
            })}
          </nav>

          <div className="auth-controls">
            {isLoggedIn ? (
              <>
                <span className="auth-user-chip">
                  <UserRound size={13} />
                  {authUserName}
                  {authRole === "general_admin" ? (
                    <span className="auth-role-dot">Admin</span>
                  ) : null}
                </span>
                <button
                  type="button"
                  className="auth-action-btn"
                  onClick={handleLogout}
                >
                  <LogOut size={13} />
                  Cerrar sesión
                </button>
              </>
            ) : (
              <button
                type="button"
                className="auth-action-btn auth-login-btn"
                onClick={handleOpenLogin}
              >
                <LogIn size={13} />
                Iniciar sesión
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="content-shell">
        {activeView === "overview" && (
          <OverviewView
            cards={overviewCards}
            etrErrorMessage={etrErrorMessage}
            etrSeries={etrOverviewSeries}
            meteoErrorMessage={meteoErrorMessage}
            meteoStatus={meteoStatus}
            onOpenView={(viewId) => setActiveView(viewId)}
            snowErrorMessage={snowErrorMessage}
            snowSeries={snowOverviewSeriesForSummary}
            stations={stations}
            wellsErrorMessage={wellsErrorMessage}
            wellsStatus={wellsStatus}
            wells={wells}
          />
        )}
        {activeView === "etr" && (
          <EtrView authIdToken={authIdToken} isLoggedIn={hasAuthenticatedApiSession} />
        )}
        {activeView === "snow" && (
          <SnowView authIdToken={authIdToken} isLoggedIn={hasAuthenticatedApiSession} />
        )}
        {activeView === "wells" && (
          <WellsView
            authIdToken={authIdToken}
            canAddMeasurements={wellsCapabilities.canAddMeasurements}
            canCreateWells={wellsCapabilities.canCreateWells}
            canManageAccess={wellsCapabilities.canManageAccess}
            currentUserUid={authUid}
            isLoggedIn={hasAuthenticatedApiSession}
            manualEntries={manualEntries}
            manualForm={manualForm}
            now={dashboardNow}
            onManualChange={(next) => setManualForm((previous) => ({ ...previous, ...next }))}
            onManualSubmit={handleManualSubmit}
            onWellRegistryChange={(next) =>
              setWellRegistryForm((previous) => ({ ...previous, ...next }))}
            onWellRegistrySubmit={handleWellRegistrySubmit}
            onWellMeasurementChange={(next) =>
              setWellMeasurementForm((previous) => ({ ...previous, ...next }))}
            onWellMeasurementCsvUpload={handleWellMeasurementCsvUpload}
            onWellMeasurementSubmit={handleWellMeasurementSubmit}
            onSelectWell={setSelectedWellId}
            selectedWellId={selectedWellId}
            status={wellsStatus}
            errorMessage={wellsErrorMessage}
            wellMeasurementCsvMessage={wellMeasurementCsvMessage}
            wellMeasurementForm={wellMeasurementForm}
            wellMeasurementMessage={wellMeasurementMessage}
            wellMeasurementStatus={wellMeasurementStatus}
            wellRegistryEntries={wellRegistryEntries}
            wellRegistryForm={wellRegistryForm}
            wellRegistryMessage={wellRegistryMessage}
            wellRegistryStatus={wellRegistryStatus}
            wells={wells}
          />
        )}
        {activeView === "meteo" && (
          <MeteoView
            isLoggedIn={hasAuthenticatedApiSession}
            now={dashboardNow}
            onSelectStation={setSelectedStationId}
            selectedStationId={selectedStationId}
            stations={stations}
            status={meteoStatus}
            errorMessage={meteoErrorMessage}
          />
        )}
        {activeView === "admin" && canManageUsers && (
          <AdminView authIdToken={authIdToken} currentUserUid={authUid} />
        )}
      </main>
    </div>
  );
}
