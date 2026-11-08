import assert from "node:assert/strict";
import test from "node:test";
import { createMeasurementTemplate, parseMeasurementWorkbook, parseMeasurementDate, readMeasurementFile, MeasurementWorkbookError, createMeasurementValidationWorkbook, validationNotesHeader } from "../src/features/wells/measurementWorkbook";
import { writeWorkbook, readWorkbook } from "../src/utils/workbook";
import { normalizeMeasurementNumber } from "../src/features/wells/measurementNumbers";
import { workbookUploadErrorMessage, workbookUploadIssues } from "../src/features/wells/measurementErrors";
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


test("validation download preserves original cells and all errors beyond the screen cap, then reimports corrected rows", async () => {
  const { workbook, sheet } = await prepare();
  workbook.addWorksheet("Datos de terreno").getCell("A1").value = "Conservar";
  sheet.getCell("M3").value = { formula: "1+2", result: 3 };
  sheet.getCell("M1").value = "Otra información";
  const invalidRows = Array.from({ length: 60 }, (_, index) => 10 + index * 2);
  invalidRows.forEach((row, index) => { sheet.getRow(row).values = { ...data, date: new Date(Date.UTC(2026, 10, 2, 10, index)), flowRate: "bad" }; });
  let issues: MeasurementWorkbookError["issues"] = [];
  try { parseMeasurementWorkbook(workbook, wells, "", now); }
  catch (error) { assert.ok(error instanceof MeasurementWorkbookError); issues = error.issues; assert.equal((error.message.match(/Fila /g) ?? []).length, 50); }
  assert.equal(issues.length, 60);
  const annotated = await createMeasurementValidationWorkbook({ workbook, issues, total: issues.length, filename: "original.xlsx", selectedWellId: "a" });
  const reopened = await readMeasurementFile(filename(await writeWorkbook(annotated)));
  const review = reopened.getWorksheet("Mediciones")!;
  const notesColumn = (review.getRow(1).values as unknown[]).indexOf(validationNotesHeader);
  assert.equal(notesColumn, 14);
  assert.equal(sheet.getCell("N1").value, null, "the original workbook is not mutated");
  assert.deepEqual(review.getCell("M3").value, { formula: "1+2", result: 3 });
  assert.equal(reopened.description, workbook.description);
  assert.equal(reopened.getWorksheet("Datos de terreno")!.getCell("A1").value, "Conservar");
  assert.equal(review.getCell("L3").value, "Dato de terreno");
  assert.deepEqual(review.getCell("B3").value, data.date);
  assert.equal(review.getCell("N3").value, null);
  for (const row of invalidRows) {
    assert.match(review.getRow(row).getCell(notesColumn).text, /Valores numéricos.*Caudal/);
    review.getRow(row).getCell(4).value = "3,123456789123456789";
  }
  const corrected = parseMeasurementWorkbook(reopened, wells, "", now);
  assert.equal(corrected.payloads.length, 61);
  assert.equal(corrected.payloads.at(-1)!.observations, "Dato de terreno");
  assert.equal(corrected.payloads.at(-1)!.flowRate, "3.123456789123456789");
  assert.deepEqual(corrected.rowNumbers.slice(1), invalidRows);
  // A second rejection reuses the column and removes previous annotations on corrected rows.
  const second = await createMeasurementValidationWorkbook({ workbook: reopened, issues: [{ category: "Rangos", row: 10, column: "pH", message: "Revisa el pH." }], total: 1, filename: "original_con_validaciones.xlsx", selectedWellId: "a" });
  const secondSheet = second.getWorksheet("Mediciones")!;
  assert.equal((secondSheet.getRow(1).values as unknown[]).filter((value) => value === validationNotesHeader).length, 1);
  assert.match(secondSheet.getCell("N10").text, /Revisa el pH/);
  assert.equal(secondSheet.getCell("N12").value, null);
});

