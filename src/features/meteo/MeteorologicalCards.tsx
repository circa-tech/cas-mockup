import type { MeteoDerivedData, MeteoTrend } from "./types";
import { currentDayMetric, formatMeteoValue, formatWindDirection, meteoMetrics } from "./metrics";
import { MeteoTrendLine } from "./MeteoTrendLine";

const labels: Record<string, string> = { mean: "Media", min: "Mínima", max: "Máxima", direction: "Dirección predominante" };

export function MeteorologicalCards({ data, trends, now }: { data?: MeteoDerivedData | null; trends?: Record<string, MeteoTrend>; now: Date }) {
  return <div className="meteo-measurement-grid" aria-label="Indicadores meteorológicos">
    {meteoMetrics.map((definition) => {
      const metric = currentDayMetric(data, definition.key, now);
      return <article className="detail-kpi meteo-derived-card" key={definition.key} data-metric={definition.key}>
        <span>{definition.label}</span>
        <strong>{formatMeteoValue(metric[definition.main], definition.decimals, definition.unit)}</strong>
        <small className="meteo-measurement-sensor">{definition.main === "current" ? "Actual" : "Hoy (hasta ahora)"}</small>
        {definition.stats.length > 0 && <dl className="meteo-daily-statistics">
          {definition.stats.map((stat) => <div key={stat}>
            <dt>{definition.key === "wind" && stat === "gust" ? "Ráfaga máxima" : labels[stat]}{stat === "direction" ? "" : " de hoy"}</dt>
            <dd>{stat === "direction"
              ? formatWindDirection(metric.direction, metric.mean != null)
              : formatMeteoValue(metric[stat], definition.decimals,
                definition.key === "solar_radiation" ? "W/m²" : definition.unit)}</dd>
          </div>)}
          <small>hasta ahora</small>
        </dl>}
        <MeteoTrendLine series={trends?.[definition.key]} label={definition.label} now={now} decimals={definition.decimals} unit={definition.unit} />
      </article>;
    })}
  </div>;
}
