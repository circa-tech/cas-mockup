import {
  CircleAlert,
  Download,
  Upload
} from "lucide-react";
import { FormEvent, useState } from "react";
import { Panel } from "../../components/Panel";
import {
  downloadMeasurementCsvTemplate
} from "../../features/wells/measurementCsv";
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
  csvMessage,
  csvStatus,
  entries,
  form,
  individualStatus,
  message,
  onChange,
  onCsvUpload,
  onSubmit,
}: {
  csvMessage: string | null;
  csvStatus: RemoteLoadStatus;
  entries: WellRegistryEntry[];
  form: WellMeasurementFormState;
  individualStatus: RemoteLoadStatus;
  message: string | null;
  onChange: (next: Partial<WellMeasurementFormState>) => void;
  onCsvUpload: (file: File) => Promise<boolean>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const hasRegistryEntries = entries.length > 0;
  const isMeasurementOperationLoading =
    individualStatus === "loading" || csvStatus === "loading";
  const [selectedCsvFile, setSelectedCsvFile] = useState<File | null>(null);

  return (
    <div className="measurement-upload-grid">
      <Panel
        title="Agregar medicion"
        subtitle="Carga directa desde el mockup"
      >
        <form className="manual-entry-form" onSubmit={onSubmit}>
          {!hasRegistryEntries && (
            <div className="measurement-empty-notice" role="status">
              <CircleAlert aria-hidden="true" size={18} strokeWidth={2} />
              <span>
                No hay pozos registrados. Crea un pozo antes de agregar mediciones.
              </span>
            </div>
          )}

          <label>
            <span>Pozo</span>
            <select
              value={form.codigoObra}
              onChange={(event) => onChange({ codigoObra: event.target.value })}
              required
              disabled={!hasRegistryEntries}
            >
              <option value="">Selecciona un pozo</option>
              {entries.map((entry) => (
                <option key={entry.id} value={entry.codigoObra}>
                  {entry.name} - {entry.codigoObra}
                </option>
              ))}
            </select>
          </label>

          <div className="manual-two-col">
            <label>
              <span>RUT empresa</span>
              <input
                type="text"
                value={form.companyRut}
                placeholder="77555666-7"
                onChange={(event) => onChange({ companyRut: event.target.value })}
                required
              />
            </label>
            <label>
              <span>RUT usuario</span>
              <input
                type="text"
                value={form.userRut}
                placeholder="20999888-7"
                onChange={(event) => onChange({ userRut: event.target.value })}
                required
              />
            </label>
          </div>

          <div className="manual-two-col">
            <label>
              <span>Fecha medicion</span>
              <input
                type="date"
                value={form.measurementDate}
                onChange={(event) => onChange({ measurementDate: event.target.value })}
                required
              />
            </label>
            <label>
              <span>Hora medicion</span>
              <input
                type="time"
                value={form.measurementTime}
                onChange={(event) => onChange({ measurementTime: event.target.value })}
                required
              />
            </label>
          </div>

          <div className="manual-two-col">
            <label>
              <span>Caudal</span>
              <input
                type="number"
                min="0"
                step="0.01"
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
                step="0.01"
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
                step="0.01"
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
                step="0.01"
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
                step="0.01"
                value={form.conductivity}
                onChange={(event) => onChange({ conductivity: event.target.value })}
              />
            </label>
            <label>
              <span>Totalizador</span>
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
            <span>Observaciones</span>
            <textarea
              maxLength={1000}
              value={form.observations}
              onChange={(event) => onChange({ observations: event.target.value })}
            />
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

      <Panel title="Carga CSV" subtitle="Carga una o varias mediciones">
        <div className="csv-upload-box">
          <button
            type="button"
            className="csv-template-action"
            disabled={!hasRegistryEntries}
            onClick={() => downloadMeasurementCsvTemplate(entries[0]?.codigoObra ?? "")}
          >
            <Download size={16} />
            Descargar plantilla CSV
          </button>
          <input
            accept=".csv,text/csv"
            type="file"
            disabled={isMeasurementOperationLoading || !hasRegistryEntries}
            onChange={(event) => {
              const file = event.target.files?.[0];
              setSelectedCsvFile(file ?? null);
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
              const uploaded = await onCsvUpload(selectedCsvFile);
              if (uploaded) {
                setSelectedCsvFile(null);
              }
            }}
          >
            <Upload size={16} />
            {csvStatus === "loading" ? "Cargando..." : "Cargar archivo CSV"}
          </button>
          {csvMessage && (
            <p
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
