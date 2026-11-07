import assert from "node:assert/strict";
import test from "node:test";
import { createMeasurementTemplate, parseMeasurementWorkbook, parseMeasurementDate, readMeasurementFile, MeasurementWorkbookError } from "../src/features/wells/measurementWorkbook";
import { writeWorkbook, readWorkbook } from "../src/utils/workbook";
import { normalizeMeasurementNumber } from "../src/features/wells/measurementNumbers";
import { workbookUploadErrorMessage } from "../src/features/wells/measurementErrors";
import { ApiRequestError } from "../src/services/apiError";

const now = new Date("2026-11-07T12:00:00Z");
const wells = [{ id: "a", name: "Pozo Norte", codigoObra: "OB-1" }, { id: "b", name: "Pozo Sur", codigoObra: "OB-2" }];
const data = { well: "OB-1", date: new Date("2026-11-01T10:30:00Z"), userRut: "12345678-5", flowRate: "3,123456789123456789", totalizer: "999999999999999", waterTableDepth: 0, waterLevelCondition: "ESTÁTICO", pressure: null, ph: 7, conductivity: "9999999999,9", isOperating: "sí", observations: "Dato de terreno" };
const prepare = async (selected = false) => {
  const workbook = await createMeasurementTemplate(selected ? wells[0] : undefined, now);
  const sheet = workbook.getWorksheet("Mediciones")!;
  sheet.getRow(3).values = data;
  return { workbook, sheet };
};
const filename = (bytes: Uint8Array, name = "mediciones.xlsx") => new File([new Uint8Array(bytes).buffer], name);

test("template has required styling, dropdown, instructions and a reliable unchanged example marker", async () => {
  const { workbook, sheet } = await prepare();
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["Mediciones", "Instrucciones"]);
  assert.equal(sheet.getCell("B1").text, "Fecha y hora *");
  assert.notDeepEqual(sheet.getCell("A1").fill, sheet.getCell("E1").fill);
  assert.deepEqual(sheet.getRow(2).getCell("waterLevelCondition").dataValidation.formulae, ['"Estático,Dinámico"']);
  const reopened = await readWorkbook(new Uint8Array(await writeWorkbook(workbook)).buffer);
  const result = parseMeasurementWorkbook(reopened, wells, "", now);
  assert.equal(result.payloads.length, 1);
  assert.equal(result.rowNumbers[0], 3);
  assert.equal(result.payloads[0].flowRate, "3.123456789123456789");
  assert.equal(result.payloads[0].conductivity, "9999999999.9");
  assert.equal(result.payloads[0].waterTableDepth, "0");
  assert.equal(result.payloads[0].waterLevelCondition, "static");
  assert.equal(result.payloads[0].userRut, "12345678-5");
});

test("selected well owns every row and template omits Pozo; changing example makes it real", async () => {
  const { workbook, sheet } = await prepare(true);
  assert.equal(sheet.getCell("A1").text, "Fecha y hora *");
  sheet.getRow(2).getCell("observations").value = "Mi dato real";
  const result = parseMeasurementWorkbook(workbook, wells, "b", now);
  assert.equal(result.payloads.length, 2);
  assert.ok(result.payloads.every((row) => row.wellId === "b"));
  assert.equal(result.payloads[0].observations, "Mi dato real");
});

test("headers tolerate order, accents, asterisks and whitespace; legacy titular is ignored", async () => {
  const workbook = await createMeasurementTemplate(undefined, now);
  workbook.removeWorksheet("Mediciones");
  const sheet = workbook.addWorksheet(" MEDICIONES ");
  sheet.addRow([" totalizador* ", "CAUDAL (L/s) *", "RUT DE QUIEN MIDE*", " FECHA Y HORA *", "POZO*", "RUT del titular"]);
  sheet.addRow([123, "1,2345", "12.345.678-5", "1/11/2026 10:30", " pozo norte ", "invalid ignored"]);
  const result = parseMeasurementWorkbook(workbook, wells, "", now);
  assert.equal(result.payloads[0].flowRate, "1.2345");
  assert.equal(result.payloads[0].measurementDate, "2026-11-01");
  assert.equal("companyRut" in result.payloads[0], false);
});

test("all error categories and duplicates are returned together without partial payloads", async () => {
  const { workbook, sheet } = await prepare();
  sheet.addRow({ ...data, flowRate: "abc", ph: 15, waterLevelCondition: "Otra", isOperating: "quizás", observations: "x".repeat(1001) });
  sheet.addRow({ ...data, well: "Missing", date: "31/02/2026 10:30", userRut: "invalid", totalizer: "1.2" });
  assert.throws(() => parseMeasurementWorkbook(workbook, wells, "", now), (error: unknown) => {
    assert.ok(error instanceof MeasurementWorkbookError);
    for (const category of ["Valores numéricos", "Rangos", "Tipo de nivel", "Operación", "Observaciones", "Pozos", "Fechas", "Identificación", "Mediciones repetidas"]) assert.ok(error.issues.some((issue) => issue.category === category), category);
    assert.match(error.message, /No se cargó ninguna medición/);
    return true;
  });
});

