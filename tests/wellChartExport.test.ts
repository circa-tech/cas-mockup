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

  const primaryOnly = await readWorkbook(new Uint8Array(await writeWorkbook(
    await createChartWorkbook(plottedWellRows([series("api", 15.125)], [])),
  )).buffer);
  const primarySheet = primaryOnly.worksheets[0];
  assert.equal(primarySheet.columnCount, 3);
  assert.deepEqual(Array.from(primarySheet.getRow(1).values).slice(1), ["Fecha", "Nivel", "Tipo"]);
  assert.equal(primarySheet.autoFilter, "A1:C1");
  assert.equal((primarySheet.getCell("A2").value as Date).toISOString(), "2026-10-09T12:00:00.000Z");
  assert.equal(primarySheet.getCell("B2").value, 15.125);
  assert.equal(primarySheet.getCell("C2").value, "Dinámico");
});

test("Excel Chile wall-clock conversion observes seasonal UTC offsets", () => {
  assert.equal(excelDateInChile(Date.parse("2026-07-01T02:00:00Z")).toISOString(), "2026-06-30T22:00:00.000Z");
  assert.equal(excelDateInChile(Date.parse("2026-11-01T02:00:00Z")).toISOString(), "2026-10-31T23:00:00.000Z");
});

test("export unions source/timestamp keys, preserves category rows and writes blank primary cells", async () => {
  const primary = [series("api", 10), { ...series("api", 11), points: [{ timestamp, label: "9 oct", value: 11, condition: "static" as const }] }];
  const secondary = [series("api", 3), series("manual", 0), { ...series("api", 4), points: [{ timestamp: timestamp + 3600000, label: "9 oct 13:00", value: 4 }] }];
  const rows = plottedWellRows(primary, secondary);
  assert.deepEqual(rows, [
    { timestamp, level: 10, type: "Dinámico", secondary: 3 },
    { timestamp, level: 11, type: "Estático", secondary: 3 },
    { timestamp, level: null, type: null, secondary: 0 },
    { timestamp: timestamp + 3600000, level: null, type: null, secondary: 4 },
  ]);
  const workbook = await readWorkbook(new Uint8Array(await writeWorkbook(await createChartWorkbook(rows, "Caudal (L/s)"))).buffer);
  assert.equal(workbook.worksheets[0].getCell("B4").value, null);
  assert.equal(workbook.worksheets[0].getCell("C4").value, null);
  assert.equal(workbook.worksheets[0].getCell("D4").value, 0);
});

test("brush uses the chart's sorted union timeline, including a window containing only flow", () => {
  const primary = [{ ...series("api", 50), points: [
    { timestamp: timestamp + 4e3, label: "last", value: 50, condition: "dynamic" as const },
    { timestamp, label: "first", value: 10, condition: "static" as const },
  ] }];
  const secondary = [{ ...series("api", 20), points: [
    { timestamp: timestamp + 3e3, label: "flow3", value: 30 },
    { timestamp: timestamp + 1e3, label: "flow1", value: 0 },
    { timestamp: timestamp + 2e3, label: "flow2", value: 20 },
  ] }];
  assert.deepEqual(plottedWellRows(primary, secondary, { startIndex: 1, endIndex: 2 }), [
    { timestamp: timestamp + 1e3, level: null, type: null, secondary: 0 },
    { timestamp: timestamp + 2e3, level: null, type: null, secondary: 20 },
  ]);
  assert.equal(plottedWellRows([{ ...primary[0], points: [] }], secondary).length, 0);
  assert.equal(plottedWellRows(primary, secondary).length, 5);
});
