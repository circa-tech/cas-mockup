import { Droplets, Gauge, Radio, Waves } from "lucide-react";
import type { ReactNode } from "react";
import { KpiCard } from "../../components/KpiCard";
import { MiniSparkline } from "../../components/MiniSparkline";
import { Panel } from "../../components/Panel";
import { RemoteDataState } from "../../components/RemoteDataState";
import { SimpleLineChart, type LineSeries } from "../../components/SimpleLineChart";
import { StatusLeafletMap } from "../../components/StatusLeafletMap";
import {
  chartPalette,
  waterQualityRecords,
  type WaterQualityStatus,
  type WellMapPoint,
} from "../../data/mockupData";
import type { RemoteLoadStatus } from "../../types/remote";
import { formatDateTime, formatRelativeAge } from "../../utils/date";
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
  telemetry: "Telemetría",
  manual: "Manual",
} as const;

const toLevelChartSeries = (well: WellMapPoint): LineSeries[] => {
  const manualSeries = well.levelSeriesBySource?.manual ?? [];
  const telemetrySeries = well.levelSeriesBySource?.telemetry ?? [];
  const separatedSeries = [
    ...(manualSeries.length > 0
      ? [{ label: "Manual", color: chartPalette.chart5, points: manualSeries }]
      : []),
    ...(telemetrySeries.length > 0
      ? [{
          label: "API / Telemetría",
          color: chartPalette.chart6,
          points: telemetrySeries,
        }]
      : []),
  ];

  if (separatedSeries.length > 0) {
    return separatedSeries;
  }

  return [{
    label: well.name,
    color: chartPalette.chart6,
    points: well.levelSeries,
  }];
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
  const waterAlerts = waterQualityRecords.filter(
    (record) => record.qualityStatus === "alert",
  ).length;
  const maxUpdate = wells.reduce((latest, well) => {
    if (!latest) {
      return well.lastUpdate;
    }
    return new Date(well.lastUpdate).getTime() > new Date(latest).getTime()
      ? well.lastUpdate
      : latest;
  }, "");
  const levelChartSeries = toLevelChartSeries(selectedWell);
  const seriesValues = levelChartSeries.flatMap((series) =>
    series.points.map((point) => point.value),
  );
  const minSeriesValue = seriesValues.length > 0 ? Math.min(...seriesValues) - 0.1 : -0.1;
  const maxSeriesValue = seriesValues.length > 0 ? Math.max(...seriesValues) + 0.1 : 0.1;
  const dailyChange = getDailyChangeValue(selectedWell.levelSeries);
  return (
    <div className="view-stack">
      <WellsIntro />
      {subnav}

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
              <strong>{dailyChange >= 0 ? "+" : ""}{dailyChange.toFixed(2)} m</strong>
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
                  <div><span>Nivel</span><strong>{well.currentLevel.toFixed(2)} m</strong></div>
                  <div>
                    <span>Cambio diario</span>
                    <strong>{well.dailyChange >= 0 ? "+" : ""}{well.dailyChange.toFixed(2)} m</strong>
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
        title={`Variación temporal: ${selectedWell.name}`}
        subtitle={`Cambio diario ${dailyChange >= 0 ? "+" : ""}${dailyChange.toFixed(2)} m`}
      >
        <SimpleLineChart
          labelEvery={1}
          maxValue={maxSeriesValue}
          minValue={minSeriesValue}
          mode="linear"
          series={levelChartSeries}
          unit="m"
          xLabelAngle={-40}
        />
      </Panel>
    </div>
  );
}

function WellsIntro() {
  return (
    <div className="view-intro">
      <h2>Pozos y calidad de agua</h2>
      <p>
        Mapa operativo con estado por frescura de dato, fuente de captura y panel
        de detalle por pozo.
      </p>
    </div>
  );
}
