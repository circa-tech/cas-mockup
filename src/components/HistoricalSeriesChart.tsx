import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { Brush, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartPalette } from "../data/mockupData";
import { authQueryScope } from "../lib/queryClient";
import { OfflineDataUnavailableError } from "../offline/apiFetch";
import { useOfflineState } from "../offline/state";
import { ApiRequestError } from "../services/apiError";
import { fetchHistory } from "../services/historyApi";
import { HISTORY_START, historyPreset, validHistoryRange, zoomHistoryRange, type HistoryPreset, type HistoryRange } from "../utils/history";
import { RemoteDataState } from "./RemoteDataState";

type Props = {
  authIdToken: string | null;
  module: "et-lat" | "modis-snow";
  selection?: Record<string, string | number>;
};

const dateLabel = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString("es-CL", { timeZone: "UTC" });

export function HistoricalSeriesChart({ authIdToken, module, selection = {} }: Props) {
  const id = useId();
  const isEt = module === "et-lat";
  const [period, setPeriod] = useState<HistoryPreset | HistoryRange>(1);
  const [draftRange, setDraft] = useState<HistoryRange | null>(null);
  const [zoom, setZoom] = useState<{ startIndex?: number; endIndex?: number }>();
  const { online, session } = useOfflineState();
  const preset = typeof period === "object" ? undefined : period;
  const requestedRange = typeof period === "object" ? period : historyPreset(period);
  const today = new Date().toISOString().slice(0, 10);
  const params = { ...selection, ...requestedRange, resolution: "auto", max_points: 1200 };
  const query = useQuery({
    // Connectivity may return before Firebase restores a usable credential.
    queryKey: ["history", authQueryScope(authIdToken), module, params, preset, online, Boolean(session?.idToken)],
    queryFn: ({ signal }) => fetchHistory(module, params, authIdToken, signal, preset),
    staleTime: 5 * 60 * 1000,
    retry: (count, error) => !(error instanceof OfflineDataUnavailableError)
      && !(error instanceof ApiRequestError && [401, 403, 404, 422].includes(error.status)) && count < 1,
  });
  const range: HistoryRange = query.data
    ? { start_date: query.data.start_date, end_date: query.data.end_date } : requestedRange;
  const draft = draftRange ?? range;
  const showingSavedPeriod = range.start_date !== requestedRange.start_date || range.end_date !== requestedRange.end_date;
  const applyRange = (next: HistoryPreset | HistoryRange) => {
    setPeriod(next);
    setDraft(null);
    setZoom(undefined);
  };
  const metrics = isEt
    ? [{ key: "etr", label: "Consumo real (ETR)", color: chartPalette.chart2 }, { key: "etmax", label: "Consumo máximo (ETmax)", color: chartPalette.chart4 }]
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
      <div className="history-controls">
        <div className="history-presets" aria-label="Período del historial">
          {([1, 2, "all"] as const).map((years) => {
            return <button key={years} type="button" aria-pressed={preset === years}
              onClick={() => applyRange(years)}>{years === "all" ? "Todo" : `${years} ${years === 1 ? "año" : "años"}`}</button>;
          })}
        </div>
        <form className="history-period" onSubmit={(event) => { event.preventDefault(); if (validHistoryRange(draft)) applyRange(draft); }}>
          <label htmlFor={`${id}-start`}>Desde<input id={`${id}-start`} type="date" min={HISTORY_START} max={today}
            value={draft.start_date} required onChange={(event) => setDraft({ ...draft, start_date: event.target.value })} /></label>
          <label htmlFor={`${id}-end`}>Hasta<input id={`${id}-end`} type="date" min={draft.start_date || HISTORY_START} max={today}
            value={draft.end_date} required onChange={(event) => setDraft({ ...draft, end_date: event.target.value })} /></label>
          <button type="submit" disabled={!validHistoryRange(draft)}>Aplicar período</button>
        </form>
      </div>
      {showingSavedPeriod && <p className="history-note">Mostrando el período guardado: {dateLabel(range.start_date)} – {dateLabel(range.end_date)}. Conéctate para actualizarlo.</p>}
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
              <div className={isEt ? "history-chart history-chart-et" : "history-chart"} data-resolution={query.data?.resolution}>
                <ResponsiveContainer width="100%" height={isEt ? 341 : 350}>
                  <LineChart data={rows} margin={isEt ? { top: 12, right: 8, left: 8, bottom: 20 } : { top: 12, right: 16, left: 4, bottom: 12 }}>
                    <CartesianGrid stroke={isEt ? "hsl(210 18% 89%)" : undefined} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="timestamp" type="number" scale="time" domain={["dataMin", "dataMax"]}
                      tickFormatter={(value: number) => dateLabel(new Date(value).toISOString().slice(0, 10))} minTickGap={35}
                      angle={isEt ? -45 : 0} height={isEt ? 64 : undefined} textAnchor={isEt ? "end" : undefined}
                      tick={isEt ? { fill: "hsl(215 14% 50%)", fontSize: 11 } : undefined}
                      tickLine={isEt ? false : undefined} axisLine={isEt ? { stroke: "hsl(210 18% 84%)" } : undefined} />
                    <YAxis domain={module === "modis-snow" ? [0, 100] : [0, "auto"]} width={isEt ? 46 : 40}
                      tick={isEt ? { fill: "hsl(215 14% 50%)", fontSize: 11 } : undefined}
                      tickFormatter={isEt ? (value: number) => value.toFixed(1) : undefined}
                      tickLine={isEt ? false : undefined} axisLine={isEt ? { stroke: "hsl(210 18% 84%)" } : undefined}
                      label={isEt ? { value: unit, angle: -90, position: "insideLeft", dx: -5,
                        style: { fill: "hsl(215 14% 50%)", fontSize: 11 } } : undefined} />
                    <Tooltip labelFormatter={(value) => dateLabel(new Date(Number(value)).toISOString().slice(0, 10))}
                      animationDuration={isEt ? 150 : undefined}
                      contentStyle={isEt ? { background: "hsl(0 0% 100%)", border: "1px solid hsl(210 18% 84%)",
                        borderRadius: "8px", boxShadow: "0 8px 16px rgba(16, 44, 92, 0.14)", fontSize: "12px" } : undefined}
                      cursor={isEt ? { stroke: "hsl(215 38% 68%)", strokeDasharray: "3 3" } : undefined}
                      labelStyle={isEt ? { color: "hsl(215 14% 40%)", fontWeight: 600 } : undefined}
                      formatter={(value, name, item) => {
                        const point = points.find((candidate) => candidate.fecha === item.payload?.fecha);
                        const metric = metrics.find((candidate) => candidate.label === name)?.key ?? "";
                        const detail = monthly && point ? ` · mín. ${point.minimum[metric]?.toFixed(2) ?? "—"} · máx. ${point.maximum[metric]?.toFixed(2) ?? "—"} · n=${point.count[metric] ?? 0}` : "";
                        return [`${value === null ? "Sin dato" : Number(value).toFixed(2)} ${unit}${detail}`, name];
                      }} />
                    <Legend align={isEt ? "center" : undefined} height={isEt ? 18 : undefined}
                      iconType={isEt ? "plainline" : undefined} verticalAlign={isEt ? "top" : undefined}
                      wrapperStyle={isEt ? { top: 0, fontSize: 10 } : undefined} />
                    {metrics.map((metric, index) => <Line key={metric.key} dataKey={metric.key} name={metric.label} stroke={metric.color}
                      type={isEt ? "monotone" : "linear"} connectNulls={false}
                      strokeWidth={isEt ? 2.2 : undefined} activeDot={isEt ? { r: 4 } : undefined}
                      dot={isEt ? (rows.length < 100 ? { r: 2 } : false) : rows.length < 100}
                      animationBegin={isEt ? index * 120 : undefined} animationDuration={isEt ? 780 : undefined}
                      isAnimationActive={isEt && rows.length < 100} />)}
                    {rows.length > 1 && <Brush key={`${module}-${JSON.stringify(selection)}-${range.start_date}-${range.end_date}-${query.data?.version}`}
                      className={isEt ? "snow-season-brush" : undefined}
                      dataKey="fecha" height={isEt ? 22 : 26} travellerWidth={10} tickFormatter={dateLabel}
                      fill={isEt ? "hsl(213 50% 97%)" : undefined}
                      stroke={isEt ? "hsl(213 50% 75%)" : undefined}
                      onChange={isEt ? undefined : setZoom}
                      onDragEnd={isEt ? ({ startIndex, endIndex }) => {
                        if (startIndex === undefined || endIndex === undefined
                          || (startIndex === 0 && endIndex === points.length - 1)) return;
                        applyRange(zoomHistoryRange(points[startIndex].fecha, points[endIndex].fecha, monthly, range));
                      } : undefined} />}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {!isEt && <button className="history-zoom" type="button" disabled={!hasZoom} onClick={() => {
                if (zoom?.startIndex === undefined || zoom.endIndex === undefined) return;
                applyRange(zoomHistoryRange(points[zoom.startIndex].fecha, points[zoom.endIndex].fecha, monthly, range));
              }}>Aplicar zoom seleccionado</button>}
            </>}
      {query.isError && !offlineMissing && <button type="button" onClick={() => void query.refetch()}>Reintentar</button>}
    </div>
  );
}
