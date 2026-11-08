import {
  CircleAlert,
  ClipboardPlus,
  Download,
  Upload
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Panel } from "../../components/Panel";
import {
  downloadMeasurementTemplate,
  downloadMeasurementValidationWorkbook,
  type MeasurementValidationReport,
} from "../../features/wells/measurementWorkbook";
import {
  type WellRegistryEntry
} from "../../services/wellsApi";
import type { RemoteLoadStatus } from "../../types/remote";


import type { WellMeasurementFormState } from "./wellsView.types";

const suggestedWaterLevelCondition = (isOperating: string) => {
  if (isOperating === "true") return "dynamic";
  if (isOperating === "false") return "static";
  return "unknown";
};

export function WellMeasurementIngestPanel({
  selectedWellId,
  csvMessage,
  csvStatus,
  entries,
  form,
  individualStatus,
  message,
  onChange,
  onCsvUpload,
  onValidationClear,
  validationReport,
  onSubmit,
}: {
  selectedWellId: string;
  csvMessage: string | null;
  csvStatus: RemoteLoadStatus;
  entries: WellRegistryEntry[];
  form: WellMeasurementFormState;
  individualStatus: RemoteLoadStatus;
  message: string | null;
  onChange: (next: Partial<WellMeasurementFormState>) => void;
  onValidationClear: () => void;
  validationReport: MeasurementValidationReport | null;
  onCsvUpload: (file: File, fallbackWellId: string) => Promise<boolean>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const hasRegistryEntries = entries.length > 0;
  const isMeasurementOperationLoading =
    individualStatus === "loading" || csvStatus === "loading";
  const [selectedCsvFile, setSelectedCsvFile] = useState<File | null>(null);
  const [csvWellId, setCsvWellId] = useState(entries.some((entry) => entry.id === selectedWellId) ? selectedWellId : "");
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [downloadingValidation, setDownloadingValidation] = useState(false);
  const [validationDownloadError, setValidationDownloadError] = useState<string | null>(null);
  useEffect(() => { setValidationDownloadError(null); }, [validationReport]);
  const userSelectedUploadWell = useRef(false);
  useEffect(() => {
    if (!userSelectedUploadWell.current && entries.some((entry) => entry.id === selectedWellId)) setCsvWellId(selectedWellId);
  }, [entries, selectedWellId]);
  useEffect(() => {
    if (validationReport && validationReport.selectedWellId !== csvWellId) onValidationClear();
  }, [csvWellId, validationReport, onValidationClear]);
  const activeValidationReport = validationReport?.selectedWellId === csvWellId ? validationReport : null;
  const selectedUploadWell = entries.find((entry) => entry.id === csvWellId);

  return (
    <div className="measurement-upload-grid">
      <Panel
        title="Medición individual"
      >
        <form className="manual-entry-form measurement-entry-form" onSubmit={onSubmit}>
          <div className="well-admin-intro">
            <span className="well-admin-intro-icon" aria-hidden="true"><ClipboardPlus size={22} /></span>
            <div>
              <h4>Agregar medición</h4>
              <p>Registra los valores medidos en un pozo donde tienes permiso de carga.</p>
            </div>
          </div>
          {!hasRegistryEntries && (
            <div className="measurement-empty-notice" role="status">
              <CircleAlert aria-hidden="true" size={18} strokeWidth={2} />
              <span>
                No tienes pozos asignados para cargar mediciones.
              </span>
            </div>
          )}

          <label>
            <span>Pozo *</span>
            <select
              value={form.wellId}
              onChange={(event) => onChange({ wellId: event.target.value })}
              required
              disabled={!hasRegistryEntries}
            >
              <option value="">Selecciona un pozo</option>
              {entries.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} · {entry.codigoObra ?? `${entry.casCode} (${entry.lat.toFixed(4)}, ${entry.lng.toFixed(4)})`}
                </option>
              ))}
            </select>
            <small className="field-help">Solo aparecen pozos donde tienes permiso de carga.</small>
          </label>

          <div className="manual-two-col">
            <label>
              <span>RUT de quien mide *</span>
              <input
                type="text"
                value={form.userRut}
                placeholder="20999888-7"
                onChange={(event) => onChange({ userRut: event.target.value })}
                required
              />
              <small className="field-help">
                RUT de la persona que hizo la medición.
              </small>
            </label>
          </div>

          <div className="manual-two-col measurement-datetime-row">
            <label>
              <span>Fecha de medición *</span>
              <input
                type="date"
                value={form.measurementDate}
                onChange={(event) => onChange({ measurementDate: event.target.value })}
                required
              />
            </label>
            <label>
              <span>Hora de medición *</span>
              <input
                type="time"
                value={form.measurementTime}
                onChange={(event) => onChange({ measurementTime: event.target.value })}
                required
              />
              <small className="field-help">Hora de Chile continental.</small>
            </label>
          </div>

          <div className="manual-two-col">
            <label>
              <span>Caudal *</span>
              <input
                type="number"
                min="0"
                step="any"
                value={form.flowRate}
                placeholder="1.00"
                onChange={(event) => onChange({ flowRate: event.target.value })}
                required
              />
            </label>
            <label>
              <span>Nivel freatico</span>
              <input
                type="number"
                min="0"
                step="any"
                value={form.waterTableDepth}
                placeholder="9.85"
                onChange={(event) => onChange({ waterTableDepth: event.target.value })}
              />
            </label>
          </div>

          <div className="manual-two-col">
            <label>
              <span>Presion</span>
              <input
                type="number"
                min="0"
                step="any"
                value={form.pressure}
                onChange={(event) => onChange({ pressure: event.target.value })}
              />
            </label>
            <label>
              <span>pH</span>
              <input
                type="number"
                min="0"
                max="14"
                step="any"
                value={form.ph}
                onChange={(event) => onChange({ ph: event.target.value })}
              />
            </label>
          </div>

          <div className="manual-two-col">
            <label>
              <span>Conductividad</span>
              <input
                type="number"
                min="0"
                step="any"
                value={form.conductivity}
                onChange={(event) => onChange({ conductivity: event.target.value })}
              />
            </label>
            <label>
              <span>Totalizador *</span>
              <input
                type="number"
                min="0"
                step="1"
                value={form.totalizer}
                placeholder="1010"
                onChange={(event) => onChange({ totalizer: event.target.value })}
                required
              />
            </label>
          </div>

          <div className="manual-two-col">
            <label>
              <span>Estado operacional</span>
              <select
                value={form.isOperating}
                onChange={(event) => {
                  const isOperating = event.target.value;
                  onChange({
                    isOperating,
                    ...(form.waterLevelCondition === ""
                      ? { waterLevelCondition: suggestedWaterLevelCondition(isOperating) }
                      : {}),
                  });
                }}
              >
                <option value="">Sin informar</option>
                <option value="true">Encendido</option>
                <option value="false">Apagado</option>
              </select>
            </label>
            <label>
              <span>Tipo de nivel</span>
              <select
                value={form.waterLevelCondition}
                onChange={(event) => onChange({ waterLevelCondition: event.target.value })}
              >
                <option value="">Sin informar</option>
                <option value="static">Estático</option>
                <option value="dynamic">Dinámico</option>
                <option value="unknown">Desconocido</option>
              </select>
            </label>
          </div>

          <label>
            <span>Observaciones (opcional)</span>
            <textarea
              maxLength={1000}
              value={form.observations}
              onChange={(event) => onChange({ observations: event.target.value })}
            />
            <small className="field-help">
              Por ejemplo: bomba en mantención, sensor con falla. Máximo 1.000 caracteres.
            </small>
          </label>

          {message && (
            <p
              className={`form-feedback ${individualStatus === "ready" ? "is-success" : "is-error"}`}
              role={individualStatus === "error" ? "alert" : "status"}
              aria-live={individualStatus === "error" ? "assertive" : "polite"}
            >
              {message}
            </p>
          )}
          <button
            type="submit"
            disabled={isMeasurementOperationLoading || !hasRegistryEntries}
          >
            {individualStatus === "loading"
              ? "Guardando..."
              : "Guardar medicion individual"}
          </button>
        </form>
      </Panel>

      <Panel title="Carga Excel" subtitle="Carga una o varias mediciones">
        <div className="csv-upload-box">
          <button
            type="button"
            className="csv-template-action"
            disabled={!hasRegistryEntries || isMeasurementOperationLoading}
            onClick={async () => {
              setTemplateError(null);
              try { await downloadMeasurementTemplate(selectedUploadWell); }
              catch { setTemplateError("No pudimos preparar la planilla. Intenta nuevamente."); }
            }}
          >
            <Download size={16} />
            Descargar planilla
          </button>
          <label>
            <span>Pozo para la carga</span>
            <select aria-label="Pozo para la carga" className="well-chart-select" value={csvWellId} onChange={(event) => { userSelectedUploadWell.current = true; setCsvWellId(event.target.value); onValidationClear(); }} disabled={!hasRegistryEntries || isMeasurementOperationLoading}>
              <option value="">Varios pozos (indicarlos en la planilla)</option>
              {entries.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} · {entry.codigoObra ?? `${entry.casCode} (${entry.lat.toFixed(4)}, ${entry.lng.toFixed(4)})`}
                </option>
              ))}
            </select>
            <small className="field-help">{selectedUploadWell ? `Las mediciones se cargarán en el pozo ${selectedUploadWell.name}` : "La planilla incluirá la columna Pozo: escribe su nombre o código en cada fila."}</small>
          </label>
          <input
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            aria-label="Planilla Excel de mediciones"
            type="file"
            disabled={isMeasurementOperationLoading || !hasRegistryEntries}
            onChange={(event) => {
              const file = event.target.files?.[0];
              setSelectedCsvFile(file ?? null);
              onValidationClear();
              event.currentTarget.value = "";
            }}
          />
          {selectedCsvFile && (
            <span className="csv-selected-file">{selectedCsvFile.name}</span>
          )}
          <button
            type="button"
            className="csv-upload-action"
            disabled={isMeasurementOperationLoading || !selectedCsvFile}
            onClick={async () => {
              if (!selectedCsvFile) {
                return;
              }
              const uploaded = await onCsvUpload(selectedCsvFile, csvWellId);
              if (uploaded) {
                setSelectedCsvFile(null);
              }
            }}
          >
            <Upload size={16} />
            {csvStatus === "loading" ? "Cargando..." : "Cargar mediciones"}
          </button>
          <small>Máximo 1.000 mediciones y 5 MiB. Se guardan todas juntas solo si no hay errores.</small>
          {templateError && <p role="alert">{templateError}</p>}
          {activeValidationReport && csvStatus === "error" && (
            <>
              <button type="button" className="csv-template-action" disabled={downloadingValidation || isMeasurementOperationLoading}
                onClick={async () => {
                  setDownloadingValidation(true);
                  setValidationDownloadError(null);
                  try { await downloadMeasurementValidationWorkbook(activeValidationReport); }
                  catch { setValidationDownloadError("No pudimos preparar el Excel con las correcciones. Intenta nuevamente."); }
                  finally { setDownloadingValidation(false); }
                }}>
                <Download size={16} />
                {downloadingValidation ? "Preparando Excel..." : "Descargar Excel con observaciones"}
              </button>
              <small>Corrige las celdas indicadas en «Notas de validación CAS» y vuelve a cargar el archivo. Tus observaciones originales se conservan. Si aparece la hoja «Revisión de validación CAS», revisa también sus indicaciones.
                {activeValidationReport.total > activeValidationReport.issues.length ? ` El archivo incluye ${activeValidationReport.issues.length} de ${activeValidationReport.total} errores; los restantes se revisarán al volver a cargarlo.` : ""}
              </small>
            </>
          )}
          {validationDownloadError && <p role="alert">{validationDownloadError}</p>}
          {csvMessage && (
            <p
              style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
              className={`form-feedback ${csvStatus === "ready" ? "is-success" : "is-error"}`}
              role={csvStatus === "error" ? "alert" : "status"}
              aria-live={csvStatus === "error" ? "assertive" : "polite"}
            >
              {csvMessage}
            </p>
          )}
        </div>
      </Panel>
    </div>
  );
}
