import { useId, useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import {
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Panel } from "../../components/Panel";
import { RemoteDataState } from "../../components/RemoteDataState";
import { SimpleLineChart, type LineSeries } from "../../components/SimpleLineChart";
import { chartPalette } from "../../data/mockupData";
import { queryKeys } from "../../lib/queryKeys";
import { authQueryScope } from "../../lib/queryClient";
import { OfflineDataUnavailableError } from "../../offline/apiFetch";
import { useOfflineState } from "../../offline/state";
import { ApiRequestError } from "../../services/apiError";
import {
  fetchModisSnowCoverageSeries,
  type ModisSnowCoveragePoint,
  type ModisSnowCoverageSeries,
} from "../../services/modisSnowApi";
import { fetchHistory, type HistoryPoint, type HistoryResponse } from "../../services/historyApi";
import { HISTORY_START } from "../../utils/history";

const SNOW_AREAS = [
  { id: "ae", title: "Toda el área de estudio" },
  { id: "jorquera", title: "Cuenca del río Jorquera" },
  { id: "pulido", title: "Cuenca del río Pulido" },
  { id: "manflas", title: "Cuenca del río Manflas" },
] as const;

type SnowAreaId = (typeof SNOW_AREAS)[number]["id"];
type DemoSeriesByArea = Record<SnowAreaId, LineSeries[]>;
type SeasonRow = { fecha: string; label: string; [year: string]: number | string | null };

const seasonStart = "04-01";
const seasonEnd = "09-30";
const snowColors = [chartPalette.chart1, chartPalette.chart3] as const;
const calendarStart = new Date("2020-01-01T00:00:00Z");
const dayLabelFormatter = new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", timeZone: "UTC" });
const dayMilliseconds = 24 * 60 * 60 * 1000;
const calendarDayIndex = (monthDay: string) => Math.round(
  (Date.parse(`2020-${monthDay}T00:00:00Z`) - calendarStart.getTime()) / dayMilliseconds,
);
const snowSeasonRange = {
  startIndex: calendarDayIndex(seasonStart),
  endIndex: calendarDayIndex(seasonEnd),
};
type VisibleRange = { startIndex: number; endIndex: number };
const snowSeasonMonthNames = new Set([
  "abr", "abril", "may", "mayo", "jun", "junio", "jul", "julio", "ago", "agosto", "sep", "sept", "septiembre",
]);

function snowHistoryYears(responses: Array<HistoryResponse | undefined>): number[] {
  const years = new Set<number>();
  responses.forEach((response) => response?.points.forEach((point) => {
    const monthDay = point.fecha.slice(5);
    const coverage = point.values.coverage;
    if (monthDay >= seasonStart && monthDay <= seasonEnd && coverage !== null && coverage !== undefined) {
      years.add(Number(point.fecha.slice(0, 4)));
    }
  }));
  return [...years].sort((a, b) => b - a);
}

function snapshotYears(series?: ModisSnowCoverageSeries): number[] {
  const years = new Set<number>();
  Object.values(series ?? {}).forEach((points) => points.forEach((point) => {
    const year = Number(point.fecha.slice(0, 4));
    if (point.esteano !== null && point.esteano !== undefined) years.add(year);
    if (point.anopar !== null && point.anopar !== undefined) years.add(year - 1);
  }));
  return [...years].sort((a, b) => b - a);
}

function demoHistoryYears(seriesByArea: DemoSeriesByArea): number[] {
  return [...new Set(seriesByArea.ae.map((series) => Number(series.label)).filter(Number.isInteger))]
    .sort((a, b) => b - a);
}

function defaultYearPair(years: number[]): [number | null, number | null] {
  if (!years.length) return [null, null];
  const now = new Date();
  const currentSeasonYear = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
  const first = years.includes(currentSeasonYear) ? currentSeasonYear : years[0];
  const second = years.includes(first - 1) ? first - 1 : years.find((year) => year !== first) ?? null;
  return [first, second];
}

function selectedDemoSeries(series: LineSeries[], firstYear: number | null, secondYear: number | null): LineSeries[] {
  return [firstYear, secondYear].flatMap((year, index) => {
    if (year === null) return [];
    const source = series.find((line) => Number(line.label) === year);
    if (!source) return [];
    const points = source.points.filter((point) => isSnowSeasonMonth(point.label));
    return [{ ...source, color: snowColors[index], points }];
  });
}

function isSnowSeasonMonth(label: string): boolean {
  const month = label.toLocaleLowerCase("es-CL").replaceAll(".", "").trim();
  return snowSeasonMonthNames.has(month);
}

function comparisonRows(
  points: HistoryPoint[],
  snapshotPoints: ModisSnowCoveragePoint[],
  firstYear: number,
  secondYear: number,
): SeasonRow[] {
  const historyByYear = new Map<number, Map<string, number | null>>();
  points.forEach((point) => {
    const year = Number(point.fecha.slice(0, 4));
    const monthDay = point.fecha.slice(5);
    const values = historyByYear.get(year) ?? new Map<string, number | null>();
    values.set(monthDay, point.values.coverage ?? null);
    historyByYear.set(year, values);
  });

  const snapshotByYear = new Map<number, Map<string, number | null>>();
  const addSnapshotValue = (year: number, monthDay: string, value: number | null) => {
    const values = snapshotByYear.get(year) ?? new Map<string, number | null>();
    values.set(monthDay, value);
    snapshotByYear.set(year, values);
  };
  snapshotPoints.forEach((point) => {
    const monthDay = point.fecha.slice(5);
    const comparisonYear = Number(point.fecha.slice(0, 4));
    if (point.esteano !== null && point.esteano !== undefined) addSnapshotValue(comparisonYear, monthDay, point.esteano);
    if (point.anopar !== null && point.anopar !== undefined) addSnapshotValue(comparisonYear - 1, monthDay, point.anopar);
  });

  const valuesForYear = (year: number) => {
    const values = new Map(snapshotByYear.get(year) ?? []);
    historyByYear.get(year)?.forEach((value, monthDay) => {
      if (value !== null || !values.has(monthDay)) values.set(monthDay, value);
    });
    return values;
  };
  const firstValues = valuesForYear(firstYear);
  const secondValues = valuesForYear(secondYear);

  const rows: SeasonRow[] = [];
  const date = new Date(calendarStart);
  const last = new Date("2020-12-31T00:00:00Z");
  while (date <= last) {
    const monthDay = date.toISOString().slice(5, 10);
    rows.push({
      fecha: monthDay,
      label: dayLabelFormatter.format(date).replaceAll(".", ""),
      [String(firstYear)]: firstValues.get(monthDay) ?? null,
      [String(secondYear)]: secondValues.get(monthDay) ?? null,
    });
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return rows;
}

function SeasonChart({
  points,
  snapshotPoints,
  firstYear,
  secondYear,
  visibleRange,
  rangeRevision,
  onVisibleRangeChange,
}: {
  points: HistoryPoint[];
  snapshotPoints: ModisSnowCoveragePoint[];
  firstYear: number;
  secondYear: number;
  visibleRange: VisibleRange;
  rangeRevision: number;
  onVisibleRangeChange: (range: VisibleRange) => void;
}) {
  const rows = useMemo(() => comparisonRows(points, snapshotPoints, firstYear, secondYear), [points, snapshotPoints, firstYear, secondYear]);
  const hasValues = rows.some((row) => typeof row[String(firstYear)] === "number" || typeof row[String(secondYear)] === "number");

  if (!hasValues) {
    return <RemoteDataState className="is-chart" tone="empty" title="Sin mediciones en estas temporadas" message="Elige otros años con datos de abril a septiembre." />;
  }

  const visibleDayCount = visibleRange.endIndex - visibleRange.startIndex + 1;
  const labelEvery = Math.max(1, Math.ceil(visibleDayCount / 8));

  return (
    <div className="simple-chart">
      <div className="simple-chart-recharts-shell">
        <ResponsiveContainer width="100%" height={338}>
          {/* Recharts keeps the Brush range internally; remount it when the comparison or reset changes. */}
          <LineChart key={`${firstYear}-${secondYear}-${rangeRevision}`} data={rows} margin={{ top: 12, right: 8, left: 8, bottom: 18 }}>
            <CartesianGrid stroke="hsl(210 18% 89%)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              angle={-32}
              dataKey="label"
              height={56}
              interval={0}
              minTickGap={8}
              tick={{ fill: "hsl(215 14% 50%)", fontSize: 11 }}
              tickFormatter={(value: string, index: number) =>
              index % labelEvery === 0 || index === visibleRange.endIndex ? value : ""
              }
              tickLine={false}
              axisLine={{ stroke: "hsl(210 18% 84%)" }}
              textAnchor="end"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "hsl(215 14% 50%)", fontSize: 11 }}
              tickFormatter={(value: number) => value.toFixed(1)}
              tickLine={false}
              axisLine={{ stroke: "hsl(210 18% 84%)" }}
              width={46}
              label={{
                value: "Cobertura (%)",
                angle: -90,
                position: "insideLeft",
                textAnchor: "middle",
                dx: -5,
                style: { fill: "hsl(215 14% 50%)", fontSize: 11 },
              }}
            />
            <Tooltip
              animationDuration={150}
              contentStyle={{
                background: "hsl(0 0% 100%)",
                border: "1px solid hsl(210 18% 84%)",
                borderRadius: "8px",
                boxShadow: "0 8px 16px rgba(16, 44, 92, 0.14)",
                fontSize: "12px",
              }}
              cursor={{ stroke: "hsl(215 38% 68%)", strokeDasharray: "3 3" }}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.fecha
                ? new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "long", timeZone: "UTC" })
                  .format(new Date(`2020-${payload[0].payload.fecha}T00:00:00Z`))
                : ""}
              formatter={(value, name) => [value === null || value === undefined ? "Sin dato" : `${Number(value).toFixed(1)} %`, name]}
              labelStyle={{ color: "hsl(215 14% 40%)", fontWeight: 600 }}
            />
            <Legend
              align="center"
              height={24}
              iconType="plainline"
              verticalAlign="bottom"
              wrapperStyle={{ bottom: 0, fontSize: 10, transform: "translateY(12px)" }}
            />
            <Line
              dataKey={String(firstYear)}
              name={String(firstYear)}
              stroke={snowColors[0]}
              type="monotone"
              connectNulls={false}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
              strokeWidth={2.2}
              animationBegin={0}
              animationDuration={780}
            />
            <Brush
              className="snow-season-brush"
              dataKey="label"
              fill="hsl(213 50% 97%)"
              height={26}
              stroke="hsl(213 50% 75%)"
              travellerWidth={10}
              startIndex={visibleRange.startIndex}
              endIndex={visibleRange.endIndex}
              onChange={(range) => {
                if (typeof range.startIndex === "number" && typeof range.endIndex === "number") {
                  onVisibleRangeChange({ startIndex: range.startIndex, endIndex: range.endIndex });
                }
              }}
            />
            <Line
              dataKey={String(secondYear)}
              name={String(secondYear)}
              stroke={snowColors[1]}
              type="monotone"
              connectNulls={false}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
              strokeWidth={2.2}
              animationBegin={120}
              animationDuration={780}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function SnowSeasonComparison({
  authIdToken,
  demoSeriesByArea,
  isLoggedIn,
}: {
  authIdToken: string | null;
  demoSeriesByArea: DemoSeriesByArea;
  isLoggedIn: boolean;
}) {
  const id = useId();
  const [visibleRange, setVisibleRange] = useState<VisibleRange>(snowSeasonRange);
  const [rangeRevision, setRangeRevision] = useState(0);
  const { online, session } = useOfflineState();
  const endDate = new Date().toISOString().slice(0, 10);
  const historyEnabled = isLoggedIn && Boolean(authIdToken || session?.idToken);
  const coverageQuery = useQuery({
    queryKey: queryKeys.snow.coverage(authIdToken),
    queryFn: () => fetchModisSnowCoverageSeries(authIdToken),
    enabled: isLoggedIn,
    staleTime: 30 * 60 * 1000,
  });
  const queries = useQueries({
    queries: SNOW_AREAS.map(({ id: area }) => {
      const params = { area, start_date: HISTORY_START, end_date: endDate, resolution: "native", max_points: 5000 };
      return {
        queryKey: ["history", authQueryScope(authIdToken), "modis-snow", params, "snow-season-comparison", online, Boolean(session?.idToken)],
        queryFn: ({ signal }: { signal: AbortSignal }) => fetchHistory("modis-snow", params, authIdToken, signal),
        enabled: historyEnabled,
        staleTime: 5 * 60 * 1000,
        retry: (count: number, error: unknown) => !(error instanceof OfflineDataUnavailableError)
          && !(error instanceof ApiRequestError && [401, 403, 404, 422].includes(error.status)) && count < 1,
      };
    }),
  });

  const demoYears = demoHistoryYears(demoSeriesByArea);
  const historyYears = snowHistoryYears(queries.map((query) => query.data));
  const availableYears = isLoggedIn
    ? [...new Set([...historyYears, ...snapshotYears(coverageQuery.data)])].sort((a, b) => b - a)
    : demoYears;
  const [firstYearValue, setFirstYearValue] = useState<number | null>(null);
  const [secondYearValue, setSecondYearValue] = useState<number | null>(null);
  const [defaultFirst, defaultSecond] = defaultYearPair(availableYears);
  const firstYear = firstYearValue !== null && availableYears.includes(firstYearValue) ? firstYearValue : defaultFirst;
  const secondOptions = availableYears.filter((year) => year !== firstYear);
  const secondYear = secondYearValue !== null && secondOptions.includes(secondYearValue)
    ? secondYearValue
    : (defaultSecond !== null && secondOptions.includes(defaultSecond) ? defaultSecond : secondOptions[0] ?? null);
  const loadingYears = historyEnabled && !availableYears.length
    && (coverageQuery.isPending || queries.some((query) => query.isPending));
  const selectFirstYear = (value: string) => {
    const next = Number(value);
    setFirstYearValue(next);
    setVisibleRange(snowSeasonRange);
    if (next === secondYear) {
      setSecondYearValue(availableYears.find((year) => year !== next) ?? null);
    }
  };

  const selectSecondYear = (value: string) => {
    setSecondYearValue(Number(value));
    setVisibleRange(snowSeasonRange);
  };

  const resetRange = () => {
    setVisibleRange(snowSeasonRange);
    setRangeRevision((revision) => revision + 1);
  };

  return (
    <>
      <div className="snow-comparison-controls" role="group" aria-label="Comparación de temporadas de nieve">
        <div className="snow-comparison-copy">
          <strong>Comparar temporadas</strong>
          <span>Inicial: abril–septiembre. Desliza para explorar el año.</span>
        </div>
        <label htmlFor={`${id}-first-year`}>
          Temporada
          <select id={`${id}-first-year`} value={firstYear ?? ""} disabled={!availableYears.length} onChange={(event) => selectFirstYear(event.target.value)}>
            {!availableYears.length && <option value="">{loadingYears ? "Cargando años…" : "Sin años disponibles"}</option>}
            {availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
        <label htmlFor={`${id}-second-year`}>
          Comparar con
          <select id={`${id}-second-year`} value={secondYear ?? ""} disabled={!secondOptions.length} onChange={(event) => selectSecondYear(event.target.value)}>
            {!secondOptions.length && <option value="">No hay otro año</option>}
            {secondOptions.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
        <button
          className="snow-comparison-reset"
          type="button"
          aria-label="Restablecer el rango a abril–septiembre"
          title="Restablecer abril–septiembre"
          onClick={resetRange}
        >
          <RotateCcw size={16} aria-hidden="true" />
        </button>
      </div>

      {SNOW_AREAS.map((area, index) => {
        const query = queries[index];
        const snapshotPoints = coverageQuery.data?.[area.id] ?? [];
        const sessionRejected = [query.error, coverageQuery.error].some(
          (error) => error instanceof ApiRequestError && error.status === 401,
        );
        return (
          <Panel key={area.id} title={area.title}>
            {isLoggedIn ? (
              (query.isPending || coverageQuery.isPending) && !query.data && !coverageQuery.data ? <RemoteDataState className="is-chart" tone="loading" title="Cargando historial" message="Consultando las temporadas disponibles desde 2021." />
                : query.isError && !query.data && !coverageQuery.data ? <RemoteDataState className="is-chart"
                  tone={!sessionRejected && (query.error instanceof OfflineDataUnavailableError || (query.error instanceof ApiRequestError && query.error.status === 404 && !coverageQuery.isError)) ? "empty" : "error"}
                  title={sessionRejected ? "La sesión dejó de ser válida"
                    : coverageQuery.isError ? "No se pudieron cargar los datos de nieve"
                      : query.error instanceof ApiRequestError && query.error.status === 404 ? "Historial aún no disponible"
                        : query.error instanceof OfflineDataUnavailableError ? "Historial no guardado sin conexión" : "No se pudo cargar el historial"}
                  message={sessionRejected ? "El servicio rechazó la sesión. Vuelve a iniciar sesión y recarga esta vista."
                    : coverageQuery.isError ? "El historial no está publicado y también falló la serie de respaldo. Revisa la disponibilidad del servicio local."
                      : query.error instanceof ApiRequestError && query.error.status === 404 ? "Todavía no hay una serie histórica publicada para esta cuenca."
                        : query.error instanceof OfflineDataUnavailableError ? "Conéctate para consultar y guardar las temporadas históricas."
                          : "Intenta cargar las temporadas nuevamente."} />
                  : firstYear !== null && secondYear !== null ? <SeasonChart
                    points={query.data?.points ?? []}
                    snapshotPoints={snapshotPoints}
                    firstYear={firstYear}
                    secondYear={secondYear}
                    visibleRange={visibleRange}
                    rangeRevision={rangeRevision}
                    onVisibleRangeChange={setVisibleRange}
                  />
                    : <RemoteDataState className="is-chart" tone="empty" title="Sin temporadas comparables" message="Todavía no hay datos publicados de dos temporadas de nieve para esta cuenca." />
            ) : (
              <SimpleLineChart
                labelEvery={1}
                maxValue={100}
                minValue={0}
                series={selectedDemoSeries(demoSeriesByArea[area.id], firstYear, secondYear)}
                unit="Cobertura (%)"
                xLabelAngle={-18}
              />
            )}
          </Panel>
        );
      })}
    </>
  );
}
