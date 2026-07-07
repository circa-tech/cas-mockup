import type {
  IngestWellMeasurementPayload,
  WaterLevelCondition,
} from "../../services/wellsApi";

const toWaterLevelCondition = (value: string): WaterLevelCondition | null =>
  value === "static" || value === "dynamic" || value === "unknown" ? value : null;

const measurementCsvHeaders = [
  "codigoObra",
  "companyRut",
  "userRut",
  "flowRate",
  "measurementDate",
  "measurementTime",
  "waterTableDepth",
  "waterLevelCondition",
  "totalizer",
  "pressure",
  "ph",
  "conductivity",
  "isOperating",
  "observations",
] as const;

const parseCsv = (input: string): string[][] => {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let isQuoted = false;
  const firstLine = input.split(/\r?\n/, 1)[0] ?? "";
  const delimiter =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0)
      ? ";"
      : ",";

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const nextChar = input[index + 1];

    if (char === '"' && isQuoted && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      isQuoted = !isQuoted;
      continue;
    }

    if (char === delimiter && !isQuoted) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !isQuoted) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(current.trim());
      current = "";
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    current += char;
  }

  row.push(current.trim());
  if (isQuoted) {
    throw new Error("El CSV contiene comillas sin cerrar.");
  }
  if (row.some((cell) => cell.length > 0)) {
    rows.push(row);
  }

  return rows;
};

const isValidIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const isValidTime = (value: string) => {
  const match = /^(\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }
  return Number(match[1]) <= 23 && Number(match[2]) <= 59 && Number(match[3]) <= 59;
};

