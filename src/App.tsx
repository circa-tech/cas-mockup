import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { EtrMap } from "./components/EtrMap";
import { MiniSparkline } from "./components/MiniSparkline";
import { SimpleBarChart } from "./components/SimpleBarChart";
import { SimpleLineChart } from "./components/SimpleLineChart";
import { StatusLeafletMap } from "./components/StatusLeafletMap";
import {
  computeOverviewCards,
  etrLastUpdateIso,
  etrOverviewBarGroups,
  etrOverviewSeasonSeries,
  etrRegions,
  etrStats,
  getFreshnessStatus,
  ManualWellEntry,
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

const freshnessClassMap = {
  fresh: "is-good",
  warning: "is-warning",
  stale: "is-danger",
} as const;

const freshnessLabelMap = {
  fresh: "Al dia",
  warning: "Con atraso",
  stale: "Atrasado > 2 dias",
} as const;

const qualityClassMap: Record<WaterQualityStatus, string> = {
  good: "is-good",
  watch: "is-warning",
  alert: "is-danger",
};

const qualityLabelMap: Record<WaterQualityStatus, string> = {
  good: "Buena",
  watch: "Atencion",
  alert: "Alerta",
};

const sourceLabelMap = {
  telemetry: "Telemetria",
  manual: "Manual",
} as const;

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
      {children}
    </section>
  );
}

function SnowChartSummary({ series }: { series: { points: { label: string; value: number }[]; label: string }[] }) {
  const latestIndex = series[0]?.points.length ? series[0].points.length - 1 : 0;
  const latestDate = series[0]?.points[latestIndex]?.label ?? "-";
  const currentValue = series[0]?.points[latestIndex]?.value ?? 0;
  const previousValue = series[1]?.points[latestIndex]?.value ?? 0;

  return (
    <div className="snow-chart-summary">
      <div>
        <span>Fecha</span>
        <strong>{latestDate}</strong>
      </div>
      <div>
        <span>Este ano</span>
        <strong>{currentValue}%</strong>
      </div>
      <div>
        <span>Ano pasado</span>
        <strong>{previousValue}%</strong>
      </div>
    </div>
  );
}

