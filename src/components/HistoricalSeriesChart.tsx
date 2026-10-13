import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { Brush, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { authQueryScope } from "../lib/queryClient";
import { OfflineDataUnavailableError } from "../offline/apiFetch";
import { ApiRequestError } from "../services/apiError";
import { fetchHistory } from "../services/historyApi";
import { HISTORY_START, historyPreset, validHistoryRange, zoomHistoryRange, type HistoryRange } from "../utils/history";
import { RemoteDataState } from "./RemoteDataState";

type Props = {
  authIdToken: string | null;
  module: "et-lat" | "modis-snow";
  selection?: Record<string, string | number>;
};

const dateLabel = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString("es-CL", { timeZone: "UTC" });

export function HistoricalSeriesChart({ authIdToken, module, selection = {} }: Props) {
  const id = useId();
  const [range, setRange] = useState<HistoryRange>(() => historyPreset(1));
  const [draft, setDraft] = useState(range);
  const [zoom, setZoom] = useState<{ startIndex?: number; endIndex?: number }>();
  const today = new Date().toISOString().slice(0, 10);
  const params = { ...selection, ...range, resolution: "auto", max_points: 1200 };
  const query = useQuery({
    queryKey: ["history", authQueryScope(authIdToken), module, params],
    queryFn: ({ signal }) => fetchHistory(module, params, authIdToken, signal),
    staleTime: 5 * 60 * 1000,
    retry: (count, error) => !(error instanceof OfflineDataUnavailableError)
      && !(error instanceof ApiRequestError && [401, 403, 404, 422].includes(error.status)) && count < 1,
  });
  const applyRange = (next: HistoryRange) => {
    setRange(next);
    setDraft(next);
    setZoom(undefined);
  };
  const metrics = module === "et-lat"
    ? [{ key: "etr", label: "Consumo real (ETR)", color: "#147ca6" }, { key: "etmax", label: "Consumo máximo (ETmax)", color: "#dc8a31" }]
    : [{ key: "coverage", label: "Cobertura de nieve", color: "#147ca6" }];
  const unit = module === "et-lat" ? "mm/día" : "%";
  const points = query.data?.points ?? [];
  const rows = points.map((point) => ({ ...point.values, fecha: point.fecha, timestamp: Date.parse(`${point.fecha}T00:00:00Z`) }));
  const hasValues = points.some((point) => Object.values(point.values).some((value) => value !== null));
  const monthly = query.data?.resolution === "monthly";
  const hasZoom = zoom?.startIndex !== undefined && zoom.endIndex !== undefined
    && (zoom.startIndex > 0 || zoom.endIndex < points.length - 1);
  const missingPublication = query.error instanceof ApiRequestError && query.error.status === 404;
  const offlineMissing = query.error instanceof OfflineDataUnavailableError;

  return (
    <div className="historical-series">
      <div className="history-presets" aria-label="Período del historial">
        {([1, 2, "all"] as const).map((years) => {
          const preset = historyPreset(years);
          return <button key={years} type="button" aria-pressed={range.start_date === preset.start_date && range.end_date === preset.end_date}
            onClick={() => applyRange(preset)}>{years === "all" ? "Todo (desde 2021)" : `${years} ${years === 1 ? "año" : "años"}`}</button>;
        })}
      </div>
      <form className="history-period" onSubmit={(event) => { event.preventDefault(); if (validHistoryRange(draft)) applyRange(draft); }}>
        <label htmlFor={`${id}-start`}>Desde<input id={`${id}-start`} type="date" min={HISTORY_START} max={today}
          value={draft.start_date} required onChange={(event) => setDraft({ ...draft, start_date: event.target.value })} /></label>
        <label htmlFor={`${id}-end`}>Hasta<input id={`${id}-end`} type="date" min={draft.start_date || HISTORY_START} max={today}
          value={draft.end_date} required onChange={(event) => setDraft({ ...draft, end_date: event.target.value })} /></label>
        <button type="submit" disabled={!validHistoryRange(draft)}>Aplicar período</button>
      </form>
      {!validHistoryRange(draft) && <p role="alert">Selecciona un período válido entre enero de 2021 y hoy.</p>}
      {query.isPending ? <RemoteDataState className="is-chart" tone="loading" title="Cargando historial" message="Consultando las mediciones del período seleccionado." />
        : query.isError ? <RemoteDataState className="is-chart" tone={missingPublication || offlineMissing ? "empty" : "error"}
          title={missingPublication ? "Historial aún no disponible" : offlineMissing ? "Período no guardado" : "No se pudo cargar el historial"}
          message={missingPublication ? "Todavía no hay una serie histórica publicada para esta selección."
            : offlineMissing ? "Conéctate para consultar este período y guardarlo para usarlo sin conexión."
            : "Intenta consultar el período nuevamente."} />
          : !hasValues ? <RemoteDataState className="is-chart" tone="empty" title="Sin mediciones en este período" message="Prueba otro período dentro de las fechas disponibles." />
            : <>
              <p className="history-note">{monthly ? "Promedio mensual de las observaciones disponibles. Acerca el período para ver las mediciones originales." : "Mediciones originales. Los datos faltantes se muestran como huecos."}</p>
              <div className="history-chart" data-resolution={query.data?.resolution}>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={rows} margin={{ top: 12, right: 16, left: 4, bottom: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="timestamp" type="number" scale="time" domain={["dataMin", "dataMax"]}
                      tickFormatter={(value: number) => dateLabel(new Date(value).toISOString().slice(0, 10))} minTickGap={35} />
                    <YAxis domain={module === "modis-snow" ? [0, 100] : [0, "auto"]} width={40} />
                    <Tooltip labelFormatter={(value) => dateLabel(new Date(Number(value)).toISOString().slice(0, 10))}
                      formatter={(value, name, item) => {
                        const point = points.find((candidate) => candidate.fecha === item.payload?.fecha);
                        const metric = metrics.find((candidate) => candidate.label === name)?.key ?? "";
                        const detail = monthly && point ? ` · mín. ${point.minimum[metric]?.toFixed(2) ?? "—"} · máx. ${point.maximum[metric]?.toFixed(2) ?? "—"} · n=${point.count[metric] ?? 0}` : "";
                        return [`${value === null ? "Sin dato" : Number(value).toFixed(2)} ${unit}${detail}`, name];
                      }} />
                    <Legend />
                    {metrics.map((metric) => <Line key={metric.key} dataKey={metric.key} name={metric.label} stroke={metric.color}
                      type="linear" connectNulls={false} dot={rows.length < 100} isAnimationActive={false} />)}
                    {rows.length > 1 && <Brush key={`${module}-${JSON.stringify(selection)}-${range.start_date}-${range.end_date}-${query.data?.version}`}
                      dataKey="fecha" height={26} travellerWidth={10} onChange={setZoom} tickFormatter={dateLabel} />}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <button className="history-zoom" type="button" disabled={!hasZoom} onClick={() => {
                if (zoom?.startIndex === undefined || zoom.endIndex === undefined) return;
                applyRange(zoomHistoryRange(points[zoom.startIndex].fecha, points[zoom.endIndex].fecha, monthly, range));
              }}>Aplicar zoom seleccionado</button>
            </>}
      {query.data?.available_from && query.data.available_to && <p className="history-note">
        Datos disponibles: {dateLabel(query.data.available_from)} – {dateLabel(query.data.available_to)}. Puede haber períodos sin mediciones.
      </p>}
      {query.isError && !offlineMissing && <button type="button" onClick={() => void query.refetch()}>Reintentar</button>}
    </div>
  );
}
