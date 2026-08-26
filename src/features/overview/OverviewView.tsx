import type { LineSeries } from "../../components/SimpleLineChart";
import type {
  MeteoStationPoint,
  OverviewCard,
  ViewId,
  WellMapPoint,
} from "../../data/mockupData";
import type { RemoteLoadStatus } from "../../types/remote";
import { formatDateTime } from "../../utils/date";
import { freshnessClassMap } from "../../utils/freshness";
import { getCurrentValue, getDailyChangeValue } from "../wells/wellMetrics";
import { OverviewMiniLine } from "./OverviewMiniLine";

type OverviewViewProps = {
  cards: OverviewCard[];
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
};

const freshnessCompactLabelMap = {
  fresh: "OK",
  warning: "Seguim.",
  stale: "Alerta",
} as const;

const productFreshnessLabelMap = {
  fresh: "Actualizado con desfase esperado",
  warning: "Actualización pendiente",
  stale: "Sin actualizacion reciente",
} as const;

const etrFreshnessLabelMap = {
  fresh: "Actualizado (ciclo semanal)",
  warning: "En ventana de actualizacion",
  stale: "Sin actualizacion reciente",
} as const;

export function OverviewView({
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
}: OverviewViewProps) {
  const etrMiniLines = etrSeries.map((line) => ({
    color: line.color,
    label: line.label,
    values: line.points.slice(-12).map((point) => point.value),
  }));
  const etrMiniLabels =
    etrSeries[0]?.points.slice(-12).map((point) => point.label) ?? [];

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
          const isNetworkCard =
            card.targetView === "wells" || card.targetView === "meteo";
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
                      <span
                        className={`overview-mini-delta ${well.dailyChange >= 0 ? "is-up" : "is-down"}`}
                      >
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