const toChartDateLabel = (date: string) => {
  const parsed = new Date(`${date}T00:00:00`);
  const month = monthLabels[parsed.getMonth()] ?? "N/A";
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${month} ${day}`;
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

  return `Hace ${Math.round(diffMs / day)} dias`;
};

const getCurrentValue = (points: { value: number }[]) =>
  points[points.length - 1]?.value ?? 0;

const getDailyChangeValue = (points: { value: number }[]) => {
  const last = points[points.length - 1]?.value ?? 0;
  const reference = points[Math.max(0, points.length - 2)]?.value ?? last;
  return last - reference;
};

const getRangeValue = (points: { value: number }[]) => {
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

function EtrView() {
  const [selectedRegionId, setSelectedRegionId] = useState(etrRegions[0].id);
  const selectedRegion = useMemo(
    () => etrRegions.find((region) => region.id === selectedRegionId) ?? etrRegions[0],
    [selectedRegionId],
  );

  return (
    <div className="view-stack etr-page">
      <div className="view-intro">
        <h2>Monitoreo de Evapotranspiracion en el Valle de Copiapo</h2>
      </div>

      <div className="stat-grid">
        {etrStats.map((item) => (
          <article key={item.label} className="stat-card">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </div>

      <div className="etr-summary-grid">
        <Panel
          title="Distribucion de ETR (mm) por clase de cultivo en la ultima fecha disponible"
        >
          <SimpleBarChart
            groups={etrOverviewBarGroups}
            maxValue={25}
            tickStep={5}
            unit="mm"
            xLabelAngle={-18}
          />
        </Panel>

        <Panel
          title="Comportamiento de ETR y ETmax en la temporada (mm)"
        >
          <SimpleLineChart
            labelEvery={3}
            maxValue={1.8}
            minValue={0}
            series={etrOverviewSeasonSeries}
            unit="mm"
            xLabelAngle={-45}
          />
        </Panel>
      </div>

      <div className="etr-top-grid">
        <Panel
          title="Mapa sectores y areas de gestion CAS Copiapo"
        >
          <EtrMap
            regions={etrRegions.map((region) => ({
              id: region.id,
              label: region.label,
            }))}
            selectedRegionId={selectedRegionId}
            onSelect={(regionId) => setSelectedRegionId(regionId as typeof selectedRegionId)}
          />
        </Panel>

        <Panel
          title="Distribucion de ETR (mm) por clase de cultivo en la ultima fecha disponible"
          subtitle={selectedRegion.label}
        >
          <SimpleBarChart
            groups={selectedRegion.barGroups}
            maxValue={35}
            tickStep={5}
            unit="mm"
            xLabelAngle={-16}
          />
        </Panel>
      </div>

      <Panel
        title="Variacion temporal de la ETR y ETmax"
        className="panel-accent-blue"
      >
        <SimpleLineChart
          labelEvery={2}
          maxValue={1.8}
          minValue={0}
          series={selectedRegion.seasonSeries}
          unit="mm"
          xLabelAngle={-45}
        />
      </Panel>
    </div>
  );
}

function SnowView() {
  return (
    <div className="view-stack">
      <div className="view-intro">
        <h2>Sistema de Monitoreo de Cobertura Nival</h2>
      </div>

      <div className="snow-grid">
        <Panel
          title="Cobertura nival"
          subtitle="Ultima imagen disponible (2024-08-19)"
        >
          <div className="snow-copy">
            <p>
              La imagen de cobertura nival muestra la presencia o ausencia de nieve
              en la cuenca para una fecha dada.
            </p>
            <p>
              El mockup mantiene solo lo esencial: imagen disponible y series de
              evolucion anual por area de estudio.
            </p>
          </div>

          <div className="snow-image-card">
            <div className="snow-image-placeholder">
              <div className="snow-map-core" />
              <span>Imagen visible / MODIS</span>
            </div>
          </div>
        </Panel>

        <div className="snow-charts">
          <div className="snow-description">
            <h3>Graficas de evolucion diaria de FSCA.</h3>
            <p>
              Los graficos de evolucion diaria de cobertura de nieve (FSCA)
              muestran el porcentaje del area de estudio y de cada cuenca que
              esta cubierta con nieve durante los dias correspondientes al periodo
              humedo (abril-septiembre) del ano actual y el anterior.
            </p>
          </div>

          <Panel
            title="Evolucion diaria de la cobertura de nieve en el area de estudio (%)"
          >
            <SimpleLineChart
              maxValue={100}
              minValue={0}
              series={snowOverviewSeries}
              unit="Cobertura (%)"
            />
            <SnowChartSummary series={snowOverviewSeries} />
          </Panel>

          <Panel
            title="Evolucion diaria de FSCA de la cuenca de Jorquera"
          >
            <SimpleLineChart
              maxValue={100}
              minValue={0}
              series={snowJorqueraSeries}
              unit="Cobertura (%)"
            />
            <SnowChartSummary series={snowJorqueraSeries} />
          </Panel>

          <Panel
            title="Evolucion diaria de FSCA de la cuenca de Pulido"
          >
            <SimpleLineChart
              maxValue={100}
              minValue={0}
              series={snowPulidoSeries}
              unit="Cobertura (%)"
            />
            <SnowChartSummary series={snowPulidoSeries} />
          </Panel>

          <Panel
            title="Evolucion diaria de FSCA de la cuenca de Manflas"
          >
            <SimpleLineChart
              maxValue={100}
              minValue={0}
              series={snowManflasSeries}
              unit="Cobertura (%)"
            />
            <SnowChartSummary series={snowManflasSeries} />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function OverviewView({
  cards,
  onOpenView,
}: {
  cards: ReturnType<typeof computeOverviewCards>;
  onOpenView: (viewId: Exclude<ViewId, "overview">) => void;
}) {
  return (
    <div className="view-stack">
      <div className="view-intro">
        <h2>Resumen operativo</h2>
        <p>Acceso rapido a ET-LAT, MODIS-Snow, Pozos y Meteo.</p>
      </div>
      <div className="overview-grid">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            className="overview-card"
            onClick={() => onOpenView(card.targetView)}
          >
            <div className="overview-card-header">
              <h3>{card.title}</h3>
              <span className={`status-pill ${freshnessClassMap[card.status]}`}>
                {freshnessLabelMap[card.status]}
              </span>
            </div>
            <strong>{card.primaryKpi}</strong>
            <p>{card.secondaryKpi}</p>
            <small>Ultima actualizacion: {formatDateTime(card.lastUpdate)}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function WellsView({
  manualEntries,
  manualForm,
  now,
  onManualChange,
  onManualSubmit,
  onSelectWell,
  selectedWellId,
  wells,
}: {
  manualEntries: ManualWellEntry[];
  manualForm: ManualFormState;
  now: Date;
  onManualChange: (next: Partial<ManualFormState>) => void;
  onManualSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSelectWell: (wellId: string) => void;
  selectedWellId: string;
  wells: WellMapPoint[];
}) {
  const waterByWell = useMemo(
    () => new Map(waterQualityRecords.map((record) => [record.wellId, record])),
    [],
  );
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
  const minSeriesValue = Math.min(...seriesValues) - 0.1;
  const maxSeriesValue = Math.max(...seriesValues) + 0.1;

  return (
    <div className="view-stack">
      <div className="view-intro">
        <h2>Pozos y calidad de agua</h2>
        <p>
          Mapa operativo con estado por frescura de dato, fuente de captura y panel
          de detalle por pozo.
        </p>
      </div>

      <div className="stat-grid">
        <article className="stat-card">
          <span>Pozos al dia</span>
          <strong>{wellsFreshCount}/{wells.length}</strong>
          <small>{wellsStaleCount} en rojo por atraso mayor a 2 dias</small>
        </article>
        <article className="stat-card">
          <span>Pozos con carga manual</span>
          <strong>{manualWells}</strong>
          <small>Lecturas diarias desde mobile/tablet</small>
        </article>
        <article className="stat-card">
          <span>Calidad en alerta</span>
          <strong>{waterAlerts}</strong>
          <small>Muestras de calidad de agua fuera de rango</small>
        </article>
        <article className="stat-card">
          <span>Ultima sincronizacion global</span>
          <strong>{formatDateTime(maxUpdate)}</strong>
          <small>{formatRelativeAge(maxUpdate, now)}</small>
        </article>
      </div>

      <div className="map-detail-grid">
        <Panel
          title="Mapa de pozos (Copiapo)"
          subtitle="Rojo: sin actualizar por mas de 2 dias · Borde punteado: carga manual"
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
            <span><i className="legend-dot fresh" /> Al dia</span>
            <span><i className="legend-dot warning" /> Con atraso</span>
            <span><i className="legend-dot stale" /> Atrasado &gt; 2 dias</span>
            <span><i className="legend-dot quality-alert" /> Calidad en alerta</span>
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
              <span>Rango periodo</span>
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
                <span>Ultima muestra: {selectedQuality.lastSampleDate}</span>
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
          title="Comparacion rapida de pozos"
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
                <MiniSparkline points={well.levelSeries.map((point) => point.value)} color="#f26d3d" />
                <span className={`status-pill ${freshnessClassMap[well.status]}`}>
                  {freshnessLabelMap[well.status]}
                </span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel
          title="Carga manual diaria (mobile/tablet)"
          subtitle="Solo para pozos sin telemetria"
        >
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
              <span>Observacion corta</span>
              <input
                type="text"
                value={manualForm.note}
                onChange={(event) => onManualChange({ note: event.target.value })}
              />
            </label>

            <div className="manual-source-pill">Origen: mobile/tablet</div>
            <button type="submit">Guardar registro manual</button>
          </form>

          <div className="manual-history">
            <h4>Ultimas cargas</h4>
            {manualEntries.length === 0 && <p>No hay cargas manuales en esta sesion.</p>}
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
      </div>

      <Panel
        title={`Variacion temporal: ${selectedWell.name}`}
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
              color: "#f26d3d",
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
  now,
  onSelectStation,
  selectedStationId,
  stations,
}: {
  now: Date;
  onSelectStation: (stationId: string) => void;
  selectedStationId: string;
  stations: typeof meteoStationPoints;
}) {
  const selectedStation = stations.find((station) => station.id === selectedStationId) ?? stations[0];
  const stationsFreshCount = stations.filter((station) => station.status !== "stale").length;
  const stationsStaleCount = stations.filter((station) => station.status === "stale").length;
  const latestSync = stations.reduce((latest, station) => {
    if (!latest) {
      return station.lastUpdate;
    }

    return new Date(station.lastUpdate).getTime() > new Date(latest).getTime()
      ? station.lastUpdate
      : latest;
  }, "");

  return (
    <div className="view-stack">
      <div className="view-intro">
        <h2>Estaciones meteorologicas</h2>
        <p>Tres estaciones con datos individuales y estado de actualizacion por punto.</p>
      </div>

      <div className="stat-grid">
        <article className="stat-card">
          <span>Estaciones al dia</span>
          <strong>{stationsFreshCount}/3</strong>
          <small>{stationsStaleCount} en rojo por atraso mayor a 2 dias</small>
        </article>
        <article className="stat-card">
          <span>Ultima sincronizacion global</span>
          <strong>{formatDateTime(latestSync)}</strong>
          <small>{formatRelativeAge(latestSync, now)}</small>
        </article>
        <article className="stat-card">
          <span>Temperatura media red</span>
          <strong>
            {(stations.reduce((total, station) => total + station.temperatureValue, 0) / stations.length).toFixed(1)}
            °C
          </strong>
          <small>Promedio simple de las 3 estaciones</small>
        </article>
      </div>

      <div className="map-detail-grid">
        <Panel title="Mapa de estaciones (Copiapo)" subtitle="Rojo: sin actualizar por mas de 2 dias">
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
              <span>Presion</span>
              <strong>{selectedStation.pressureValue.toFixed(0)} hPa</strong>
            </article>
          </div>

          <div className="status-row">
            <span className={`status-pill ${freshnessClassMap[selectedStation.status]}`}>
              {freshnessLabelMap[selectedStation.status]}
            </span>
            <span className="status-pill is-neutral">Fuente: Telemetria</span>
          </div>
        </Panel>
      </div>

      <div className="station-card-grid">
        {stations.map((station) => (
          <button
            key={station.id}
            type="button"
            className={`station-card ${selectedStationId === station.id ? "is-selected" : ""}`}
            onClick={() => onSelectStation(station.id)}
          >
            <div className="station-card-head">
              <strong>{station.name}</strong>
              <span className={`status-pill ${freshnessClassMap[station.status]}`}>
                {freshnessLabelMap[station.status]}
              </span>
            </div>
            <div className="station-card-metrics">
              <span>Temp {station.temperatureValue.toFixed(1)}°C</span>
              <span>HR {station.humidityValue.toFixed(0)}%</span>
              <span>Viento {station.windValue.toFixed(1)} km/h</span>
              <span>Presion {station.pressureValue.toFixed(0)} hPa</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const defaultManualWellId =
    wellMapPoints.find((well) => well.sourceType === "manual")?.id ?? wellMapPoints[0].id;
  const [activeView, setActiveView] = useState<ViewId>("overview");
  const [selectedWellId, setSelectedWellId] = useState(wellMapPoints[0].id);
  const [selectedStationId, setSelectedStationId] = useState(meteoStationPoints[0].id);
  const [manualEntries, setManualEntries] = useState<ManualWellEntry[]>([]);
  const [wellState, setWellState] = useState(wellMapPoints);
  const [manualForm, setManualForm] = useState<ManualFormState>({
    wellId: defaultManualWellId,
    date: "2026-03-22",
    time: "10:30",
    level: "",
    operator: "Operador CAS",
    note: "",
  });

  const dashboardNow = useMemo(() => {
    const seed = new Date(mockNowIso).getTime();
    const manualTimes = manualEntries.map((entry) =>
      new Date(`${entry.date}T${entry.time}:00-03:00`).getTime(),
    );
    return new Date(Math.max(seed, ...manualTimes));
  }, [manualEntries]);

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
      meteoStationPoints.map((station) => ({
        ...station,
        status: getFreshnessStatus(
          station.lastUpdate,
          dashboardNow,
          staleThresholdDaysDefault,
        ),
      })),
    [dashboardNow],
  );

  useEffect(() => {
    if (!wells.some((well) => well.id === selectedWellId)) {
      setSelectedWellId(wells[0].id);
    }
  }, [selectedWellId, wells]);

  useEffect(() => {
    if (!stations.some((station) => station.id === selectedStationId)) {
      setSelectedStationId(stations[0].id);
    }
  }, [selectedStationId, stations]);

  const overviewCards = useMemo(
    () =>
      computeOverviewCards({
        etrLastDate: "2025-10-09",
        etrLastUpdate: etrLastUpdateIso,
        etrMeanValue: 1.2,
        now: dashboardNow,
        snowLastUpdate: snowLastUpdateIso,
        snowSeries: snowOverviewSeries,
        stations,
        wells,
      }),
    [dashboardNow, stations, wells],
  );

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

  return (
    <div className="page-shell">
      <header className="site-header">
        <div>
          <h1>Agua con Dato</h1>
          <p>
            Mockup unificado para ET-LAT, MODIS-Snow, Pozos y Meteo sobre una
            infraestructura comun.
          </p>
        </div>
        <div className="site-tag">
          Dummy data funcional con foco en usabilidad operativa y lectura rapida.
        </div>
      </header>

      <nav className="top-nav" aria-label="Views">
        {views.map((view) => (
          <button
            key={view.id}
            type="button"
            className={view.id === activeView ? "is-active" : ""}
            onClick={() => setActiveView(view.id)}
          >
            {view.label}
          </button>
        ))}
      </nav>

      <main className="content-shell">
        {activeView === "overview" && (
          <OverviewView
            cards={overviewCards}
            onOpenView={(viewId) => setActiveView(viewId)}
          />
        )}
        {activeView === "etr" && <EtrView />}
        {activeView === "snow" && <SnowView />}
        {activeView === "wells" && (
          <WellsView
            manualEntries={manualEntries}
            manualForm={manualForm}
            now={dashboardNow}
            onManualChange={(next) => setManualForm((previous) => ({ ...previous, ...next }))}
            onManualSubmit={handleManualSubmit}
            onSelectWell={setSelectedWellId}
            selectedWellId={selectedWellId}
            wells={wells}
          />
        )}
        {activeView === "meteo" && (
          <MeteoView
            now={dashboardNow}
            onSelectStation={setSelectedStationId}
            selectedStationId={selectedStationId}
            stations={stations}
          />
        )}
      </main>
    </div>
  );
}
