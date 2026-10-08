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

const toLevelChartSeries = (well: WellMapPoint): LineSeries[] => {
  const manualSeries = well.levelSeriesBySource?.manual ?? [];
  const telemetrySeries = well.levelSeriesBySource?.telemetry ?? [];
  const separatedSeries = [
    ...(manualSeries.length > 0
      ? [{ label: "Medición manual", color: chartPalette.chart5, points: manualSeries }]
      : []),
    ...(telemetrySeries.length > 0
      ? [{
          label: "Telemetría (automática)",
          color: chartPalette.chart6,
          points: telemetrySeries,
        }]
      : []),
  ];

  if (separatedSeries.length > 0) {
    return separatedSeries;
  }

  if (well.levelSeries.length === 0) return [];

  return [{
    label: sourceLabelMap[well.sourceType],
    color: chartPalette.chart6,
    points: well.levelSeries,
  }];
};

const toVariableChartSeries = (well: WellMapPoint, variable: WellMeasurementVariable): LineSeries[] => {
  if (variable === "waterTableDepth") return toLevelChartSeries(well);

  const points = well.measurementSeriesByVariable?.[variable];
  if (!points) return [];

  const separatedSeries: LineSeries[] = [
    ...(points.manual.length > 0
      ? [{ label: "Medición manual", color: chartPalette.chart5, points: points.manual }]
      : []),
    ...(points.telemetry.length > 0
      ? [{ label: "Telemetría (automática)", color: chartPalette.chart6, points: points.telemetry }]
      : []),
  ];
  return separatedSeries.length > 0
    ? separatedSeries
    : points.all.length > 0
      ? [{ label: sourceLabelMap[well.sourceType], color: chartPalette.chart6, points: points.all }]
      : [];
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
  const [selectedChartVariable, setSelectedChartVariable] = useState<WellMeasurementVariable>("waterTableDepth");

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
  const chartVariable = chartVariables.find((item) => item.value === selectedChartVariable)!;
  const selectedChartSeries = toVariableChartSeries(selectedWell, selectedChartVariable);
  const seriesValues = selectedChartSeries.flatMap((series) =>
    series.points.map((point) => point.value),
  );
  const minSeriesValue = seriesValues.length > 0 ? Math.min(...seriesValues) - 0.1 : -0.1;
  const maxSeriesValue = seriesValues.length > 0 ? Math.max(...seriesValues) + 0.1 : 0.1;
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
        title={`${chartVariable.label} en el tiempo · ${selectedWell.name}`}
      >
        <label className="well-chart-variable-selector">
          <span>Variable del gráfico</span>
          <select
            value={selectedChartVariable}
            onChange={(event) => setSelectedChartVariable(event.target.value as WellMeasurementVariable)}
          >
            {chartVariables.map((variable) => (
              <option key={variable.value} value={variable.value}>{variable.label}</option>
            ))}
          </select>
        </label>
        {selectedChartSeries.length > 0 ? (
          <SimpleLineChart
            labelEvery={1}
            maxValue={maxSeriesValue}
            minValue={minSeriesValue}
            mode="linear"
            series={selectedChartSeries}
            unit={chartVariable.unit}
            xLabelAngle={-40}
          />
        ) : (
          <p className="well-chart-no-data" role="status">
            No hay mediciones de {chartVariable.label.toLocaleLowerCase("es-CL")} para este pozo.
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
