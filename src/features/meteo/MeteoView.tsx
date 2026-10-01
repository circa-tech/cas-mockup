import { CloudRain, CloudSun, Sun } from "lucide-react";
import { Panel } from "../../components/Panel";
import { RemoteDataState } from "../../components/RemoteDataState";
import { StatusLeafletMap } from "../../components/StatusLeafletMap";
import type { MeteoStationPoint } from "../../data/mockupData";
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

const formatOneDecimal = (value: number) =>
  new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);

const formatInteger = (value: number) =>
  new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(value);

const getStationWeatherSummary = (station: MeteoStationPoint) => {
  if (
    station.humidityValue >= 52 ||
    (station.temperatureValue <= 15.5 && station.humidityValue >= 47)
  ) {
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
                <span>Temperatura {formatOneDecimal(station.temperatureValue)} °C</span>
                <span>Humedad {formatInteger(station.humidityValue)} %</span>
                <span>Viento {formatOneDecimal(station.windValue)} km/h</span>
                <span>Presión {formatInteger(station.pressureValue)} hPa</span>
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
          subtitle={`Medición de las ${selectedStationUpdate.time} del ${selectedStationUpdate.date} (${formatRelativeAge(selectedStation.lastUpdate, now).toLocaleLowerCase("es-CL")})`}
        >
          <div className="detail-kpi-grid">
            <article className="detail-kpi">
              <span>Temperatura</span>
              <strong>{formatOneDecimal(selectedStation.temperatureValue)} °C</strong>
            </article>
            <article className="detail-kpi">
              <span>Humedad</span>
              <strong>{formatInteger(selectedStation.humidityValue)} %</strong>
            </article>
            <article className="detail-kpi">
              <span>Viento</span>
              <strong>{formatOneDecimal(selectedStation.windValue)} km/h</strong>
            </article>
            <article className="detail-kpi">
              <span>Presión</span>
              <strong>{formatInteger(selectedStation.pressureValue)} hPa</strong>
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
