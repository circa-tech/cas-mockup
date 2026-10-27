import { Droplets, Gauge, Radio, Waves } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { KpiCard } from "../../components/KpiCard";
import { MiniSparkline } from "../../components/MiniSparkline";
import { Panel } from "../../components/Panel";
import { RemoteDataState } from "../../components/RemoteDataState";
import { SimpleLineChart, type LinePoint, type LineSeries } from "../../components/SimpleLineChart";
import { StatusLeafletMap } from "../../components/StatusLeafletMap";
import {
  fetchWellMeasurementHistory,
  type WellMeasurementHistoryPoint,
  type WellMeasurementHistoryResponse,
  type WellRegistryEntry,
} from "../../services/wellsApi";
import { queryKeys } from "../../lib/queryKeys";
import { geographicToUtm, parseUtmZone } from "./coordinateConversion";
import {
  chartPalette,
  waterQualityRecords,
  type WaterQualityStatus,
  type WellMapPoint,
  type WellMeasurementVariable,
} from "../../data/mockupData";
import type { RemoteLoadStatus } from "../../types/remote";
import { formatRelativeAge, formatShortDateTime } from "../../utils/date";
import { freshnessClassMap, freshnessLabelMap } from "../../utils/freshness";
import {
  getCurrentValue,
  getDailyChangeValue,
  getRangeValue,
} from "./wellMetrics";

type WellsMonitoringTabProps = {
  authIdToken: string | null;
  errorMessage: string | null;
  isLoggedIn: boolean;
  now: Date;
  onSelectWell: (wellId: string) => void;
  selectedWellId: string;
  status: RemoteLoadStatus;
  subnav: ReactNode;
  wellRegistryEntries: WellRegistryEntry[];
  wells: WellMapPoint[];
};

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
  telemetry: "Telemetría (automática)",
  manual: "Medición manual",
} as const;

const chartVariables: { value: WellMeasurementVariable; label: string; unit: string }[] = [
  { value: "waterTableDepth", label: "Nivel freático", unit: "m" },
  { value: "flowRate", label: "Caudal", unit: "L/s" },
  { value: "pressure", label: "Presión", unit: "" },
  { value: "ph", label: "pH", unit: "" },
  { value: "conductivity", label: "Conductividad", unit: "" },
  { value: "totalizer", label: "Totalizador", unit: "" },
];

const secondaryChartVariables = chartVariables.filter(
  (variable) => variable.value !== "waterTableDepth",
);
const chartVariableColor: Record<WellMeasurementVariable, string> = {
  waterTableDepth: chartPalette.chart1,
  flowRate: chartPalette.chart2,
  pressure: chartPalette.chart4,
  ph: chartPalette.chart5,
  conductivity: chartPalette.chart6,
  totalizer: chartPalette.chart8,
};

type LevelCondition = NonNullable<LinePoint["condition"]>;
type MeasurementSource = "api" | "manual";
type SelectableLevelCondition = Exclude<LevelCondition, "unknown">;
type ChartPeriod = "24h" | "7d" | "1m" | "3m" | "6m" | "1y" | "all";

const chartPeriodOptions: { value: ChartPeriod; label: string }[] = [
  { value: "24h", label: "Últimas 24 Horas" },
  { value: "7d", label: "Últimos 7 Días" },
  { value: "1m", label: "Último Mes" },
  { value: "3m", label: "Últimos 3 Meses" },
  { value: "6m", label: "Últimos 6 Meses" },
  { value: "1y", label: "Último Año" },
  { value: "all", label: "Todo el historial" },
];

const measurementSourceOptions: { value: MeasurementSource; label: string }[] = [
  { value: "api", label: "Medición API" },
  { value: "manual", label: "Medición manual" },
];
const levelConditionOptions: { value: SelectableLevelCondition; label: string }[] = [
  { value: "static", label: "Nivel estático" },
  { value: "dynamic", label: "Nivel dinámico" },
];

const formatMeters = (value: number) =>
  `${new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} m`;

