import { useConfirmationDialog } from "../../components/useConfirmationDialog";
import { MapPinned, Pencil, Plus, Trash2 } from "lucide-react";
import { FormEvent, ReactNode, lazy, useState } from "react";
import type { CasOrganization, WellRegistryEntry } from "../../services/wellsApi";
import type { RemoteLoadStatus } from "../../types/remote";
import type { WellRegistryFormState } from "./wellsView.types";

const StatusLeafletMap = lazy(() =>
  import("../../components/StatusLeafletMap").then((module) => ({
    default: module.StatusLeafletMap,
  })),
);

const emptyWaterRight = () => ({ anio: "", cbr: "", fojas: "", numero: "" });

// Solo centra la vista inicial del mapa; nunca se copia al formulario ni al payload.
const COPIAPO_MAP_CENTER: [number, number] = [-27.3668, -70.3323];

const emptyOwnerContact = () => ({
  email: "",
  phone: "",
  representative: "",
  rut: "",
});

const stringValue = (value: string | number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

const dateValue = (value: string | null | undefined) => value?.slice(0, 10) ?? "";

const waterRightLabel = {
  anio: "Año",
  cbr: "CBR",
  fojas: "Fojas",
  numero: "Número",
} as const;

const entryToForm = (entry: WellRegistryEntry): WellRegistryFormState => ({
  aquiferSector: entry.aquiferSector ?? "",
  authorizedFlowRate: stringValue(entry.authorizedFlowRate),
  authorizedVolume: stringValue(entry.authorizedVolume),
  casId: entry.casId,
  catchmentStatus: entry.catchmentStatus ?? "",
  centroControlRut: entry.centroControlRut ?? "",
  codigoObra: entry.codigoObra,
  datum: entry.datum ?? "",
  fieldContactEmail: entry.fieldContactEmail ?? "",
  fieldContactPhone: entry.fieldContactPhone ?? "",
  fieldContactRepresentative: entry.fieldContactRepresentative ?? "",
  flowmeterBrand: entry.flowmeterBrand ?? "",
  flowmeterDiameter: stringValue(entry.flowmeterDiameter),
  flowmeterInstallationDate: dateValue(entry.flowmeterInstallationDate),
  flowmeterModel: entry.flowmeterModel ?? "",
  habilitationDiameter: stringValue(entry.habilitationDiameter),
  huso: entry.huso ?? "",
  lat: stringValue(entry.lat),
  levelProbeBrand: entry.levelProbeBrand ?? "",
  levelProbeDiameter: stringValue(entry.levelProbeDiameter),
  levelProbeInstallationDate: dateValue(entry.levelProbeInstallationDate),
  levelProbeInstallationDepth: stringValue(entry.levelProbeInstallationDepth),
  locationReference: entry.locationReference ?? "",
  lng: stringValue(entry.lng),
  name: entry.name,
  observations: entry.observations ?? "",
  ownerContacts:
    entry.ownerContacts && entry.ownerContacts.length > 0
      ? entry.ownerContacts.map((contact) => ({
          email: contact.email ?? "",
          phone: contact.phone ?? "",
          representative: contact.representative ?? "",
          rut: contact.rut ?? "",
        }))
      : [emptyOwnerContact()],
  provider: entry.provider ?? "",
  pumpDepth: stringValue(entry.pumpDepth),
  shac: entry.shac ?? "",
  shacSubsector: entry.shacSubsector ?? "",
  telemetryEnabled:
    entry.telemetryEnabled === null || entry.telemetryEnabled === undefined
      ? ""
      : String(entry.telemetryEnabled),
  utmEasting: stringValue(entry.utmEasting),
  utmNorthing: stringValue(entry.utmNorthing),
  waterRights:
    entry.waterRights && entry.waterRights.length > 0
      ? entry.waterRights.map((right) => ({
          anio: stringValue(right.anio),
          cbr: right.cbr ?? "",
          fojas: right.fojas ?? "",
          numero: right.numero ?? "",
        }))
      : [emptyWaterRight()],
  wellDepth: stringValue(entry.wellDepth),
});

type RegistryEditorProps = {
  canDeleteWells: boolean;
  canManageWells: boolean;
  entries: WellRegistryEntry[];
  form: WellRegistryFormState;
  message: string | null;
  onChange: (next: Partial<WellRegistryFormState>) => void;
  onDeleteWell: (wellId: string) => Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateWell: (wellId: string, event: FormEvent<HTMLFormElement>) => Promise<void>;
  organizations: CasOrganization[];
  organizationsError: string | null;
  status: RemoteLoadStatus;
};

export function WellRegistryEditor({
  canDeleteWells,
  canManageWells,
  entries,
  form,
  message,
  onChange,
  onDeleteWell,
  onSubmit,
  onUpdateWell,
  organizations,
  organizationsError,
  status,
}: RegistryEditorProps) {
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [editingWellId, setEditingWellId] = useState<string | null>(null);
  const previewLat = Number.parseFloat(form.lat);
  const previewLng = Number.parseFloat(form.lng);
  const hasPreviewLocation = Number.isFinite(previewLat) && Number.isFinite(previewLng);
  const workCodeError =
    status === "error" && message?.startsWith("Código de obra inválido")
      ? message
      : null;

  const handleWellDelete = async (entry: WellRegistryEntry) => {
    if (!(await confirm({ title: "¿Eliminar este pozo?", description: `Se eliminará el pozo ${entry.codigoObra} del registro activo.`, confirmLabel: "Eliminar pozo", destructive: true }))) return;
    await onDeleteWell(entry.id);
    if (editingWellId === entry.id) setEditingWellId(null);
  };

  return (
    <>
      {confirmationDialog}
      <form
        className="manual-entry-form registry-editor-form"
        onInvalid={(event) => {
          let details = (event.target as HTMLElement).closest("details");
          while (details) {
            details.open = true;
            details = details.parentElement?.closest("details") ?? null;
          }
        }}
        onSubmit={(event) => {
          if (editingWellId) {
            void onUpdateWell(editingWellId, event);
            return;
          }
          onSubmit(event);
        }}
      >
        <div className="well-admin-intro">
          <span className="well-admin-intro-icon" aria-hidden="true"><MapPinned size={22} /></span>
          <div>
            <h4>Registro de pozos</h4>
            <p>Completa los datos del pozo, revisa su ubicación en el mapa y guárdalo.</p>
          </div>
        </div>
        <div className="registry-primary-grid">
          <section className="registry-required-card" aria-labelledby="registry-required-heading">
            <h4 id="registry-required-heading">Datos obligatorios</h4>
            <label>
              <span>CAS *</span>
              <select
                value={form.casId}
                onChange={(event) => onChange({ casId: event.target.value })}
                aria-describedby={organizationsError ? "organizations-error" : undefined}
                aria-invalid={Boolean(organizationsError)}
                required
              >
                {organizations.length === 0 && <option value="">Sin CAS disponibles</option>}
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.code} - {organization.name}
                  </option>
                ))}
              </select>
              {organizationsError && (
                <small id="organizations-error" className="field-error" role="alert">
                  {organizationsError}
                </small>
              )}
            </label>

            <div className="manual-two-col">
              <label>
                <span>Código de obra DGA * (ej. OB-0101-11)</span>
                <input
                  type="text"
                  value={form.codigoObra}
                  placeholder="OB-0101-11"
                  onChange={(event) => onChange({ codigoObra: event.target.value })}
                  aria-describedby={workCodeError ? "well-code-error" : undefined}
                  aria-invalid={Boolean(workCodeError)}
                  required
                />
                {workCodeError && (
                  <small id="well-code-error" className="field-error" role="alert">
                    {workCodeError}
                  </small>
                )}
              </label>
              <label>
                <span>Nombre *</span>
                <input
                  type="text"
                  value={form.name}
                  placeholder="Pozo Norte"
                  onChange={(event) => onChange({ name: event.target.value })}
                  required
                />
              </label>
            </div>

            <div className="manual-two-col">
              <label>
                <span>Latitud *</span>
                <input
                  type="number"
                  step="0.000001"
                  value={form.lat}
                  placeholder="Latitud real del pozo"
                  onChange={(event) => onChange({ lat: event.target.value })}
                  required
                />
              </label>
              <label>
                <span>Longitud *</span>
                <input
                  type="number"
                  step="0.000001"
                  value={form.lng}
                  placeholder="Longitud real del pozo"
                  onChange={(event) => onChange({ lng: event.target.value })}
                  required
                />
              </label>
            </div>
          </section>
          <section className="registry-map-card" aria-labelledby="registry-map-heading">
            <h4 id="registry-map-heading">Ubicación en mapa</h4>
            <div className="registry-map-preview">
              <StatusLeafletMap
                className="is-registry-preview"
                initialCenter={COPIAPO_MAP_CENTER}
                initialZoom={10}
                points={
                  hasPreviewLocation ? [
                    {
                      id: "new-well-preview",
                      lat: previewLat,
                      lastUpdate: new Date().toISOString(),
                      lng: previewLng,
                      name: form.name || form.codigoObra || "Nuevo pozo",
                      sourceType: "manual",
                      status: "fresh",
                    },
                  ] : []
                }
                selectedPointId={hasPreviewLocation ? "new-well-preview" : undefined}
                selectedPointZoom={hasPreviewLocation ? 16 : undefined}
              />
            </div>
            <p className="registry-map-hint">
              {hasPreviewLocation
                ? "El marcador muestra las coordenadas ingresadas."
                : "Ingresa la latitud y longitud del pozo para marcar su ubicación en el mapa."}
            </p>
          </section>
        </div>

        <details className="registry-optional-section">
          <summary>
            <span>Datos opcionales</span>
            <small>Completa los que tengas disponibles</small>
          </summary>
          <div className="registry-optional-content">
            <OptionalGroup title="Telemetría y estado">
              <div className="manual-two-col">
                <label>
                  <span>Proveedor de telemetría</span>
                  <input
                    type="text"
                    value={form.provider}
                    placeholder="Proveedor Norte"
                    onChange={(event) => onChange({ provider: event.target.value })}
                  />
                </label>
                <label>
                  <span>RUT del centro de control</span>
                  <input
                    type="text"
                    value={form.centroControlRut}
                    placeholder="77555666-7"
                    onChange={(event) => onChange({ centroControlRut: event.target.value })}
                  />
                </label>
              </div>

              <label>
                <span>Estado de la captación</span>
                <select
                  value={form.catchmentStatus}
                  onChange={(event) => onChange({ catchmentStatus: event.target.value })}
                >
                  <option value="">Sin dato</option>
                  <option value="operativa">Operativa</option>
                  <option value="deshabilitada">Deshabilitada</option>
                  <option value="pozo_monitoreo">Pozo de monitoreo</option>
                </select>
              </label>

              <label>
                <span>Telemetría</span>
                <select
                  value={form.telemetryEnabled}
                  onChange={(event) => onChange({ telemetryEnabled: event.target.value })}
                >
                  <option value="">Sin dato</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              </label>
            </OptionalGroup>

            <OptionalGroup title="Ubicación y sector">
              <label>
                <span>Sector acuífero</span>
                <input
                  type="text"
                  value={form.aquiferSector}
                  placeholder="Acuifero 1"
                  onChange={(event) => onChange({ aquiferSector: event.target.value })}
                />
              </label>

              <div className="manual-two-col">
                <label>
                  <span>SHAC</span>
                  <input
                    type="text"
                    value={form.shac}
                    placeholder="Sector hidrogeológico"
                    onChange={(event) => onChange({ shac: event.target.value })}
                  />
                </label>
                <label>
                  <span>Subsector SHAC</span>
                  <input
                    type="text"
                    value={form.shacSubsector}
                    placeholder="Subsector"
                    onChange={(event) => onChange({ shacSubsector: event.target.value })}
                  />
                </label>
              </div>

              <label>
                <span>Referencia ubicación</span>
                <input
                  type="text"
                  value={form.locationReference}
                  placeholder="Sector norte del predio"
                  onChange={(event) => onChange({ locationReference: event.target.value })}
                />
              </label>
            </OptionalGroup>

            <OptionalGroup title="Derechos de aprovechamiento">
              <label>
                <span>Caudal autorizado (L/s)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.authorizedFlowRate}
                  placeholder="12.50"
                  onChange={(event) => onChange({ authorizedFlowRate: event.target.value })}
                />
              </label>

              <WaterRightsEditor form={form} onChange={onChange} />

              <label>
                <span>Volumen anual autorizado (m³/año)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.authorizedVolume}
                  placeholder="120000.00"
                  onChange={(event) => onChange({ authorizedVolume: event.target.value })}
                />
              </label>
            </OptionalGroup>

            <OptionalGroup title="Características del pozo">
              <div className="manual-two-col">
                <label>
                  <span>Profundidad del pozo (m)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.wellDepth}
                    placeholder="80.00"
                    onChange={(event) => onChange({ wellDepth: event.target.value })}
                  />
                </label>
                <label>
                  <span>Profundidad de la bomba (m)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.pumpDepth}
                    placeholder="55.00"
                    onChange={(event) => onChange({ pumpDepth: event.target.value })}
                  />
                </label>
              </div>

              <label>
                <span>Diámetro habilitación</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.habilitationDiameter}
                  placeholder="8.00"
                  onChange={(event) => onChange({ habilitationDiameter: event.target.value })}
                />
              </label>
            </OptionalGroup>

            <OptionalGroup title="Caudalímetro">
              <div className="manual-two-col">
                <label>
                  <span>Diámetro</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.flowmeterDiameter}
                    placeholder="4.00"
                    onChange={(event) => onChange({ flowmeterDiameter: event.target.value })}
                  />
                </label>
                <label>
                  <span>Marca</span>
                  <input
                    type="text"
                    value={form.flowmeterBrand}
                    placeholder="Marca"
                    onChange={(event) => onChange({ flowmeterBrand: event.target.value })}
                  />
                </label>
              </div>
              <div className="manual-two-col">
                <label>
                  <span>Modelo</span>
                  <input
                    type="text"
                    value={form.flowmeterModel}
                    placeholder="Modelo"
                    onChange={(event) => onChange({ flowmeterModel: event.target.value })}
                  />
                </label>
                <label>
                  <span>Fecha de instalación</span>
                  <input
                    type="date"
                    value={form.flowmeterInstallationDate}
                    onChange={(event) =>
                      onChange({ flowmeterInstallationDate: event.target.value })
                    }
                  />
                </label>
              </div>
            </OptionalGroup>

            <OptionalGroup title="Contacto titular">
              <OwnerContactsEditor form={form} onChange={onChange} />
            </OptionalGroup>

            <OptionalGroup title="Contacto terreno">
              <div className="manual-two-col">
                <label>
                  <span>Representante</span>
                  <input
                    type="text"
                    value={form.fieldContactRepresentative}
                    placeholder="Nombre contacto"
                    onChange={(event) =>
                      onChange({ fieldContactRepresentative: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>Teléfono</span>
                  <input
                    type="tel"
                    value={form.fieldContactPhone}
                    placeholder="+56 9 1234 5678"
                    onChange={(event) => onChange({ fieldContactPhone: event.target.value })}
                  />
                </label>
              </div>
              <label>
                <span>E-mail</span>
                <input
                  type="email"
                  value={form.fieldContactEmail}
                  placeholder="terreno@cas.cl"
                  onChange={(event) => onChange({ fieldContactEmail: event.target.value })}
                />
              </label>
            </OptionalGroup>

            <OptionalGroup title="Sonda de nivel">
              <div className="manual-two-col">
                <label>
                  <span>Diámetro</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.levelProbeDiameter}
                    placeholder="1.00"
                    onChange={(event) => onChange({ levelProbeDiameter: event.target.value })}
                  />
                </label>
                <label>
                  <span>Marca</span>
                  <input
                    type="text"
                    value={form.levelProbeBrand}
                    placeholder="Marca"
                    onChange={(event) => onChange({ levelProbeBrand: event.target.value })}
                  />
                </label>
              </div>
              <div className="manual-two-col">
                <label>
                  <span>Fecha de instalación</span>
                  <input
                    type="date"
                    value={form.levelProbeInstallationDate}
                    onChange={(event) =>
                      onChange({ levelProbeInstallationDate: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>Profundidad de instalación</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.levelProbeInstallationDepth}
                    placeholder="55.00"
                    onChange={(event) =>
                      onChange({ levelProbeInstallationDepth: event.target.value })
                    }
                  />
                </label>
              </div>
            </OptionalGroup>

            <OptionalGroup title="Observaciones">
              <label>
                <span>Observaciones</span>
                <textarea
                  value={form.observations}
                  placeholder="Notas generales del pozo"
                  onChange={(event) => onChange({ observations: event.target.value })}
                />
              </label>
            </OptionalGroup>
          </div>
        </details>

        <div className="registry-form-actions">
          <button type="submit" disabled={status === "loading"}>
            {status === "loading"
              ? "Guardando..."
              : editingWellId
                ? "Guardar cambios"
                : "Crear pozo"}
          </button>
          {editingWellId && (
            <button
              type="button"
              className="secondary-button"
              disabled={status === "loading"}
              onClick={() => setEditingWellId(null)}
            >
              Cancelar edición
            </button>
          )}
        </div>
        {message && !workCodeError && (
          <p
            className={`form-feedback ${status === "ready" ? "is-success" : "is-error"}`}
            role={status === "error" ? "alert" : "status"}
            aria-live={status === "error" ? "assertive" : "polite"}
          >
            {message}
          </p>
        )}
      </form>

      {entries.length > 0 && (
        <div className="registry-list">
          {entries.slice(0, 6).map((entry) => (
            <div className="registry-row" key={entry.id}>
              <div>
                <strong>{entry.name}</strong>
                <span>{entry.codigoObra} · {entry.casCode}</span>
              </div>
              <span>
                {entry.authorizedFlowRate !== null && entry.authorizedFlowRate !== undefined
                  ? `${entry.authorizedFlowRate} L/s`
                  : entry.provider ?? "Sin proveedor"}
              </span>
              {(canManageWells || canDeleteWells) && (
                <div className="registry-row-actions">
                  {canManageWells && (
                    <button
                      type="button"
                      className="icon-only-button"
                      title="Editar pozo"
                      aria-label={`Editar pozo ${entry.codigoObra}`}
                      disabled={status === "loading"}
                      onClick={() => {
                        setEditingWellId(entry.id);
                        onChange(entryToForm(entry));
                      }}
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                  )}
                  {canDeleteWells && (
                    <button
                      type="button"
                      className="icon-only-button"
                      title="Eliminar pozo"
                      aria-label={`Eliminar pozo ${entry.codigoObra}`}
                      disabled={status === "loading"}
                      onClick={() => void handleWellDelete(entry)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function OptionalGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="registry-optional-category">
      <summary>{title}</summary>
      <div className="registry-category-fields">{children}</div>
    </details>
  );
}

function WaterRightsEditor({
  form,
  onChange,
}: {
  form: WellRegistryFormState;
  onChange: (next: Partial<WellRegistryFormState>) => void;
}) {
  return (
    <div className="registry-repeatable-fields">
      <div className="registry-repeatable-actions">
        <button
          type="button"
          className="icon-text-button"
          onClick={() =>
            onChange({ waterRights: [...form.waterRights, emptyWaterRight()] })
          }
        >
          <Plus size={16} aria-hidden="true" />
          Agregar derecho
        </button>
      </div>
      {form.waterRights.map((right, index) => (
        <div className="water-right-row" key={index}>
          {(["fojas", "numero", "anio", "cbr"] as const).map((field) => (
            <label key={field}>
              <span>{waterRightLabel[field]}</span>
              <input
                type={field === "anio" ? "number" : "text"}
                step={field === "anio" ? "1" : undefined}
                value={right[field]}
                onChange={(event) => {
                  const waterRights = [...form.waterRights];
                  waterRights[index] = { ...right, [field]: event.target.value };
                  onChange({ waterRights });
                }}
              />
            </label>
          ))}
          <button
            type="button"
            className="icon-only-button"
            title="Quitar derecho"
            aria-label="Quitar derecho"
            disabled={form.waterRights.length === 1}
            onClick={() =>
              onChange({
                waterRights: form.waterRights.filter((_, itemIndex) => itemIndex !== index),
              })
            }
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}

function OwnerContactsEditor({
  form,
  onChange,
}: {
  form: WellRegistryFormState;
  onChange: (next: Partial<WellRegistryFormState>) => void;
}) {
  return (
    <div className="registry-repeatable-fields">
      <div className="registry-repeatable-actions">
        <button
          type="button"
          className="icon-text-button"
          onClick={() =>
            onChange({ ownerContacts: [...form.ownerContacts, emptyOwnerContact()] })
          }
        >
          <Plus size={16} aria-hidden="true" />
          Agregar contacto
        </button>
      </div>
      {form.ownerContacts.map((contact, index) => (
        <div className="water-right-row" key={index}>
          {(["representative", "rut", "phone", "email"] as const).map((field) => (
            <label key={field}>
              <span>
                {field === "representative"
                  ? "Representante"
                  : field === "phone"
                    ? "Teléfono"
                    : field === "email"
                      ? "E-mail"
                      : "RUT"}
              </span>
              <input
                type={field === "email" ? "email" : field === "phone" ? "tel" : "text"}
                value={contact[field]}
                placeholder={
                  field === "representative"
                    ? "Nombre contacto"
                    : field === "rut"
                      ? "12345678-9"
                      : field === "phone"
                        ? "+56 9 1234 5678"
                        : "titular@cas.cl"
                }
                onChange={(event) => {
                  const ownerContacts = [...form.ownerContacts];
                  ownerContacts[index] = { ...contact, [field]: event.target.value };
                  onChange({ ownerContacts });
                }}
              />
            </label>
          ))}
          <button
            type="button"
            className="icon-only-button"
            title="Quitar contacto"
            aria-label="Quitar contacto"
            disabled={form.ownerContacts.length === 1}
            onClick={() =>
              onChange({
                ownerContacts: form.ownerContacts.filter(
                  (_, itemIndex) => itemIndex !== index,
                ),
              })
            }
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
