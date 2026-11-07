import { normalizeMeasurementNumber, measurementNumberOutOfRange } from "./measurementNumbers";
import type { IngestWellMeasurementPayload, WellRegistryEntry } from "../../services/wellsApi";
import { chileTimeZone, dateInChile, toZonedDateTimeIso } from "../../utils/date";
import { createWorkbook, downloadWorkbook, excelDateFormat, readWorkbook, type CellValue, type Workbook } from "../../utils/workbook";

const MAX_ROWS = 1000;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 32 * 1024 * 1024;
type Well = Pick<WellRegistryEntry, "id" | "name" | "codigoObra">;
type Field = "well" | "date" | "userRut" | "flowRate" | "waterTableDepth" | "waterLevelCondition" | "totalizer" | "pressure" | "ph" | "conductivity" | "isOperating" | "observations";
export type WorkbookIssue = { category: string; row?: number; column?: string; message: string };
export class MeasurementWorkbookError extends Error {
  constructor(readonly issues: WorkbookIssue[]) {
    const shown = issues.slice(0, 50);
    const groups = new Map<string, WorkbookIssue[]>();
    for (const issue of shown) groups.set(issue.category, [...(groups.get(issue.category) ?? []), issue]);
    super(`Encontramos ${issues.length} ${issues.length === 1 ? "error" : "errores"}. No se cargó ninguna medición.${issues.length > 50 ? " Mostramos los primeros 50." : ""}\n\n` +
      [...groups].map(([category, errors]) => `${category}\n${errors.map((issue) => `${issue.row ? `Fila ${issue.row}${issue.column ? `, «${issue.column}»` : ""}: ` : ""}${issue.message}`).join("\n")}`).join("\n\n"));
    this.name = "MeasurementWorkbookError";
  }
}

export const normalizeHeader = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/\*/g, "").replace(/\s+/g, " ").trim();
const columns: { id: Field; title: string; required: boolean; description: string; format: string; example: CellValue; aliases?: string[] }[] = [
  { id: "well", title: "Pozo", required: true, description: "Pozo donde se tomó la medición.", format: "Nombre o código de un pozo donde tienes permiso.", example: "Pozo Norte", aliases: ["codigoobra", "código de obra"] },
  { id: "date", title: "Fecha y hora", required: true, description: "Momento de la medición, en hora de Chile.", format: "dd-mm-aaaa hh:mm", example: new Date("2026-01-15T10:30:00Z") },
  { id: "userRut", title: "RUT de quien mide", required: true, description: "Identificación de la persona que midió.", format: "Con o sin puntos y guion.", example: "12.345.678-5", aliases: ["userrut"] },
  { id: "flowRate", title: "Caudal (L/s)", required: true, description: "Agua extraída por segundo.", format: "Número mayor o igual a cero; coma o punto decimal.", example: 3.5, aliases: ["caudal", "flowrate"] },
  { id: "waterTableDepth", title: "Nivel (m)", required: false, description: "Profundidad del agua bajo el suelo.", format: "Número mayor o igual a cero.", example: 12.75, aliases: ["nivel", "watertabledepth", "nivel freático"] },
  { id: "waterLevelCondition", title: "Tipo", required: false, description: "Condición del nivel medido.", format: "Estático o Dinámico.", example: "Dinámico", aliases: ["waterlevelcondition"] },
  { id: "totalizer", title: "Totalizador", required: true, description: "Lectura acumulada del medidor.", format: "Entero entre 0 y 999999999999999.", example: 1250 },
  { id: "pressure", title: "Presión", required: false, description: "Lectura de presión.", format: "Número mayor o igual a cero.", example: 2.15, aliases: ["pressure"] },
  { id: "ph", title: "pH", required: false, description: "Acidez del agua.", format: "Número entre 0 y 14.", example: 7.2 },
  { id: "conductivity", title: "Conductividad", required: false, description: "Lectura de conductividad del agua.", format: "Número mayor o igual a cero.", example: 850.25, aliases: ["conductivity"] },
  { id: "isOperating", title: "En operación", required: false, description: "Indica si el pozo estaba bombeando.", format: "Sí o No.", example: "Sí", aliases: ["isoperating"] },
  { id: "observations", title: "Observaciones", required: false, description: "Información adicional de terreno.", format: "Texto de hasta 1.000 caracteres.", example: "Medición de ejemplo: modifica esta fila o agrega tus mediciones debajo." },
];
const fieldTitles = Object.fromEntries(columns.map((column) => [column.id, column.title]));
const canonical = (value: CellValue | undefined): unknown => value instanceof Date ? value.toISOString() : value ?? null;
const rowFingerprint = (values: Partial<Record<Field, CellValue>>) => JSON.stringify(Object.fromEntries(
  columns.map(({ id }) => [id, canonical(values[id])]),
));