test("errors are capped in display only and name collisions never pick a destination", async () => {
  const { workbook, sheet } = await prepare();
  for (let i = 0; i < 60; i++) sheet.addRow({ ...data, well: "Pozo Norte", date: `1/11/2026 10:${String(i).padStart(2, "0")}`, flowRate: "bad" });
  assert.throws(() => parseMeasurementWorkbook(workbook, [...wells, { id: "c", name: "Pozo Norte", codigoObra: "OB-3" }], "", now), (error: unknown) => {
    assert.ok(error instanceof MeasurementWorkbookError);
    assert.ok(error.issues.length > 50);
    assert.match(error.message, /primeros 50/);
    assert.match(error.message, /coincide con varios pozos/);
    assert.equal((error.message.match(/Fila /g) ?? []).length, 50);
    return true;
  });
});

test("empty, excessive, password-protected, damaged and wrong-extension files have specific guidance", async () => {
  const empty = await createMeasurementTemplate(wells[0], now);
  assert.throws(() => parseMeasurementWorkbook(empty, wells, "a", now), /ejemplo sin modificar se ignora/);
  await assert.rejects(readMeasurementFile(filename(new Uint8Array(), "a.csv")), /debe ser de Excel/);
  await assert.rejects(readMeasurementFile(filename(new Uint8Array(5 * 1024 * 1024 + 1))), /5 MiB/);
  await assert.rejects(readMeasurementFile(filename(new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0, 0, 0, 0]))), /contraseña/);
  await assert.rejects(readMeasurementFile(filename(new Uint8Array([1, 2, 3]))), /dañado/);
  const { workbook, sheet } = await prepare(true);
  for (let i = 0; i < 1000; i++) sheet.addRow({ ...data, date: new Date(Date.UTC(2026, 9, 1, 0, i)) });
  assert.throws(() => parseMeasurementWorkbook(workbook, wells, "a", now), /máximo es 1.000/);
});

test("date parsing rejects impossible dates and Chile's skipped DST hour; future rows fail", async () => {
  assert.equal(parseMeasurementDate("31/02/2026 10:00"), null);
  assert.equal(parseMeasurementDate("2026-09-06 00:30"), null);
  assert.equal(parseMeasurementDate("2026-07-01 10:30")?.instant, Date.parse("2026-07-01T14:30:00Z"));
  assert.equal(parseMeasurementDate("2026-11-01 10:30")?.instant, Date.parse("2026-11-01T13:30:00Z"));
  const { workbook, sheet } = await prepare(true);
  sheet.addRow({ ...data, date: "07/11/2026 23:00" });
  assert.throws(() => parseMeasurementWorkbook(workbook, wells, "a", now), /posterior a ahora/);
});

test("decimal normalization preserves text precision and equivalent integer forms", () => {
  assert.equal(normalizeMeasurementNumber("99999999,99999999999"), "99999999.99999999999");
  assert.equal(normalizeMeasurementNumber(1e-7), "0.0000001");
  assert.equal(normalizeMeasurementNumber("00123.000"), "123");
  assert.equal(normalizeMeasurementNumber("Infinity"), null);
});

test("server validation errors map indexes back to actual workbook rows without technical details", () => {
  const error = new ApiRequestError("internal", 422, "technical", [{ loc: ["body", "measurements", 1, "groundwaterMeasurement", "flowRate"], msg: "decimal_type" }]);
  const message = workbookUploadErrorMessage(error, [3, 8]);
  assert.match(message, /Fila 8, «Caudal \(L\/s\)»/);
  assert.doesNotMatch(message, /decimal_type|technical|API/);
});

test("business validation preserves server error totals and maps 1-based rows", () => {
  const error = new ApiRequestError("internal", 403, "technical", { errors: [{ row: 1, field: "wellId", code: "permission" }], totalErrors: 60 });
  const message = workbookUploadErrorMessage(error, [5]);
  assert.match(message, /Fila 5, «Pozo»/);
  assert.match(message, /ya no tienes permiso/i);
  assert.match(message, /60 errores/);
});


test("storage precision limits reject excessive fractional digits before submission", async () => {
  const { workbook, sheet } = await prepare(true);
  sheet.getRow(3).getCell("flowRate").value = "0." + "1".repeat(16384);
  assert.throws(() => parseMeasurementWorkbook(workbook, wells, "a", now), /16.383 decimales/);
  sheet.getRow(3).getCell("flowRate").value = "99999999." + "9".repeat(20);
  assert.equal(parseMeasurementWorkbook(workbook, wells, "a", now).payloads[0].flowRate, "99999999." + "9".repeat(20));
});


test("saved formula results behave as values while missing results request a correction", async () => {
  const { workbook, sheet } = await prepare(true);
  sheet.getRow(3).getCell("flowRate").value = { formula: "1+2", result: 3 };
  assert.equal(parseMeasurementWorkbook(workbook, wells, "a", now).payloads[0].flowRate, "3");
  sheet.getRow(3).getCell("flowRate").value = { formula: "1+2" };
  assert.throws(() => parseMeasurementWorkbook(workbook, wells, "a", now), /resultado guardado/);
});