const formatOptionalNumber = (
  value: number | string | null | undefined,
  fractionDigits: number,
) => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return "Sin dato";
  }
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "Sin dato";
  return new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(numericValue);
};

const formatOptionalMeters = (value: number | string | null | undefined) => {
  const formatted = formatOptionalNumber(value, 2);
  return formatted === "Sin dato" ? formatted : `${formatted} m`;
};

const hasMetadataValue = (value: number | string | null | undefined) =>
  value !== null && value !== undefined && String(value).trim() !== "";

const catchmentStatusLabelMap = {
  operativa: "Operativa",
  deshabilitada: "Deshabilitada",
  pozo_monitoreo: "Pozo de monitoreo",
} as const;

const monthLabels = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const englishMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const parseSeriesDate = (label: string) => {
  const numeric = /^(\d{1,2})\/(\d{1,2})/.exec(label);
  if (numeric) return { day: Number(numeric[1]), month: Number(numeric[2]) };

  const iso = /^\d{4}-(\d{2})-(\d{2})/.exec(label);
  if (iso) return { day: Number(iso[2]), month: Number(iso[1]) };

  const short = /^([A-Za-z]{3})\s+(\d{1,2})/.exec(label);
  if (short) return { day: Number(short[2]), month: englishMonths.indexOf(short[1]) + 1 };

  return null;
};

const formatSeriesPeriod = (points: LinePoint[]) => {
  const first = parseSeriesDate(points[0]?.label ?? "");
  const last = parseSeriesDate(points.at(-1)?.label ?? "");
  if (!first || !last || !monthLabels[first.month - 1] || !monthLabels[last.month - 1]) {
    return "Variación en el período";
  }
  const range = first.month === last.month
    ? `${first.day} al ${last.day} ${monthLabels[last.month - 1]}`
    : `${first.day} ${monthLabels[first.month - 1]} al ${last.day} ${monthLabels[last.month - 1]}`;
  return `Variación en el período (${range})`;
};

const toLevelChartSeries = (
  well: WellMapPoint,
  selectedConditions: SelectableLevelCondition[],
  selectedSources: MeasurementSource[],
): LineSeries[] => {
  const levelBySource = well.measurementSeriesByVariable?.waterTableDepth;
  const conditions = {
    static: chartPalette.chart5,
    dynamic: chartPalette.chart3,
    unknown: chartPalette.chart7,
  };
  return ([
    { source: "api" as const, label: "Medición API", points: levelBySource?.telemetry ?? [], color: chartPalette.chart1, marker: "circle" as const },
    { source: "manual" as const, label: "Medición manual", points: levelBySource?.manual ?? [], color: chartPalette.chart4, marker: "square" as const },
  ]).flatMap(({ source, label, points, color, marker }) => {
    if (!selectedSources.includes(source)) return [];
    const visiblePoints = points.filter((point) => {
      const condition = point.condition ?? "unknown";
      return condition === "unknown" || selectedConditions.includes(condition);
    });
    return visiblePoints.length > 0
    ? [{
        label,
        color,
        points: visiblePoints,
        markerShape: marker,
        conditionPointColors: conditions,
        unit: "m",
        yAxisId: "primary" as const,
        connectNulls: true,
      }]
    : [];
  });
};

const toVariableChartSeries = (
  well: WellMapPoint,
  variable: (typeof secondaryChartVariables)[number],
  selectedSources: MeasurementSource[],
): LineSeries[] => {
  const sourceSeries = well.measurementSeriesByVariable?.[variable.value];
  return ([
    { source: "api" as const, label: "telemetría", points: sourceSeries?.telemetry ?? [], marker: "circle" as const },
    { source: "manual" as const, label: "manual", points: sourceSeries?.manual ?? [], marker: "square" as const },
  ]).flatMap(({ source, label, points, marker }) => selectedSources.includes(source) && points.length > 0
    ? [{
        label: `${variable.label} · ${label}`,
        color: chartVariableColor[variable.value],
        points,
        markerShape: marker,
        unit: variable.unit,
        yAxisId: "secondary" as const,
        connectNulls: true,
      }]
    : []);
};