export const createMeasurementTemplate = async (selectedWell: Well | undefined, now = new Date()) => {
  const workbook = await createWorkbook();
  const sheet = workbook.addWorksheet("Mediciones");
  const fields = columns.filter(({ id }) => id !== "well" || !selectedWell);
  const yesterday = new Date(`${dateInChile(now)}T10:30:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const example = Object.fromEntries(fields.map((field) => [field.id, field.id === "date" ? yesterday : field.example]));
  workbook.creator = "CAS";
  workbook.description = JSON.stringify({ template: "cas-mediciones", version: 1, example: rowFingerprint(example) });
  sheet.columns = fields.map((field) => ({ key: field.id, header: field.title + (field.required ? " *" : ""), width: field.id === "observations" ? 55 : 25 }));
  sheet.addRow(example);
  sheet.getRow(1).eachCell((cell, index) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fields[index - 1].required ? "FF0B6470" : "FFE2E8F0" } };
    cell.font = { bold: true, color: { argb: fields[index - 1].required ? "FFFFFFFF" : "FF243746" } };
  });
  sheet.getRow(2).font = { italic: true, color: { argb: "FF64748B" } };
  sheet.getRow(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
  sheet.getColumn("date").numFmt = excelDateFormat;
  for (const id of ["flowRate", "waterTableDepth", "totalizer", "pressure", "ph", "conductivity"]) sheet.getColumn(id).numFmt = "0.###############";
  for (let row = 2; row <= MAX_ROWS + 2; row++) sheet.getRow(row).getCell("waterLevelCondition").dataValidation = {
    type: "list", allowBlank: true, formulae: ['"Estático,Dinámico"'], showErrorMessage: true,
    errorTitle: "Revisa el tipo", error: "Elige Estático o Dinámico.",
  };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  const instructions = workbook.addWorksheet("Instrucciones");
  instructions.columns = [{ width: 26 }, { width: 18 }, { width: 48 }, { width: 57 }, { width: 58 }];
  instructions.addRow(["Completa Mediciones. No cambies los nombres de las columnas ni agregues o borres columnas."]);
  instructions.mergeCells("A1:E1");
  instructions.addRow(["La fila gris es un ejemplo: si no la modificas, se ignora. Agrega tus mediciones debajo o reemplaza el ejemplo."]);
  instructions.mergeCells("A2:E2");
  instructions.addRow([selectedWell ? `Todas las mediciones se cargarán en el pozo ${selectedWell.name}.` : "Indica el nombre o código del pozo en cada fila."]);
  instructions.mergeCells("A3:E3");
  instructions.addRow(["Máximo: 1.000 mediciones y 5 MiB. Si hay errores, no se guarda ninguna medición."]);
  instructions.mergeCells("A4:E4");
  instructions.addRow([]);
  instructions.addRow(["Campo", "¿Obligatorio?", "Qué significa", "Formato o valores permitidos", "Ejemplo"]);
  instructions.getRow(6).font = { bold: true };
  for (const field of fields) instructions.addRow([field.title, field.required ? "Sí" : "No", field.description, field.format,
    field.id === "date" ? `${yesterday.getUTCDate()}-${yesterday.getUTCMonth() + 1}-${yesterday.getUTCFullYear()} 10:30` : field.example]);
  instructions.eachRow((row) => { row.alignment = { vertical: "top", wrapText: true }; });
  return workbook;
};
export const downloadMeasurementTemplate = async (selectedWell?: Well) =>
  downloadWorkbook(await createMeasurementTemplate(selectedWell), "Planilla_mediciones.xlsx");

const scalar = (value: CellValue): string | number | boolean | Date | null => {
  if (value === null || value === undefined || typeof value !== "object" || value instanceof Date) return value ?? null;
  if ("richText" in value) return value.richText.map((part) => part.text).join("");
  // Formula results may be stale; require the user to paste values instead.
  throw new Error("Copia y pega el resultado como valor, sin fórmulas ni enlaces.");
};
const textValue = (value: unknown) => value === null || value === undefined ? "" : String(value).trim();
export const normalizeMeasurementRut = (value: string): string | null => {
  const compact = value.replace(/[.\s-]/g, "").toUpperCase();
  return /^\d{7,8}[0-9K]$/.test(compact) ? `${compact.slice(0, -1)}-${compact.slice(-1)}` : null;
};
export const parseMeasurementDate = (value: unknown): { date: string; time: string; instant: number } | null => {
  let wall: string;
  if (value instanceof Date && Number.isFinite(value.getTime())) wall = value.toISOString().slice(0, 19);
  else if (typeof value === "number" && Number.isFinite(value) && value >= 1 && value < 2958466) {
    // Unformatted Excel serials use the standard 1900 date system (including its leap-year offset).
    if (Math.floor(value) === 60) return null;
    wall = new Date(Math.round((value - (value < 60 ? 25568 : 25569)) * 86400000)).toISOString().slice(0, 19);
  } else {
    const raw = textValue(value);
    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw);
    const chile = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw);
    if (!iso && !chile) return null;
    const parts = iso ? [iso[1], iso[2], iso[3], iso[4], iso[5], iso[6] ?? "0"]
      : [chile![3], chile![2], chile![1], chile![4], chile![5], chile![6] ?? "0"];
    wall = `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}T${parts[3].padStart(2, "0")}:${parts[4]}:${parts[5].padStart(2, "0")}`;
  }
  const parsed = new Date(wall + "Z");
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 19) !== wall) return null;
  const date = wall.slice(0, 10), time = wall.slice(11);
  const instant = Date.parse(toZonedDateTimeIso(date, time) ?? "");
  if (!Number.isFinite(instant)) return null;
  const rendered = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: chileTimeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant)).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  if (`${rendered.year}-${rendered.month}-${rendered.day}T${rendered.hour}:${rendered.minute}:${rendered.second}` !== wall) return null;
  return { date, time, instant };
};

export const parseMeasurementWorkbook = (workbook: Workbook, wells: readonly Well[], selectedWellId = "", now = new Date()) => {
  const issues: WorkbookIssue[] = [];
  const sheet = workbook.worksheets.find((sheet) => normalizeHeader(sheet.name) === "mediciones");
  if (!sheet) throw new MeasurementWorkbookError([{ category: "Planilla", message: "No encontramos la hoja ‘Mediciones’. Descarga la planilla y completa tus datos allí." }]);
  const fields = new Map<Field, number>();
  const aliases = new Map(columns.flatMap((column) => [column.title, ...(column.aliases ?? [])].map((alias) => [normalizeHeader(alias), column.id] as const)));
  sheet.getRow(1).eachCell((cell, index) => {
    const header = normalizeHeader(cell.text);
    if (["companyrut", "rut del titular", "rut titular"].includes(header)) return;
    const field = aliases.get(header);
    if (field && fields.has(field)) issues.push({ category: "Planilla", row: 1, column: fieldTitles[field], message: "Esta columna aparece más de una vez. Deja solo una." });
    else if (field) fields.set(field, index);
  });
  const missing = columns.filter((column) => column.required && (column.id !== "well" || !selectedWellId) && !fields.has(column.id));
  if (missing.length) issues.push({ category: "Planilla", message: `No reconocimos la planilla. Faltan las columnas: ${missing.map((column) => column.title).join(", ")}. Descarga la planilla nuevamente y no cambies los nombres de las columnas.` });
  if (issues.length) throw new MeasurementWorkbookError(issues);
  let example: string | undefined;
  try { const metadata = JSON.parse(workbook.description); if (metadata.template === "cas-mediciones" && metadata.version === 1) example = metadata.example; } catch { /* Legacy sheets have no marker. */ }
  const payloads: IngestWellMeasurementPayload[] = [];
  const rowNumbers: number[] = [];
  const duplicateRows = new Map<string, number[]>();
  let dataRows = 0;
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const raw = Object.fromEntries([...fields].map(([id, index]) => [id, row.getCell(index).value]));
    if (Object.values(raw).every((value) => value === null || value === undefined || (typeof value === "string" && !value.trim()))) return;
    if (example && rowFingerprint(raw) === example) return;
    dataRows++;
    if (dataRows > MAX_ROWS) return;
    const values: Partial<Record<Field, ReturnType<typeof scalar>>> = {};
    const issue = (category: string, field: Field, message: string) => issues.push({ category, row: rowNumber, column: fieldTitles[field], message });
    for (const [id, value] of Object.entries(raw)) {
      try { values[id as Field] = scalar(value); }
      catch (error) { issue("Valores", id as Field, (error as Error).message); }
    }
    for (const column of columns) if (column.required && (column.id !== "well" || !selectedWellId) && !textValue(values[column.id])) issue("Campos obligatorios", column.id, "Falta completar este campo, que es obligatorio.");
    const wellText = textValue(values.well);
    const matches = selectedWellId ? wells.filter((well) => well.id === selectedWellId)
      : wells.filter((well) => [well.name, well.codigoObra].some((value) => value && normalizeHeader(value) === normalizeHeader(wellText)));
    if (matches.length !== 1) issue("Pozos", "well", matches.length ? `El nombre ‘${wellText}’ coincide con varios pozos. Usa el código o selecciona un pozo en la pantalla.` : `No encontramos el pozo ‘${wellText || selectedWellId}’ entre tus pozos permitidos. Revisa el nombre en Administrar pozos.`);
    const date = parseMeasurementDate(typeof values.date === "number" && workbook.properties.date1904 ? values.date + 1462 : values.date);
    if (!date && textValue(values.date)) issue("Fechas", "date", `‘${textValue(values.date)}’ no es una fecha válida. Usa dd-mm-aaaa hh:mm, en hora de Chile.`);
    if (date && date.instant > now.getTime()) issue("Fechas", "date", "La fecha es posterior a ahora. Revisa que sea correcta.");
    const rut = normalizeMeasurementRut(textValue(values.userRut));
    if (!rut && textValue(values.userRut)) issue("Identificación", "userRut", "Revisa el RUT de quien mide. Usa, por ejemplo, 12.345.678-5.");
    const numeric = (id: Field, maximum: number, inclusive = false, integer = false): string | null => {
      const rawValue = textValue(values[id]);
      if (!rawValue) return null;
      const normalized = normalizeMeasurementNumber(rawValue);
      if (normalized === null) { issue("Valores numéricos", id, `‘${rawValue}’ no es un número. Escribe solo números, por ejemplo 12,5.`); return null; }
      if ((normalized.split(".")[1]?.length ?? 0) > 16383) issue("Límites de almacenamiento", id, "El número supera el máximo de 16.383 decimales. Reduce la cantidad de decimales antes de cargarlo.");
      if (measurementNumberOutOfRange(normalized, maximum, inclusive)) issue("Rangos", id, `El valor debe ser mayor o igual a cero y ${inclusive ? "menor o igual a" : "menor que"} ${maximum}.`);
      if (integer && normalized.includes(".")) issue("Rangos", id, "Escribe un número entero, sin decimales.");
      return normalized;
    };
    const typeText = normalizeHeader(textValue(values.waterLevelCondition));
    const condition = ["estatico", "static"].includes(typeText) ? "static" : ["dinamico", "dynamic"].includes(typeText) ? "dynamic" : null;
    if (typeText && !condition) issue("Tipo de nivel", "waterLevelCondition", "Debe ser Estático o Dinámico.");
    const operation = normalizeHeader(textValue(values.isOperating));
    const isOperating = ["si", "true"].includes(operation) ? true : ["no", "false"].includes(operation) ? false : null;
    if (operation && isOperating === null) issue("Operación", "isOperating", "Escribe Sí o No.");
    const observations = textValue(values.observations) || null;
    if (observations && observations.length > 1000) issue("Observaciones", "observations", "Acorta el texto a un máximo de 1.000 caracteres.");
    const payload: IngestWellMeasurementPayload = {
      wellId: matches[0]?.id ?? "", userRut: rut ?? "", measurementDate: date?.date ?? "", measurementTime: date?.time ?? "",
      flowRate: numeric("flowRate", 1e8) ?? "", totalizer: numeric("totalizer", 999999999999999, true, true) ?? "",
      waterTableDepth: numeric("waterTableDepth", 1e8), pressure: numeric("pressure", 1e8), ph: numeric("ph", 14, true), conductivity: numeric("conductivity", 1e10),
      waterLevelCondition: condition, isOperating, observations,
    };
    if (date && matches.length === 1) {
      const key = `${payload.wellId}|${date.date}|${date.time}`;
      duplicateRows.set(key, [...(duplicateRows.get(key) ?? []), rowNumber]);
    }
    payloads.push(payload); rowNumbers.push(rowNumber);
  });
  for (const rows of duplicateRows.values()) if (rows.length > 1) for (const row of rows) issues.push({ category: "Mediciones repetidas", row, column: "Fecha y hora", message: `La misma medición aparece en las filas ${rows.join(", ")}. Deja solo una.` });
  if (dataRows > MAX_ROWS) issues.push({ category: "Tamaño", message: `El archivo contiene ${dataRows} mediciones. El máximo es 1.000; divide los datos en varios archivos.` });
  if (!dataRows) issues.push({ category: "Planilla vacía", message: "No encontramos mediciones en el archivo. Ingresa tus datos en la hoja ‘Mediciones’, desde la segunda fila. El ejemplo sin modificar se ignora." });
  if (issues.length) throw new MeasurementWorkbookError(issues);
  return { payloads, rowNumbers };
};

export const readMeasurementFile = async (file: File) => {
  if (!/\.xlsx$/i.test(file.name)) throw new Error("El archivo debe ser de Excel (.xlsx). Descarga la planilla y completa tus datos ahí. Si tienes un CSV, ábrelo en Excel y guárdalo como .xlsx.");
  if (file.size > MAX_BYTES) throw new Error("El archivo supera el límite de 5 MiB. Divide las mediciones en archivos más pequeños.");
  const bytes = await file.arrayBuffer();
  const view = new DataView(bytes);
  if (view.byteLength >= 8 && view.getUint32(0, false) === 0xD0CF11E0) throw new Error("El archivo tiene contraseña o usa un formato antiguo. Quita la contraseña y guárdalo como Excel (.xlsx).");
  if (view.byteLength < 22 || view.getUint32(0, true) !== 0x04034b50) throw new Error("No pudimos abrir el archivo: está vacío o dañado. Ábrelo en Excel y guarda una copia nueva como .xlsx.");
  // Bound expanded ZIP size before handing the workbook to the parser.
  let expanded = 0;
  for (let offset = 0; offset + 46 <= view.byteLength; offset++) if (view.getUint32(offset, true) === 0x02014b50) {
    expanded += view.getUint32(offset + 24, true);
    if (expanded > MAX_EXPANDED_BYTES) throw new Error("La planilla contiene demasiados datos o imágenes. Copia solo las mediciones a una planilla nueva (máximo 1.000 filas y 5 MiB).");
    offset += 45 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
  }
  try { return await readWorkbook(bytes); }
  catch { throw new Error("El archivo está dañado o no pudimos leerlo. Ábrelo en Excel y guarda una copia nueva sin contraseña."); }
};
