import { CloudRain, CloudSun, Sun } from "lucide-react";
import { Panel } from "../../components/Panel";
import { RemoteDataState } from "../../components/RemoteDataState";
import { StatusLeafletMap } from "../../components/StatusLeafletMap";
import type { MeteoStationPoint } from "../../data/mockupData";
import type { RemoteLoadStatus } from "../../types/remote";
import { formatDateTime, formatRelativeAge } from "../../utils/date";
import { freshnessClassMap, freshnessLabelMap } from "../../utils/freshness";

type MeteoViewProps = {
  errorMessage: string | null;
  isLoggedIn: boolean;
  now: Date;
  onSelectStation: (stationId: string) => void;
  selectedStationId: string;
  stations: MeteoStationPoint[];
  status: RemoteLoadStatus;
};

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
  errorMessage,
  isLoggedIn,
  now,
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
          <h2>Estaciones meteorológicas</h2>
          <p>Estaciones con datos individuales y estado de actualización por punto.</p>
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

  const selectedStation =
    stations.find((station) => station.id === selectedStationId) ?? stations[0];

  return (
    <div className="view-stack">
      <div className="view-intro">
        <h2>Estaciones meteorológicas</h2>
        <p>Estaciones con datos individuales y estado de actualización por punto.</p>
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

        <Panel
          title={selectedStation.name}
          subtitle={`${formatRelativeAge(selectedStation.lastUpdate, now)} · ${formatDateTime(selectedStation.lastUpdate)}`}
        >
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
