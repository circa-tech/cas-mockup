import { Droplets, Gauge, Radio, Waves } from "lucide-react";
import { type ReactNode, useState } from "react";
import { KpiCard } from "../../components/KpiCard";
import { MiniSparkline } from "../../components/MiniSparkline";
import { Panel } from "../../components/Panel";
import { RemoteDataState } from "../../components/RemoteDataState";
import { SimpleLineChart, type LinePoint, type LineSeries } from "../../components/SimpleLineChart";
import { StatusLeafletMap } from "../../components/StatusLeafletMap";
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
  errorMessage: string | null;
  isLoggedIn: boolean;
  now: Date;
  onSelectWell: (wellId: string) => void;
  selectedWellId: string;
  status: RemoteLoadStatus;
  subnav: ReactNode;
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
const measurementSourceOptions: { value: MeasurementSource; label: string }[] = [
  { value: "api", label: "Medición API" },
  { value: "manual", label: "Medición manual" },
];
const levelConditionOptions: { value: LevelCondition; label: string; color: string }[] = [
  { value: "static", label: "Nivel estático", color: chartPalette.chart5 },
  { value: "dynamic", label: "Nivel dinámico", color: chartPalette.chart3 },
  { value: "unknown", label: "Sin clasificar", color: chartPalette.chart7 },
];

const formatMeters = (value: number) =>
  `${new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} m`;

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
  selectedConditions: LevelCondition[],
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
    const visiblePoints = points.filter((point) =>
      selectedConditions.includes(point.condition ?? "unknown"),
    );
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

export function WellsMonitoringTab({
  errorMessage,
  isLoggedIn,
  now,
  onSelectWell,
  selectedWellId,
  status,
  subnav,
  wells,
}: WellsMonitoringTabProps) {
  const [selectedSecondaryVariables, setSelectedSecondaryVariables] = useState<WellMeasurementVariable[]>([]);
  const [selectedLevelConditions, setSelectedLevelConditions] = useState<LevelCondition[]>([
    "static", "dynamic", "unknown",
  ]);
  const [selectedMeasurementSources, setSelectedMeasurementSources] = useState<MeasurementSource[]>([
    "api", "manual",
  ]);

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
  const waterByWell = new Map(waterQualityRecords.map((record) => [record.wellId, record]));
  const selectedQuality = waterByWell.get(selectedWell.id);
  const wellRows = wells.map((well) => ({
    ...well,
    currentLevel: getCurrentValue(well.levelSeries),
    dailyChange: getDailyChangeValue(well.levelSeries),
    qualityStatus: waterByWell.get(well.id)?.qualityStatus,
  }));
  const wellsFreshCount = wells.filter((well) => well.status !== "stale").length;
  const wellsStaleCount = wells.filter((well) => well.status === "stale").length;
  const manualWells = wells.filter((well) => well.sourceType === "manual").length;
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
  const primaryChartSeries = toLevelChartSeries(
    selectedWell,
    selectedLevelConditions,
    selectedMeasurementSources,
  );
  const secondaryChartSeries = secondaryChartVariables
    .filter((variable) => selectedSecondaryVariables.includes(variable.value))
    .flatMap((variable) => toVariableChartSeries(selectedWell, variable, selectedMeasurementSources));
  const selectedChartSeries = [...primaryChartSeries, ...secondaryChartSeries];
  const chartLabelCount = new Set(
    selectedChartSeries.flatMap((item) => item.points.map((point) => point.label)),
  ).size;
  const [minSeriesValue, maxSeriesValue] = getSeriesDomain(primaryChartSeries);
  const [minSecondaryValue, maxSecondaryValue] = getSeriesDomain(secondaryChartSeries);
  const dailyChange = getDailyChangeValue(selectedWell.levelSeries);
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
          title="Mapa de pozos"
          subtitle="Color = antigüedad del último dato (no el estado del agua)"
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
            <span><i className="legend-dot fresh" /> Al día (menos de 24 h)</span>
            <span><i className="legend-dot warning" /> Atrasado (1 a 2 días)</span>
            <span><i className="legend-dot stale" /> Sin datos (más de 2 días)</span>
            <span><i className="legend-dot quality-alert" /> ! Alerta de calidad</span>
          </div>
        </Panel>

        <Panel
          title={`${selectedWell.name} · ${selectedWell.aquiferSector.replace(/^Acuífero\s+/i, "Sector ")} · datos de ${selectedWell.provider}`}
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
              <span>{formatSeriesPeriod(selectedWell.levelSeries)}</span>
              <strong>{formatMeters(getRangeValue(selectedWell.levelSeries))}</strong>
            </article>
          </div>

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

      <div className="detail-grid">
        <Panel
          title="Todos los pozos"
          subtitle="Toca un pozo para ver su detalle"
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
        </Panel>
      </div>

      <Panel
        title={`Nivel freático y otras variables · ${selectedWell.name}`}
        subtitle="Profundidad en metros bajo el suelo; los valores mayores indican mayor profundidad."
      >
        <fieldset className="well-chart-variable-selector">
          <legend>Origen de las mediciones</legend>
          <div className="well-chart-variable-options">
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
        </fieldset>
        <fieldset className="well-chart-variable-selector">
          <legend>Variables del eje secundario</legend>
          <div className="well-chart-variable-options">
            {secondaryChartVariables.map((variable) => (
              <label key={variable.value}>
                <input
                  type="checkbox"
                  checked={selectedSecondaryVariables.includes(variable.value)}
                  onChange={(event) => {
                    setSelectedSecondaryVariables((current) => event.target.checked
                      ? [...current, variable.value]
                      : current.filter((selected) => selected !== variable.value));
                  }}
                />
                <span>{variable.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="well-chart-variable-selector">
          <legend>Condiciones del nivel freático</legend>
          <div className="well-chart-variable-options">
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
                <span className="well-chart-condition-option">
                  <i aria-hidden="true" style={{ backgroundColor: condition.color }} />
                  {condition.label}
                </span>
              </label>
            ))}
          </div>
          <p>El trazo distingue API y manual; el color del punto indica la condición seleccionada.</p>
        </fieldset>
        {selectedChartSeries.length > 0 ? (
          <SimpleLineChart
            labelEvery={Math.max(1, Math.ceil(chartLabelCount / 18))}
            maxValue={maxSeriesValue}
            minValue={minSeriesValue}
            mode="linear"
            primaryAxisReversed
            series={selectedChartSeries}
            primaryAxisLabel="Profundidad (m)"
            secondaryMaxValue={maxSecondaryValue}
            secondaryMinValue={minSecondaryValue}
            unit="m"
            xLabelAngle={-40}
          />
        ) : (
          <p className="well-chart-no-data" role="status">
            No hay mediciones de nivel freático para este pozo.
          </p>
        )}
      </Panel>
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
