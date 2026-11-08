import { ApiRequestError } from "../../services/apiError";
import { MeasurementWorkbookError, type WorkbookIssue } from "./measurementWorkbook";

const columns: Record<string, string> = {
  wellId: "Pozo", well_id: "Pozo", measurementDate: "Fecha y hora", measurement_date: "Fecha y hora",
  measurementTime: "Fecha y hora", measurement_time: "Fecha y hora", flowRate: "Caudal (L/s)", flow_rate: "Caudal (L/s)",
  waterTableDepth: "Nivel (m)", water_table_depth: "Nivel (m)", waterLevelCondition: "Tipo", water_level_condition: "Tipo",
  userRut: "RUT de quien mide", user_rut: "RUT de quien mide", totalizer: "Totalizador", pressure: "Presión", ph: "pH",
  conductivity: "Conductividad", observations: "Observaciones", isOperating: "En operación", is_operating: "En operación",
};
export const workbookUploadIssues = (error: unknown, rowNumbers: number[] = []): { issues: WorkbookIssue[]; total: number } => {
  if (error instanceof MeasurementWorkbookError) return { issues: error.issues, total: error.issues.length };
  if (!(error instanceof ApiRequestError) || ![400, 403, 404, 422].includes(error.status)) return { issues: [], total: 0 };
  const raw = error.rawDetail;
  const details = Array.isArray(raw) ? raw : raw && typeof raw === "object" && "errors" in raw && Array.isArray(raw.errors) ? raw.errors : [];
  const issues: WorkbookIssue[] = details.filter((item) => item && typeof item === "object").map((item) => {
    const loc = Array.isArray(item.loc) ? item.loc : [];
    const measurementIndex = loc.indexOf("measurements");
    const index = typeof item.row === "number" ? item.row - 1 : measurementIndex >= 0 ? loc[measurementIndex + 1] : undefined;
    const field = item.field ?? loc.at(-1);
    const column = columns[String(field)] ?? "Medición";
    return { category: "Revisión de la carga", row: typeof index === "number" ? rowNumbers[index] : undefined, column,
      message: item.code === "permission" ? "Ya no tienes permiso para cargar en este pozo. Revisa el pozo seleccionado."
        : item.code === "not_found" ? "El pozo ya no está disponible. Revisa su nombre en Administrar pozos."
        : item.code === "duplicate" ? "Esta medición está repetida. Deja una sola fila por pozo, fecha y hora."
        : `Revisa ‘${column}’ y corrige el valor siguiendo la hoja Instrucciones.` };
  });
  const reportedTotal = raw && typeof raw === "object" && "totalErrors" in raw ? Number(raw.totalErrors) : issues.length;
  return { issues, total: Number.isInteger(reportedTotal) && reportedTotal > issues.length ? reportedTotal : issues.length };
};

export const workbookUploadErrorMessage = (error: unknown, rowNumbers: number[] = []) => {
  const { issues, total } = workbookUploadIssues(error, rowNumbers);
  if (issues.length) {
    const message = new MeasurementWorkbookError(issues).message;
    return total > issues.length ? message.replace(/Encontramos \d+ (?:error|errores)\./, `Encontramos ${total} errores. Mostramos los primeros ${Math.min(50, issues.length)}.`) : message;
  }
  if (error instanceof ApiRequestError) {
    if (error.status === 409) return "Ya existe una medición con otros valores para uno de los pozos, fechas y horas del archivo. No se cargó ninguna fila. Revisa las mediciones existentes antes de volver a intentarlo.";
    if (error.status === 403) return "Ya no tienes permiso para cargar en uno de estos pozos. No se cargó ninguna medición. Actualiza la página y revisa tus pozos disponibles.";
    if (error.status === 404) return "Uno de los pozos ya no está disponible. No se cargó ninguna medición. Revisa el nombre en Administrar pozos.";
    if (error.status === 422) return "Hay datos que debemos revisar. No se cargó ninguna medición. Revisa los campos obligatorios, fechas y valores de acuerdo con la hoja Instrucciones.";
    return "Tuvimos un problema al confirmar la carga. Intenta nuevamente en unos minutos; las mediciones ya recibidas no se duplicarán.";
  }
  return error instanceof Error && !(error instanceof TypeError) ? error.message
    : "No pudimos confirmar la carga. Revisa tu conexión y vuelve a intentarlo; las mediciones ya recibidas no se duplicarán.";
};
