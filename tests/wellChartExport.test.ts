import assert from "node:assert/strict";
import test from "node:test";
import type { LineSeries } from "../src/components/SimpleLineChart";
import { createChartWorkbook, plottedWellRows, chartExportFilename } from "../src/features/wells/wellChartExport";
import { excelDateInChile, readWorkbook, writeWorkbook } from "../src/utils/workbook";

const timestamp = Date.parse("2026-10-09T15:00:00Z");
const series = (source: "api" | "manual", value: number, condition = "dynamic" as const): LineSeries => ({
  source, color: "blue", label: source, points: [{ timestamp, label: "9 oct", value, condition }],
});

test("export uses plotted aggregate values, matches source and leaves missing secondary blank", () => {
  const rows = plottedWellRows([series("api", 15.125), series("manual", 20)], [series("api", 0)]);
  assert.deepEqual(rows, [
    { timestamp, level: 15.125, type: "Dinámico", secondary: 0 },
    { timestamp, level: 20, type: "Dinámico", secondary: null },
  ]);
  assert.equal(plottedWellRows([], [series("api", 5)]).length, 0);
  assert.match(chartExportFilename("Norte / Cerro", "Caudal (L/s)", rows), /^Pozo_Norte_Cerro_Caudal_L_s__2026-10-09_2026-10-09.xlsx$/);
});

test("genuine Excel roundtrip retains numeric cells, dates in Chile and Spanish headers", async () => {
  const rows = plottedWellRows([series("api", 15.125)], [series("api", 3.56)]);
  const workbook = await createChartWorkbook(rows, "Caudal (L/s)");
  const bytes = await writeWorkbook(workbook);
  assert.equal(String.fromCharCode(bytes[0], bytes[1]), "PK");
  const saved = await readWorkbook(new Uint8Array(bytes).buffer);
  const sheet = saved.worksheets[0];
  assert.equal(saved.worksheets.length, 1);
  assert.deepEqual(Array.from(sheet.getRow(1).values).slice(1), [ "Fecha", "Nivel", "Tipo", "Caudal (L/s)"]);
  assert.equal((sheet.getCell("A2").value as Date).toISOString(), "2026-10-09T12:00:00.000Z");
  assert.equal(sheet.getCell("A2").numFmt, "dd-mm-yyyy hh:mm");
  assert.equal(sheet.getCell("B2").value, 15.125);
  assert.equal(sheet.getCell("D2").value, 3.56);
});

test("Excel Chile wall-clock conversion observes seasonal UTC offsets", () => {
  assert.equal(excelDateInChile(Date.parse("2026-07-01T02:00:00Z")).toISOString(), "2026-06-30T22:00:00.000Z");
  assert.equal(excelDateInChile(Date.parse("2026-11-01T02:00:00Z")).toISOString(), "2026-10-31T23:00:00.000Z");
});