export const parseMeasurementCsv = (
  input: string,
  allowedWorkCodes: ReadonlySet<string>,
): IngestWellMeasurementPayload[] => {
  const [headerRow, ...dataRows] = parseCsv(input);
  if (!headerRow || dataRows.length === 0) {
    throw new Error("El CSV debe incluir encabezado y al menos una fila.");
  }

  const headers = headerRow.map((header) => header.trim());
  if (
    headers.length !== measurementCsvHeaders.length ||
    headers.some((header, index) => header !== measurementCsvHeaders[index])
  ) {
    throw new Error(
      `Las columnas deben estar en este orden: ${measurementCsvHeaders.join(", ")}.`,
    );
  }
  if (dataRows.length > 1000) {
    throw new Error("El CSV no puede contener más de 1000 mediciones.");
  }

  const columnIndex = new Map(headers.map((header, index) => [header, index]));
  const readCell = (row: string[], header: string) => row[columnIndex.get(header) ?? -1] ?? "";
  const logicalKeys = new Set<string>();

  return dataRows.map((row, index) => {
    const rowNumber = index + 2;
    const waterLevelConditionValue = readCell(row, "waterLevelCondition");
    if (row.length !== measurementCsvHeaders.length) {
      throw new Error(
        `Fila ${rowNumber}: se esperaban ${measurementCsvHeaders.length} columnas y se encontraron ${row.length}.`,
      );
    }
    const payload: IngestWellMeasurementPayload = {
      codigoObra: readCell(row, "codigoObra"),
      companyRut: readCell(row, "companyRut"),
      conductivity: readCell(row, "conductivity") || null,
      flowRate: readCell(row, "flowRate"),
      isOperating:
        readCell(row, "isOperating") === ""
          ? null
          : readCell(row, "isOperating") === "true",
      measurementDate: readCell(row, "measurementDate"),
      measurementTime: readCell(row, "measurementTime"),
      observations: readCell(row, "observations") || null,
      ph: readCell(row, "ph") || null,
      pressure: readCell(row, "pressure") || null,
      totalizer: readCell(row, "totalizer"),
      userRut: readCell(row, "userRut"),
      waterTableDepth: readCell(row, "waterTableDepth") || null,
      waterLevelCondition: toWaterLevelCondition(waterLevelConditionValue),
    };

    const optionalHeaders = new Set([
      "waterTableDepth",
      "waterLevelCondition",
      "pressure",
      "ph",
      "conductivity",
      "isOperating",
      "observations",
    ]);
    const requiredHeaders = measurementCsvHeaders.filter(
      (header) => !optionalHeaders.has(header),
    );
    const missingValues = requiredHeaders.filter((header) => {
      const value = payload[header as keyof IngestWellMeasurementPayload];
      return typeof value !== "string" || value.trim().length === 0;
    });
    if (missingValues.length > 0) {
      throw new Error(`Fila ${rowNumber}: faltan valores en ${missingValues.join(", ")}.`);
    }
    if (!/^OB-\d{4}-[1-9]\d*$/.test(payload.codigoObra)) {
      throw new Error(
        `Fila ${rowNumber}: codigoObra debe usar el formato OB-0101-11, sin ceros iniciales en el último bloque.`,
      );
    }
    if (!allowedWorkCodes.has(payload.codigoObra)) {
      throw new Error(`Fila ${rowNumber}: el pozo ${payload.codigoObra} no está registrado.`);
    }
    if (!/^\d{7,8}-[\dkK]$/.test(payload.companyRut)) {
      throw new Error(`Fila ${rowNumber}: companyRut debe usar el formato 77555666-7.`);
    }
    if (!/^\d{7,8}-[\dkK]$/.test(payload.userRut)) {
      throw new Error(`Fila ${rowNumber}: userRut debe usar el formato 20999888-7.`);
    }
    if (!/^\d+\.\d{2}$/.test(payload.flowRate)) {
      throw new Error(`Fila ${rowNumber}: flowRate debe tener exactamente dos decimales.`);
    }
    if (!isValidIsoDate(payload.measurementDate)) {
      throw new Error(`Fila ${rowNumber}: measurementDate debe ser una fecha YYYY-MM-DD válida.`);
    }
    if (!isValidTime(payload.measurementTime)) {
      throw new Error(`Fila ${rowNumber}: measurementTime debe usar HH:MM:SS.`);
    }
    if (
      payload.waterTableDepth !== null &&
      !/^\d+\.\d{2}$/.test(payload.waterTableDepth)
    ) {
      throw new Error(
        `Fila ${rowNumber}: waterTableDepth debe estar vacío o tener exactamente dos decimales.`,
      );
    }
    if (!/^\d{1,15}$/.test(payload.totalizer)) {
      throw new Error(`Fila ${rowNumber}: totalizer debe ser un entero de hasta 15 dígitos.`);
    }
    for (const field of ["pressure", "ph", "conductivity"] as const) {
      const value = payload[field];
      if (value !== null && !/^\d+\.\d{2}$/.test(value)) {
        throw new Error(
          `Fila ${rowNumber}: ${field} debe estar vacío o tener exactamente dos decimales.`,
        );
      }
    }
    if (payload.ph !== null && Number(payload.ph) > 14) {
      throw new Error(`Fila ${rowNumber}: ph debe estar entre 0 y 14.`);
    }
    const operatingValue = readCell(row, "isOperating");
    if (operatingValue !== "" && operatingValue !== "true" && operatingValue !== "false") {
      throw new Error(`Fila ${rowNumber}: isOperating debe estar vacío, true o false.`);
    }
    if (
      waterLevelConditionValue !== "" &&
      waterLevelConditionValue !== "static" &&
      waterLevelConditionValue !== "dynamic" &&
      waterLevelConditionValue !== "unknown"
    ) {
      throw new Error(
        `Fila ${rowNumber}: waterLevelCondition debe estar vacío, static, dynamic o unknown.`,
      );
    }
    if (payload.observations !== null && payload.observations.length > 1000) {
      throw new Error(`Fila ${rowNumber}: observations no puede superar 1000 caracteres.`);
    }

    const logicalKey = [
      payload.codigoObra,
      payload.measurementDate,
      payload.measurementTime,
    ].join("|");
    if (logicalKeys.has(logicalKey)) {
      throw new Error(`Fila ${rowNumber}: la medición está duplicada dentro del archivo.`);
    }
    logicalKeys.add(logicalKey);

    return payload;
  });
};

export const downloadMeasurementCsvTemplate = (workCode: string) => {
  const exampleWorkCode = workCode || "OB-0101-11";
  const content = [
    measurementCsvHeaders.join(","),
    [
      exampleWorkCode,
      "77555666-7",
      "20999888-7",
      "1.00",
      "2026-06-28",
      "10:00:00",
      "9.85",
      "",
      "1010",
      "",
      "",
      "",
      "",
      "",
    ].join(","),
  ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "plantilla_mediciones_pozos.csv";
  anchor.click();
  URL.revokeObjectURL(url);
};
