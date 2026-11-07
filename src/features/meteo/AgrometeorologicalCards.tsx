import { formatDate } from "../../utils/date";
import { formatMeteoValue } from "./metrics";
import { frostMonthReading, seasonReading } from "./seasons";
import type { MeteoAgrometeorology } from "./types";

const definitions = [
  { key: "degree_days_5", label: "Grados día · base 5 °C", rule: "degree_days", unit: "°C·día" },
  { key: "degree_days_10", label: "Grados día · base 10 °C", rule: "degree_days", unit: "°C·día" },
  { key: "degree_days_12_5", label: "Grados día · base 12,5 °C", rule: "degree_days", unit: "°C·día" },
  { key: "chill_hours", label: "Horas de frío", rule: "chill_hours", unit: "h" },
  { key: "frost_days", label: "Días con helada", rule: "frost_days", unit: "días" },
];

export function AgrometeorologicalCards({ data, now }: { data?: MeteoAgrometeorology | null; now: Date }) {
  if (!data) return null;
  return <div className="meteo-measurement-grid" aria-label="Indicadores agrometeorológicos">
    {definitions.filter(({ key }) => key !== "chill_hours" || data.chill_hours_supported).map((definition) => {
      const reading = seasonReading(data, definition.key, definition.rule, now);
      const frost = definition.key === "frost_days";
      return <article className="detail-kpi" key={definition.key} data-agrometric={definition.key}>
        <span>{definition.label}</span>
        {reading?.active && <>
          <strong>{formatMeteoValue(frost ? frostMonthReading(data, now) : reading.today, frost ? 0 : 2, definition.unit)}</strong>
          <small className="meteo-measurement-sensor">{frost ? "Mes actual" : "Hoy (hasta ahora)"}</small>
        </>}
        <dl className="meteo-daily-statistics"><div>
          <dt>{reading?.active ? "Temporada" : reading ? `Temporada ${reading.label} cerrada` : "Temporada"}</dt>
          <dd>{formatMeteoValue(reading?.total, frost ? 0 : 2, definition.unit)}</dd>
        </div></dl>
        {reading?.active && reading.includesToday && <small className="meteo-measurement-sensor">incluye hoy (hasta ahora)</small>}
        {reading?.availableFrom && <small className="meteo-measurement-sensor">Datos desde {formatDate(reading.availableFrom)}</small>}
      </article>;
    })}
  </div>;
}
