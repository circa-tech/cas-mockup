import { Panel } from "../../components/Panel";
import { RemoteDataState } from "../../components/RemoteDataState";
import { StatusLeafletMap } from "../../components/StatusLeafletMap";
import type { MeteoMeasurement, MeteoStationPoint } from "../../data/mockupData";
import type { RemoteLoadStatus } from "../../types/remote";
import { formatRelativeAge, formatShortDateTimeParts } from "../../utils/date";
import { freshnessClassMap, freshnessLabelMap } from "../../utils/freshness";

type MeteoViewProps = {
  isLoggedIn: boolean;
  now: Date;
  onRetry: () => void;
  onSelectStation: (stationId: string) => void;
  selectedStationId: string;
  stations: MeteoStationPoint[];
  status: RemoteLoadStatus;
};

type DisplayedMeasurement = {
  key: string;
  label: string;
  measurement: MeteoMeasurement | null;
};

const displayedVariables = [
  { name: "Air Temperature", aliases: ["air temperature"] },
  { name: "Atmospheric Pressure", aliases: ["atmospheric pressure"] },
  { name: "Gust Speed", aliases: ["gust speed"] },
  { name: "Max Precip Rate", aliases: ["max precip rate"] },
  { name: "Precipitation", aliases: ["precipitation"] },
  { name: "Reference Pressure", aliases: ["reference pressure"] },
  { name: "Soil Temperature", aliases: ["soil temperature"] },
  { name: "Solar Radiation", aliases: ["solar radiation"] },
  { name: "Vapor Pressure", aliases: ["vapor pressure"] },
  { name: "VPD", aliases: ["vpd", "vapor pressure deficit"] },
  { name: "Water Content", aliases: ["water content"] },
  { name: "Wind Direction", aliases: ["wind direction"] },
  { name: "Wind Speed", aliases: ["wind speed"] },
] as const;

const normalizeMeasurementName = (name: string) => name.trim().toLocaleLowerCase("en");

const getDisplayedMeasurements = (measurements: MeteoMeasurement[]): DisplayedMeasurement[] =>
  displayedVariables.flatMap<DisplayedMeasurement>((variable) => {
    const matches = measurements.filter((measurement) => {
      const measurementName = normalizeMeasurementName(measurement.measurementName);
      return variable.aliases.some((alias) => alias === measurementName);
    });
    return matches.length > 0
      ? matches.map((measurement, index) => ({
        key: `${variable.name}-${measurement.portNumber ?? "port"}-${index}`,
        label: variable.name,
        measurement,
      }))
      : [{ key: variable.name, label: variable.name, measurement: null }];
  });

const formatMeasurementValue = (value: number | null) =>
  value === null ? "Sin datos" : new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(value);

const getMeasurement = (station: MeteoStationPoint, name: string) =>
  station.measurements.find(
    (measurement) => normalizeMeasurementName(measurement.measurementName) === normalizeMeasurementName(name),
  ) ?? null;

const formatCompactMeasurement = (measurement: MeteoMeasurement | null) =>
  measurement === null
    ? "Sin datos"
    : `${formatMeasurementValue(measurement.value)}${measurement.unit ? ` ${measurement.unit}` : ""}`;

const formatMeasurementSource = (measurement: MeteoMeasurement, now: Date) => {
  const source = [
    measurement.sensorName,
    measurement.portNumber === null ? null : `Puerto ${measurement.portNumber}`,
  ].filter(Boolean).join(" · ");
  if (!measurement.recordedAt) return source;

  const timestamp = formatShortDateTimeParts(measurement.recordedAt);
  const age = formatRelativeAge(measurement.recordedAt, now).toLocaleLowerCase("es-CL");
  return [source, `${timestamp.date} ${timestamp.time} · ${age}`].filter(Boolean).join(" · ");
};

