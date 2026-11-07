import type { LineSeries } from "../../components/SimpleLineChart";
import { createWorkbook, excelDateFormat, excelDateInChile } from "../../utils/workbook";

export type PlottedWellRow = { timestamp: number; level: number; type: string; secondary: number | null };
const types = { static: "Estático", dynamic: "Dinámico", unknown: "Otra" };

/** Receives the exact filtered/aggregated series passed to the chart. Never re-fetches raw data. */
export const plottedWellRows = (primary: LineSeries[], secondary: LineSeries[]): PlottedWellRow[] => {
  const secondaryBySourceTime = new Map<string, number>();
  for (const series of secondary) {
    for (const point of series.points) {
      if (point.timestamp !== undefined && Number.isFinite(point.value)) {
        secondaryBySourceTime.set(`${series.source}:${point.timestamp}`, point.value);
      }
    }
  }
  return primary.flatMap((series) => series.points.flatMap((point) =>
    point.timestamp !== undefined && Number.isFinite(point.timestamp) && Number.isFinite(point.value)
      ? [{ timestamp: point.timestamp, level: point.value, type: types[point.condition ?? "unknown"],
          secondary: secondaryBySourceTime.get(`${series.source}:${point.timestamp}`) ?? null }]
      : [],
  )).sort((a, b) => a.timestamp - b.timestamp);
};

export const createChartWorkbook = async (rows: PlottedWellRow[], secondaryLabel?: string) => {
  const workbook = await createWorkbook();
  const sheet = workbook.addWorksheet("Mediciones");
  sheet.columns = [
    { header: "Fecha", key: "date", width: 23 },
    { header: "Nivel", key: "level", width: 18 },
    { header: "Tipo", key: "type", width: 18 },
    { header: secondaryLabel || "Sin variable secundaria", key: "secondary", width: 26 },
  ];
  for (const row of rows) sheet.addRow({ date: excelDateInChile(row.timestamp), ...row });
  sheet.getColumn("date").numFmt = excelDateFormat;
  sheet.getColumn("level").numFmt = "0.###############";
  sheet.getColumn("secondary").numFmt = "0.###############";
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = "A1:D1";
  return workbook;
};

export const chartExportFilename = (well: string, variable: string, rows: PlottedWellRow[]) => {
  const safe = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 80);
  const day = (timestamp: number) => excelDateInChile(timestamp).toISOString().slice(0, 10);
  return `Pozo_${safe(well)}_${safe(variable || "Nivel")}_${day(rows[0].timestamp)}_${day(rows.at(-1)!.timestamp)}.xlsx`;
};