const getSeriesDomain = (series: LineSeries[]) => {
  const values = series.flatMap((item) => item.points.map((point) => point.value));
  if (values.length === 0) return [-0.1, 0.1] as const;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.05, Math.abs(max) * 0.01, 0.1);
  return [min - padding, max + padding] as const;
};

const getPeriodStart = (now: Date, period: ChartPeriod): number | null => {
  const start = new Date(now);
  switch (period) {
    case "24h":
      start.setTime(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "7d":
      start.setTime(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "1m":
    case "3m":
    case "6m":
    case "1y": {
      const months = { "1m": 1, "3m": 3, "6m": 6, "1y": 12 }[period];
      const day = start.getDate();
      start.setDate(1);
      start.setMonth(start.getMonth() - months);
      const lastDayOfTargetMonth = new Date(
        start.getFullYear(),
        start.getMonth() + 1,
        0,
      ).getDate();
      start.setDate(Math.min(day, lastDayOfTargetMonth));
      break;
    }
    case "all":
      return null;
  }
  return start.getTime();
};

const filterSeriesByPeriod = (
  series: LineSeries[],
  period: ChartPeriod,
  now: Date,
): LineSeries[] => {
  const start = getPeriodStart(now, period);
  if (start === null) return series;

  return series.map((item) => ({
    ...item,
    points: item.points.filter((point) =>
      point.timestamp !== undefined && point.timestamp >= start && point.timestamp <= now.getTime(),
    ),
  }));
};

const formatLocalDateParam = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getChartHistoryRange = (now: Date, period: ChartPeriod) => {
  const start = getPeriodStart(now, period);
  return {
    ...(start === null ? {} : { start_date: formatLocalDateParam(new Date(start)) }),
    end_date: formatLocalDateParam(now),
  };
};

const historyMetricByVariable: Record<WellMeasurementVariable, string> = {
  waterTableDepth: "water_table_depth",
  flowRate: "flow_rate",
  pressure: "pressure",
  ph: "ph",
  conductivity: "conductivity",
  totalizer: "totalizer",
};

const toHistoryLinePoint = (
  point: WellMeasurementHistoryPoint,
  variable: WellMeasurementVariable,
  resolution: WellMeasurementHistoryResponse["resolution"],
): LinePoint[] => {
  const value = point.values[historyMetricByVariable[variable]];
  const timestamp = Date.parse(point.measured_at);
  if (value === null || value === undefined || !Number.isFinite(timestamp)) return [];
  return [{
    label: new Intl.DateTimeFormat("es-CL", {
      day: "2-digit",
      ...(resolution === "native" ? { hour: "2-digit", hourCycle: "h23" as const, minute: "2-digit" } : {}),
      month: "2-digit",
    }).format(new Date(timestamp)),
    timestamp,
    ...(variable === "waterTableDepth"
      ? { condition: point.water_level_condition ?? "unknown" }
      : {}),
    value,
  }];
};

const collapseDailyVariablePoints = (
  points: WellMeasurementHistoryPoint[],
  variable: WellMeasurementVariable,
) => {
  const metric = historyMetricByVariable[variable];
  const groups = new Map<string, WellMeasurementHistoryPoint[]>();
  for (const point of points) {
    if (point.values[metric] === null || point.values[metric] === undefined) continue;
    const key = `${point.measurement_date}:${point.source ?? "unknown"}`;
    groups.set(key, [...(groups.get(key) ?? []), point]);
  }

  return [...groups.values()].map((group) => {
    const latest = group.reduce((current, point) =>
      Date.parse(point.measured_at) > Date.parse(current.measured_at) ? point : current,
    );
    const latestValue = latest.values[metric] ?? null;
    const value = variable === "totalizer"
      ? latestValue
      : group.reduce((sum, point) => {
          const count = point.count?.[metric] ?? 1;
          return sum + (point.values[metric] ?? 0) * count;
        }, 0) / group.reduce((sum, point) => sum + (point.count?.[metric] ?? 1), 0);

    return {
      ...latest,
      values: { ...latest.values, [metric]: value },
    };
  });
};

const buildHistoricalMeasurementSeries = (
  points: WellMeasurementHistoryPoint[],
  resolution: WellMeasurementHistoryResponse["resolution"],
): NonNullable<WellMapPoint["measurementSeriesByVariable"]> => {
  const result: NonNullable<WellMapPoint["measurementSeriesByVariable"]> = {};
  for (const variable of chartVariables) {
    const variablePoints = resolution === "daily" && variable.value !== "waterTableDepth"
      ? collapseDailyVariablePoints(points, variable.value)
      : points;
    const bySource = (source?: MeasurementSource) => variablePoints
      .filter((point) => source === undefined || point.source === source)
      .flatMap((point) => toHistoryLinePoint(point, variable.value, resolution));
    result[variable.value] = {
      all: bySource(),
      manual: bySource("manual"),
      telemetry: bySource("api"),
    };
  }
  return result;
};

export function WellsMonitoringTab({
  authIdToken,
  errorMessage,
  isLoggedIn,
  now,
  onSelectWell,
  selectedWellId,
  status,
  subnav,
  wellRegistryEntries,
  wells,
}: WellsMonitoringTabProps) {
  const [selectedChartPeriod, setSelectedChartPeriod] = useState<ChartPeriod>("24h");
  const historyRange = getChartHistoryRange(now, selectedChartPeriod);
  const chartWellId = wells.find((well) => well.id === selectedWellId)?.id
    ?? wells[0]?.id
    ?? selectedWellId;
  const historyWellId = wellRegistryEntries.find(
    (entry) => entry.id === chartWellId || entry.codigoObra === chartWellId,
  )?.id ?? chartWellId;
  const historyQuery = useQuery({
    queryKey: queryKeys.wells.history(authIdToken, historyWellId, historyRange),
    queryFn: ({ signal }) => fetchWellMeasurementHistory(
      authIdToken,
      historyWellId,
      historyRange,
      signal,
    ),
    enabled: isLoggedIn && status === "ready" && Boolean(authIdToken && historyWellId && wells.length > 0),
    staleTime: 5 * 60 * 1000,
  });
  const [selectedSecondaryVariable, setSelectedSecondaryVariable] = useState<WellMeasurementVariable | null>(null);
  const [selectedLevelConditions, setSelectedLevelConditions] = useState<SelectableLevelCondition[]>([
    "static", "dynamic",
  ]);
  const [selectedMeasurementSources, setSelectedMeasurementSources] = useState<MeasurementSource[]>([
    "manual",
  ]);
  const measurementSourceSummary = selectedMeasurementSources.length === measurementSourceOptions.length
    ? "Medición API y manual"
    : measurementSourceOptions
      .filter((source) => selectedMeasurementSources.includes(source.value))
      .map((source) => source.label)
      .join(", ") || "Ningún origen";
  const levelConditionSummary = selectedLevelConditions.length === levelConditionOptions.length
    ? "Nivel estático y dinámico"
    : levelConditionOptions
      .filter((condition) => selectedLevelConditions.includes(condition.value))
      .map((condition) => condition.label)
      .join(", ") || "Ninguna condición";

  if (isLoggedIn && (status === "loading" || status === "error" || wells.length === 0)) {
    const isLoading = status === "loading";
    return (
      <div className="view-stack">
        <WellsIntro />
        {subnav}
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
  const chartWell = isLoggedIn
    ? {
        ...selectedWell,
        measurementSeriesByVariable: buildHistoricalMeasurementSeries(
          historyQuery.data?.points ?? [],
          historyQuery.data?.resolution ?? "native",
        ),
      }
    : selectedWell;
  const selectedWellRegistryEntry = wellRegistryEntries.find(
    (entry) => entry.id === selectedWell.id || entry.codigoObra === selectedWell.id,
  );
  const selectedLatitude = selectedWellRegistryEntry?.lat ?? selectedWell.lat;
  const selectedLongitude = selectedWellRegistryEntry?.lng ?? selectedWell.lng;
  const storedUtmZone = parseUtmZone(selectedWellRegistryEntry?.huso ?? "");
  const calculatedUtm = geographicToUtm(
    selectedLatitude,
    selectedLongitude,
    storedUtmZone?.zone,
  );
  const utmEasting = hasMetadataValue(selectedWellRegistryEntry?.utmEasting)
    ? selectedWellRegistryEntry?.utmEasting
    : calculatedUtm?.easting;
  const utmNorthing = hasMetadataValue(selectedWellRegistryEntry?.utmNorthing)
    ? selectedWellRegistryEntry?.utmNorthing
    : calculatedUtm?.northing;
  const utmZone = hasMetadataValue(selectedWellRegistryEntry?.huso)
    ? selectedWellRegistryEntry?.huso
    : calculatedUtm
      ? `${calculatedUtm.zone}${calculatedUtm.hemisphere}`
      : null;
  const datum = hasMetadataValue(selectedWellRegistryEntry?.datum)
    ? selectedWellRegistryEntry?.datum
    : calculatedUtm
      ? "WGS84"
      : null;
  const waterByWell = new Map(waterQualityRecords.map((record) => [record.wellId, record]));
  const selectedQuality = waterByWell.get(selectedWell.id);
  const wellRows = wells.map((well) => ({
    ...well,
    currentLevel: getCurrentValue(well.levelSeries),
    dailyChange: well.dailyChange ?? getDailyChangeValue(well.levelSeries),
    qualityStatus: waterByWell.get(well.id)?.qualityStatus,
  }));
  const wellsFreshCount = wells.filter((well) => well.status !== "stale").length;
  const wellsStaleCount = wells.filter((well) => well.status === "stale").length;
  const manualWells = wells.filter((well) =>
    Object.values(well.measurementSeriesByVariable ?? {}).some(
      (series) => (series?.manual.length ?? 0) > 0,
    ),
  ).length;
  const waterAlerts = wells.filter(
    (well) => waterByWell.get(well.id)?.qualityStatus === "alert",
  ).length;
  const maxUpdate = wells.reduce((latest, well) => {
    if (!latest) {
      return well.lastUpdate;
    }
    return new Date(well.lastUpdate).getTime() > new Date(latest).getTime()
      ? well.lastUpdate
      : latest;
  }, "");
  const primaryChartSeries = filterSeriesByPeriod(toLevelChartSeries(
    chartWell,
    selectedLevelConditions,
    selectedMeasurementSources,
  ), selectedChartPeriod, now);
  const selectedLevelPoints = primaryChartSeries.flatMap((series) => series.points);
  const secondaryChartSeries = filterSeriesByPeriod(selectedSecondaryVariable
    ? secondaryChartVariables
      .filter((variable) => variable.value === selectedSecondaryVariable)
      .flatMap((variable) => toVariableChartSeries(chartWell, variable, selectedMeasurementSources))
    : [], selectedChartPeriod, now);
  const selectedChartSeries = primaryChartSeries.length > 0
    ? [...primaryChartSeries, ...secondaryChartSeries]
    : [];
  const chartLabelCount = new Set(
    selectedChartSeries.flatMap((item) => item.points.map((point) => point.label)),
  ).size;
  const [minSeriesValue, maxSeriesValue] = getSeriesDomain(primaryChartSeries);
  const [minSecondaryValue, maxSecondaryValue] = getSeriesDomain(secondaryChartSeries);
  const dailyChange = selectedWell.dailyChange ?? getDailyChangeValue(selectedWell.levelSeries);
  const dailyChangeDescription = dailyChange > 0
    ? `el agua subió ${formatMeters(dailyChange)}`
    : dailyChange < 0
      ? `el agua bajó ${formatMeters(Math.abs(dailyChange))}`
      : "sin cambio";
  return (
    <div className="view-stack">
      <WellsIntro />
      {subnav}

      <div className="stat-grid">
        <KpiCard
          delayMs={0}
          icon={Waves}
          title="Pozos reportando"
          value={`${wellsFreshCount} de ${wells.length}`}
          note={`${wellsStaleCount} sin datos hace más de 48 h`}
          noteTone={wellsStaleCount > 0 ? "negative" : "positive"}
        />
        <KpiCard
          delayMs={80}
          icon={Radio}
          title="Pozos con lectura manual"
          value={String(manualWells)}
          note="Datos ingresados a mano desde celular o tablet"
          noteTone="neutral"
        />
        <KpiCard
          delayMs={160}
          icon={Droplets}
          title="Pozos con alerta de calidad"
          value={String(waterAlerts)}
          note={waterAlerts > 0
            ? "Última muestra fuera del rango de referencia"
            : "Sin muestras fuera del rango de referencia"}
          noteTone={waterAlerts > 0 ? "negative" : "positive"}
        />
        <KpiCard
          delayMs={240}
          icon={Gauge}
          title="Último dato recibido"
          value={formatShortDateTime(maxUpdate)}
          note={formatRelativeAge(maxUpdate, now).toLocaleLowerCase("es-CL")}
          noteTone="neutral"
        />
      </div>

      <div className="map-detail-grid">
        <Panel
          className="well-map-panel"
          title="Mapa de pozos"
          subtitle={`Ubicación de ${selectedWell.name}`}
        >
          <dl className="well-geographic-summary" aria-label="Coordenadas del pozo">
            <div>
              <dt>Latitud</dt>
              <dd>{formatOptionalNumber(selectedLatitude, 5)}°</dd>
            </div>
            <div>
              <dt>Longitud</dt>
              <dd>{formatOptionalNumber(selectedLongitude, 5)}°</dd>
            </div>
            <div>
              <dt>Este UTM</dt>
              <dd>{formatOptionalMeters(utmEasting)}</dd>
            </div>
            <div>
              <dt>Norte UTM</dt>
              <dd>{formatOptionalMeters(utmNorthing)}</dd>
            </div>
            <div>
              <dt>Huso</dt>
              <dd>{utmZone || "Sin dato"}</dd>
            </div>
            <div>
              <dt>Datum</dt>
              <dd>{datum || "Sin dato"}</dd>
            </div>
          </dl>
          <StatusLeafletMap
            initialCenter={[selectedLatitude, selectedLongitude]}
            initialZoom={16}
            points={[{
              id: selectedWell.id,
              name: selectedWell.name,
              lat: selectedLatitude,
              lng: selectedLongitude,
              status: selectedWell.status,
              sourceType: selectedWell.sourceType,
              lastUpdate: selectedWell.lastUpdate,
              qualityStatus: selectedQuality?.qualityStatus,
            }]}
            selectedPointId={selectedWell.id}
            selectedPointZoom={16}
            onSelect={onSelectWell}
          />
          <div className="map-legend">
            <span><i className="legend-dot fresh" /> Al día (menos de 24 h)</span>
            <span><i className="legend-dot warning" /> Atrasado (1 a 2 días)</span>
            <span><i className="legend-dot stale" /> Sin datos (más de 2 días)</span>
            <span><i className="legend-dot quality-alert" /> ! Alerta de calidad</span>
          </div>
        </Panel>

        <Panel
          title={
            <label className="well-detail-selector-title">
              <span>Selecciona un Pozo</span>
              <select
                className="well-detail-well-selector"
                aria-label="Pozo seleccionado"
                value={selectedWell.id}
                onChange={(event) => onSelectWell(event.target.value)}
              >
                {wells.map((well) => (
                  <option key={well.id} value={well.id}>
                    {well.name}
                  </option>
                ))}
              </select>
            </label>
          }
        >
          <div className="detail-kpi-grid">
            <article className="detail-kpi">
              <span>Profundidad del agua</span>
              <strong>{formatMeters(getCurrentValue(selectedWell.levelSeries))}</strong>
            </article>
            <article className="detail-kpi">
              <span>Desde la medición anterior</span>
              <strong>{dailyChangeDescription}</strong>
            </article>
            <article className="detail-kpi">
              <span>{formatSeriesPeriod(selectedLevelPoints)}</span>
              <strong>{formatMeters(getRangeValue(selectedLevelPoints))}</strong>
            </article>
          </div>

          <section className="well-registry-details" aria-label="Datos técnicos del pozo">
            <dl>
              <div>
                <dt>Código de obra</dt>
                <dd>{selectedWellRegistryEntry?.codigoObra || "Sin dato"}</dd>
              </div>
              <div>
                <dt>Profundidad total</dt>
                <dd>{formatOptionalMeters(selectedWellRegistryEntry?.wellDepth)}</dd>
              </div>
              <div>
                <dt>Profundidad de bomba</dt>
                <dd>{formatOptionalMeters(selectedWellRegistryEntry?.pumpDepth)}</dd>
              </div>
              <div>
                <dt>Estado de captación</dt>
                <dd>
                  {selectedWellRegistryEntry?.catchmentStatus
                    ? catchmentStatusLabelMap[selectedWellRegistryEntry.catchmentStatus]
                    : "Sin dato"}
                </dd>
              </div>
            </dl>
          </section>

          <div className="status-row">
            <span className={`status-pill ${freshnessClassMap[selectedWell.status]}`}>
              {selectedWell.status === "fresh" ? "Reportando" : freshnessLabelMap[selectedWell.status]}
            </span>
            <span className="status-pill is-neutral">
              {sourceLabelMap[selectedWell.sourceType]}
            </span>
            <span className="status-pill is-neutral">
              último dato {formatRelativeAge(selectedWell.lastUpdate, now).toLocaleLowerCase("es-CL")}
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

      <Panel
        className="well-chart-panel"
        title={`Nivel freático y otras variables · ${selectedWell.name}`}
        subtitle="Profundidad en metros bajo el suelo; los valores mayores indican mayor profundidad."
      >
        <div className="well-chart-controls">
          <fieldset className="well-chart-variable-selector">
            <legend>Período</legend>
            <select
              className="well-chart-select"
              value={selectedChartPeriod}
              onChange={(event) => setSelectedChartPeriod(event.target.value as ChartPeriod)}
            >
              {chartPeriodOptions.map((period) => (
                <option key={period.value} value={period.value}>{period.label}</option>
              ))}
            </select>
          </fieldset>
          <fieldset className="well-chart-variable-selector">
            <legend>Origen de las mediciones</legend>
            <details className="well-chart-multiselect">
              <summary className="well-chart-select well-chart-multiselect-trigger">
                {measurementSourceSummary}
              </summary>
              <div className="well-chart-multiselect-menu" role="group" aria-label="Origen de las mediciones">
                {measurementSourceOptions.map((source) => (
                  <label key={source.value}>
                    <input
                      type="checkbox"
                      checked={selectedMeasurementSources.includes(source.value)}
                      onChange={(event) => {
                        setSelectedMeasurementSources((current) => event.target.checked
                          ? [...current, source.value]
                          : current.filter((selected) => selected !== source.value));
                      }}
                    />
                    <span>{source.label}</span>
                  </label>
                ))}
              </div>
            </details>
          </fieldset>
          <fieldset className="well-chart-variable-selector">
            <legend>Variable del eje secundario</legend>
            <select
              className="well-chart-select"
              value={selectedSecondaryVariable ?? ""}
              onChange={(event) => setSelectedSecondaryVariable(
                event.target.value ? event.target.value as WellMeasurementVariable : null,
              )}
            >
              <option value="">Solo profundidad</option>
              {secondaryChartVariables.map((variable) => (
                <option key={variable.value} value={variable.value}>{variable.label}</option>
              ))}
            </select>
          </fieldset>
          <fieldset className="well-chart-variable-selector">
            <legend>Condiciones del nivel freático</legend>
            <details className="well-chart-multiselect">
              <summary className="well-chart-select well-chart-multiselect-trigger">
                {levelConditionSummary}
              </summary>
              <div className="well-chart-multiselect-menu" role="group" aria-label="Condiciones del nivel freático">
                {levelConditionOptions.map((condition) => (
                  <label key={condition.value}>
                    <input
                      type="checkbox"
                      checked={selectedLevelConditions.includes(condition.value)}
                      onChange={(event) => {
                        setSelectedLevelConditions((current) => event.target.checked
                          ? [...current, condition.value]
                          : current.filter((selected) => selected !== condition.value));
                      }}
                    />
                    <span>{condition.label}</span>
                  </label>
                ))}
              </div>
            </details>
          </fieldset>
        </div>
        <div className="well-chart-plot-area">
          {isLoggedIn && historyQuery.isPending ? (
            <RemoteDataState
              className="is-chart"
              tone="loading"
              title="Cargando historial"
              message="Consultando las mediciones del período seleccionado."
            />
          ) : isLoggedIn && historyQuery.isError ? (
            <RemoteDataState
              className="is-chart"
              tone="error"
              title="No se pudo cargar el historial"
              message="Intenta consultar el período nuevamente."
            />
          ) : selectedChartSeries.length > 0 ? (
            <>
              {isLoggedIn && historyQuery.data?.resolution === "daily" && (
                <p className="well-chart-resolution-note">
                  El período tiene muchos datos; se muestran promedios diarios.
                </p>
              )}
            <SimpleLineChart
              key={`${historyWellId}-${selectedChartPeriod}-${historyRange.start_date ?? "all"}-${historyRange.end_date}`}
              labelEvery={Math.max(1, Math.ceil(chartLabelCount / 18))}
              maxValue={maxSeriesValue}
              minValue={minSeriesValue}
              mode="linear"
              primaryAxisReversed
              primaryAxisLabel="Profundidad (m)"
              secondaryMaxValue={maxSecondaryValue}
              secondaryMinValue={minSecondaryValue}
              series={selectedChartSeries}
              showDots={false}
              showBrush
              unit="m"
              xLabelAngle={-40}
            />
            </>
          ) : (
            <p className="well-chart-no-data" role="status">
              No hay mediciones de nivel freático para los filtros seleccionados.
            </p>
          )}
        </div>
      </Panel>

      <details className="panel well-all-wells-disclosure">
        <summary className="panel-header">
          <div>
            <h3>Todos los pozos</h3>
            <p>Toca un pozo para ver su detalle</p>
          </div>
          <span className="well-all-wells-count">{wells.length}</span>
        </summary>
        <div className="panel-content">
          <div className="comparison-list">
            {wellRows.map((well) => (
              <button
                key={well.id}
                type="button"
                className={`comparison-row ${selectedWell.id === well.id ? "is-selected" : ""}`}
                onClick={() => onSelectWell(well.id)}
              >
                <div className="comparison-main">
                  <strong>{well.name}</strong>
                  <span>{well.provider}</span>
                </div>
                <div className="comparison-metrics">
                  <div><span>Profundidad</span><strong>{formatMeters(well.currentLevel)}</strong></div>
                  <div>
                    <span>Variación</span>
                    <strong>{well.dailyChange >= 0 ? "+" : ""}{formatMeters(well.dailyChange)}</strong>
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
        </div>
      </details>
    </div>
  );
}

function WellsIntro() {
  return (
    <div className="view-intro">
      <h2>Pozos y calidad de agua</h2>
      <p>
        Revisa a qué profundidad está el agua en tus pozos, cómo ha cambiado y
        si están enviando datos.
      </p>
    </div>
  );
}
