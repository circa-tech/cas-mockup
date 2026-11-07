import { buildLineChartRows, type LineChartBrushRange } from "../../components/lineChartData";
import type { LineSeries } from "../../components/SimpleLineChart";
import { createWorkbook, excelDateFormat, excelDateInChile } from "../../utils/workbook";

export type PlottedWellRow = { timestamp: number; level: number | null; type: string | null; secondary: number | null };
const types = { static: "Estático", dynamic: "Dinámico", unknown: "Otra" };

/** Receives the exact filtered/aggregated series passed to the chart. Never re-fetches raw data. */
export const plottedWellRows = (
  primary: LineSeries[], secondary: LineSeries[], brushRange?: LineChartBrushRange,
): PlottedWellRow[] => {
  const validPoint = (point: LineSeries["points"][number]) => point.timestamp !== undefined && Number.isFinite(point.timestamp) && Number.isFinite(point.value);
  // The whole chart requires a primary value. A zoomed window can contain only secondary readings.
  if (!primary.some((series) => series.points.some(validPoint))) return [];
  const chartRows = buildLineChartRows([...primary, ...secondary]);
  const visibleTimestamps = new Set((brushRange
    ? chartRows.slice(brushRange.startIndex, brushRange.endIndex + 1)
    : chartRows).map((row) => row.timestamp));
  const visible = (point: LineSeries["points"][number]) => validPoint(point) && visibleTimestamps.has(point.timestamp);
  const secondaryBySourceTime = new Map<string, { timestamp: number; value: number }>();
  for (const series of secondary) {
    for (const point of series.points.filter(visible)) {
      secondaryBySourceTime.set(`${series.source}:${point.timestamp}`, { timestamp: point.timestamp!, value: point.value });
    }
  }
  const primaryKeys = new Set<string>();
  const rows: PlottedWellRow[] = primary.flatMap((series) => series.points.filter(visible).map((point) => {
    const key = `${series.source}:${point.timestamp}`;
    primaryKeys.add(key);
    return { timestamp: point.timestamp!, level: point.value, type: types[point.condition ?? "unknown"],
      secondary: secondaryBySourceTime.get(key)?.value ?? null };
  }));
  // Daily static/dynamic levels can share a key; keep each plotted level, then add unmatched flow.
  for (const [key, point] of secondaryBySourceTime) if (!primaryKeys.has(key)) rows.push({
    timestamp: point.timestamp, level: null, type: null, secondary: point.value,
  });
  return rows.sort((a, b) => a.timestamp - b.timestamp);
};

export const createChartWorkbook = async (rows: PlottedWellRow[], secondaryLabel?: string) => {
  const workbook = await createWorkbook();
  const sheet = workbook.addWorksheet("Mediciones");
  sheet.columns = [
    { header: "Fecha", key: "date", width: 23 },
    { header: "Nivel", key: "level", width: 18 },
    { header: "Tipo", key: "type", width: 18 },
    ...(secondaryLabel ? [{ header: secondaryLabel, key: "secondary", width: 26 }] : []),
  ];
  for (const row of rows) sheet.addRow({ date: excelDateInChile(row.timestamp), ...row });
  sheet.getColumn("date").numFmt = excelDateFormat;
  sheet.getColumn("level").numFmt = "0.###############";
  if (secondaryLabel) sheet.getColumn("secondary").numFmt = "0.###############";
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = secondaryLabel ? "A1:D1" : "A1:C1";
  return workbook;
};

export const chartExportFilename = (well: string, variable: string, rows: PlottedWellRow[]) => {
  const safe = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 80);
  const day = (timestamp: number) => excelDateInChile(timestamp).toISOString().slice(0, 10);
  return `Pozo_${safe(well)}_${safe(variable || "Nivel")}_${day(rows[0].timestamp)}_${day(rows.at(-1)!.timestamp)}.xlsx`;
};