export function MeteoView({
  isLoggedIn,
  now,
  onRetry,
  onSelectStation,
  selectedStationId,
  stations,
  status,
}: MeteoViewProps) {
  if (isLoggedIn && (status === "loading" || status === "error" || stations.length === 0)) {
    const isLoading = status === "loading";

    return (
      <div className="view-stack">
        <div className="view-intro">
          <h2>Clima en el valle</h2>
          <p>Últimas mediciones de las estaciones meteorológicas del valle. Toca una estación para ver su detalle.</p>
        </div>

        <section className="panel">
          <RemoteDataState
            message={isLoading ? undefined : "Inténtalo de nuevo en unos minutos."}
            title={isLoading ? "Cargando estaciones…" : "No pudimos cargar las estaciones."}
            tone={isLoading ? "loading" : "error"}
          />
          {!isLoading && (
            <div className="meteo-retry-action">
              <button type="button" onClick={onRetry}>Reintentar</button>
            </div>
          )}
        </section>
      </div>
    );
  }

  const selectedStation =
    stations.find((station) => station.id === selectedStationId) ?? stations[0];
  const selectedStationUpdate = formatShortDateTimeParts(selectedStation.lastUpdate);

  return (
    <div className="view-stack">
      <div className="view-intro">
        <h2>Clima en el valle</h2>
        <p>Últimas mediciones de las estaciones meteorológicas del valle. Toca una estación para ver su detalle.</p>
      </div>

      <div className="station-card-grid">
        {stations.map((station) => {
          return (
            <button
              key={station.id}
              type="button"
              className={`station-card ${selectedStationId === station.id ? "is-selected" : ""}`}
              onClick={() => onSelectStation(station.id)}
            >
              <div className="station-card-head">
                <div className="station-card-title"><strong>{station.name}</strong></div>
                <span className={`status-pill ${freshnessClassMap[station.status]}`}>
                  {freshnessLabelMap[station.status]}
                </span>
              </div>
              <div className="station-card-metrics">
                <span>Air Temperature {formatCompactMeasurement(getMeasurement(station, "Air Temperature"))}</span>
                <span>Wind Speed {formatCompactMeasurement(getMeasurement(station, "Wind Speed"))}</span>
                <span>Atmospheric Pressure {formatCompactMeasurement(getMeasurement(station, "Atmospheric Pressure"))}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="map-detail-grid">
        <Panel
          title="Mapa de estaciones"
          subtitle="Color = antigüedad del último dato"
        >
          <StatusLeafletMap
            points={stations.map((station) => ({
              id: station.id,
              iconType: "weather-station",
              name: station.name,
              lat: station.lat,
              lng: station.lng,
              status: station.status,
              sourceType: station.sourceType,
              lastUpdate: station.lastUpdate,
            }))}
            selectedPointId={selectedStationId}
            selectedPointZoom={15}
            onSelect={onSelectStation}
          />
          <div className="map-legend">
            <span><i className="legend-dot fresh" /> Al día (menos de 24 h)</span>
            <span><i className="legend-dot warning" /> Atrasado (1 a 2 días)</span>
            <span><i className="legend-dot stale" /> Sin datos (más de 2 días)</span>
          </div>
        </Panel>

        <Panel
          title={selectedStation.name}
          subtitle={selectedStation.lastUpdate === "Sin datos"
            ? "Sin datos disponibles"
            : `Medición de las ${selectedStationUpdate.time} del ${selectedStationUpdate.date} (${formatRelativeAge(selectedStation.lastUpdate, now).toLocaleLowerCase("es-CL")})`}
        >
          <div className="meteo-measurement-grid">
            {getDisplayedMeasurements(selectedStation.measurements).map(({ key, label, measurement }) => (
              <article className="detail-kpi" key={key}>
                <span>{label}</span>
                <strong>
                  {formatMeasurementValue(measurement?.value ?? null)}
                  {measurement?.unit ? ` ${measurement.unit}` : ""}
                </strong>
                {measurement && formatMeasurementSource(measurement, now) && (
                  <small className="meteo-measurement-source">
                    {formatMeasurementSource(measurement, now)}
                  </small>
                )}
              </article>
            ))}
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