test("validation downloads map server rows and disclose incomplete reports without manufacturing system errors", async () => {
  const { workbook, sheet } = await prepare(true);
  sheet.getRow(8).values = { ...data, date: new Date("2026-11-02T10:30:00Z") };
  const error = new ApiRequestError("invalid", 422, "internal", { errors: [{ row: 2, field: "ph", code: "invalid" }], totalErrors: 60 });
  const details = workbookUploadIssues(error, [3, 8]);
  const annotated = await createMeasurementValidationWorkbook({ workbook, ...details, filename: "original.xlsx", selectedWellId: "a" });
  const reopened = await readMeasurementFile(filename(await writeWorkbook(annotated)));
  const review = reopened.getWorksheet("Mediciones")!;
  assert.equal(review.getCell("L3").value, null);
  assert.match(review.getCell("L8").text, /pH/);
  assert.match(JSON.stringify(review.getCell("L1").note), /60 errores.*1 detalle disponible/);
  assert.match(reopened.getWorksheet("Revisión de validación CAS")!.getCell("B3").text, /60 errores.*1 detalle disponible/);
  assert.equal(review.getCell("K8").value, "Dato de terreno");
  assert.deepEqual(workbookUploadIssues(new TypeError("network"), [3]), { issues: [], total: 0 });
  assert.deepEqual(workbookUploadIssues(new ApiRequestError("failed", 500, "internal", [{ row: 1, field: "ph" }]), [3]), { issues: [], total: 0 });
  await assert.rejects(createMeasurementValidationWorkbook({ workbook, issues: [], total: 0, filename: "original.xlsx", selectedWellId: "a" }), /No hay errores/);
});

test("sheet-level validation is visible in a summary without adding measurement rows", async () => {
  const { workbook, sheet } = await prepare(true);
  sheet.getCell("C1").value = "Caudal mal nombrado";
  let issues: MeasurementWorkbookError["issues"] = [];
  try { parseMeasurementWorkbook(workbook, wells, "a", now); }
  catch (error) { assert.ok(error instanceof MeasurementWorkbookError); issues = error.issues; }
  const annotated = await createMeasurementValidationWorkbook({ workbook, issues, total: issues.length, filename: "original.xlsx", selectedWellId: "a" });
  const review = annotated.getWorksheet("Mediciones")!;
  assert.match(JSON.stringify(review.getCell("L1").note), /Revisión de validación CAS/);
  assert.match(annotated.getWorksheet("Revisión de validación CAS")!.getCell("B5").text, /Faltan las columnas: Caudal/);
  review.getCell("C1").value = "Caudal (L/s)";
  const corrected = parseMeasurementWorkbook(annotated, wells, "a", now);
  assert.deepEqual(corrected.rowNumbers, [3]);
});


test("validation summaries reuse only their versioned sheet and remove obsolete partial warnings", async () => {
  const { workbook } = await prepare(true);
  workbook.addWorksheet("Revisión de validación CAS").getCell("A1").value = "Mi información original";
  const issues = [{ category: "Carga", row: 3, column: "pH", message: "Revisa el pH." }];
  const first = await createMeasurementValidationWorkbook({ workbook, issues, total: 60, filename: "a.xlsx", selectedWellId: "a" });
  const reopened = await readMeasurementFile(filename(await writeWorkbook(first)));
  assert.equal(reopened.getWorksheet("Revisión de validación CAS")!.getCell("A1").text, "Mi información original");
  assert.match(reopened.getWorksheet("Revisión de validación CAS 2")!.getCell("B3").text, /60 errores/);
  const second = await createMeasurementValidationWorkbook({ workbook: reopened, issues, total: 70, filename: "a.xlsx", selectedWellId: "a" });
  assert.equal(second.worksheets.filter((item) => item.name.startsWith("Revisión de validación CAS")).length, 2);
  assert.match(second.getWorksheet("Revisión de validación CAS 2")!.getCell("B3").text, /70 errores/);
  const complete = await createMeasurementValidationWorkbook({ workbook: second, issues, total: 1, filename: "a.xlsx", selectedWellId: "a" });
  assert.equal(complete.getWorksheet("Revisión de validación CAS 2"), undefined);
  assert.equal(complete.getWorksheet("Revisión de validación CAS")!.getCell("A1").text, "Mi información original");
});


test("very long invalid values remain intact while correction notes fit in an Excel cell", async () => {
  const { workbook, sheet } = await prepare(true);
  const original = "x".repeat(32760);
  sheet.getRow(3).getCell("flowRate").value = original;
  sheet.getRow(3).getCell("pressure").value = original;
  let issues: MeasurementWorkbookError["issues"] = [];
  try { parseMeasurementWorkbook(workbook, wells, "a", now); }
  catch (error) { assert.ok(error instanceof MeasurementWorkbookError); issues = error.issues; }
  assert.equal(issues.length, 2);
  const annotated = await createMeasurementValidationWorkbook({ workbook, issues, total: 2, filename: "a.xlsx", selectedWellId: "a" });
  const reopened = await readMeasurementFile(filename(await writeWorkbook(annotated)));
  const review = reopened.getWorksheet("Mediciones")!;
  assert.equal(review.getCell("C3").text, original);
  assert.equal(review.getCell("G3").text, original);
  assert.ok(review.getCell("L3").text.length < 32767);
  assert.match(review.getCell("L3").text, /Caudal/);
  assert.match(review.getCell("L3").text, /Presión/);
});
