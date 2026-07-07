import {
  MapPinned,
  Plus,
  Trash2
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { FormEvent, lazy, useEffect, useMemo, useState } from "react";
import { Panel } from "../../components/Panel";
import { RemoteDataState } from "../../components/RemoteDataState";
import {
  createCasOrganization,
  fetchCasMemberships,
  fetchCasMembershipUsers,
  fetchCasOrganizations,
  revokeCasMembership,
  setCasMembership,
  type WellRegistryEntry
} from "../../services/wellsApi";
import type { RemoteLoadStatus } from "../../types/remote";


import { toRemoteErrorMessage } from "../../app/remoteError";
import { queryKeys } from "../../lib/queryKeys";
import type { WellRegistryFormState } from "./wellsView.types";
const StatusLeafletMap = lazy(() =>
  import("../../components/StatusLeafletMap").then((module) => ({
    default: module.StatusLeafletMap,
  })),
);



export function WellRegistryAdminPanel({
  authIdToken,
  canManageCas,
  entries,
  form,
  message,
  onChange,
  onSubmit,
  status,
}: {
  authIdToken: string | null;
  canManageCas: boolean;
  entries: WellRegistryEntry[];
  form: WellRegistryFormState;
  message: string | null;
  onChange: (next: Partial<WellRegistryFormState>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  status: RemoteLoadStatus;
}) {
  const [activeAdminView, setActiveAdminView] =
    useState<"registry" | "cas">("registry");
  const [selectedCasId, setSelectedCasId] = useState("");
  const [membershipUid, setMembershipUid] = useState("");
  const [casCode, setCasCode] = useState("");
  const [casName, setCasName] = useState("");
  const [casStatus, setCasStatus] = useState<RemoteLoadStatus>("idle");
  const [casMessage, setCasMessage] = useState<string | null>(null);
  const organizationsQuery = useQuery({
    queryKey: queryKeys.wells.casOrganizations(authIdToken),
    queryFn: () => fetchCasOrganizations(authIdToken!),
    enabled: Boolean(authIdToken),
    staleTime: 5 * 60 * 1000,
  });
  const usersQuery = useQuery({
    queryKey: queryKeys.wells.casUsers(authIdToken),
    queryFn: () => fetchCasMembershipUsers(authIdToken!),
    enabled: canManageCas && Boolean(authIdToken) && activeAdminView === "cas",
    staleTime: 5 * 60 * 1000,
  });
  const membershipsQuery = useQuery({
    queryKey: queryKeys.wells.casMemberships(authIdToken, selectedCasId),
    queryFn: () => fetchCasMemberships(authIdToken!, selectedCasId),
    enabled: canManageCas && Boolean(authIdToken) && Boolean(selectedCasId),
    staleTime: 5 * 60 * 1000,
  });
  const organizations = organizationsQuery.data ?? [];
  const memberships = membershipsQuery.data ?? [];
  const membershipUsers = (usersQuery.data ?? []).filter(
    (user) => user.role === "cas_user",
  );
  const organizationsError = organizationsQuery.error
    ? toRemoteErrorMessage(
        organizationsQuery.error,
        "No fue posible cargar las organizaciones CAS.",
      )
    : null;
  const previewLat = Number.parseFloat(form.lat);
  const previewLng = Number.parseFloat(form.lng);
  const hasPreviewLocation = Number.isFinite(previewLat) && Number.isFinite(previewLng);
  const workCodeError =
    status === "error" && message?.startsWith("Código de obra inválido")
      ? message
      : null;
  const usersByUid = useMemo(
    () => new Map(membershipUsers.map((user) => [user.uid, user])),
    [membershipUsers],
  );

  useEffect(() => {
    const firstOrganization = organizationsQuery.data?.[0];
    if (!firstOrganization) return;
    setSelectedCasId((current) => current || firstOrganization.id);
    if (!form.casId) onChange({ casId: firstOrganization.id });
  }, [form.casId, onChange, organizationsQuery.data]);

  useEffect(() => {
    const firstUser = membershipUsers[0];
    if (firstUser) setMembershipUid((current) => current || firstUser.uid);
  }, [membershipUsers]);

  useEffect(() => {
    if (membershipsQuery.isPending && membershipsQuery.isEnabled) {
      setCasStatus("loading");
    } else if (membershipsQuery.isError) {
      setCasStatus("error");
      setCasMessage(
        toRemoteErrorMessage(
          membershipsQuery.error,
          "No fue posible cargar las membresías.",
        ),
      );
    } else if (membershipsQuery.isSuccess) {
      setCasStatus("ready");
    }
  }, [
    membershipsQuery.error,
    membershipsQuery.isEnabled,
    membershipsQuery.isError,
    membershipsQuery.isPending,
    membershipsQuery.isSuccess,
  ]);

  const refreshMemberships = async () => {
    if (membershipsQuery.isEnabled) await membershipsQuery.refetch();
  };

  const handleCasCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authIdToken || !casCode.trim() || !casName.trim()) {
      return;
    }
    setCasStatus("loading");
    setCasMessage(null);
    try {
      const created = await createCasOrganization(authIdToken, {
        code: casCode.trim(),
        name: casName.trim(),
      });
      await organizationsQuery.refetch();
      setSelectedCasId(created.id);
      onChange({ casId: created.id });
      setCasCode("");
      setCasName("");
      setCasStatus("ready");
      setCasMessage("Organizacion CAS creada.");
    } catch (error) {
      setCasStatus("error");
      setCasMessage(toRemoteErrorMessage(error, "No fue posible crear la organizacion CAS."));
    }
  };

  const handleMembershipSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authIdToken || !selectedCasId || !membershipUid) {
      return;
    }
    setCasStatus("loading");
    setCasMessage(null);
    try {
      await setCasMembership(authIdToken, selectedCasId, membershipUid);
      await refreshMemberships();
      setCasStatus("ready");
      setCasMessage("Comunero asignado a la CAS.");
    } catch (error) {
      setCasStatus("error");
      setCasMessage(toRemoteErrorMessage(error, "No fue posible asignar el comunero."));
    }
  };

  const handleMembershipRevoke = async (firebaseUid: string) => {
    if (!authIdToken || !selectedCasId) {
      return;
    }
    setCasStatus("loading");
    try {
      await revokeCasMembership(authIdToken, selectedCasId, firebaseUid);
      await refreshMemberships();
      setCasStatus("ready");
      setCasMessage("Membresia revocada.");
    } catch (error) {
      setCasStatus("error");
      setCasMessage(toRemoteErrorMessage(error, "No fue posible revocar la membresia."));
    }
  };

  return (
    <Panel
      title="Administracion de pozos"
      subtitle={`${entries.length} pozos en registry`}
    >
      <div className="well-admin-view-nav" role="tablist" aria-label="Administracion de pozos">
        <button
          type="button"
          role="tab"
          aria-selected={activeAdminView === "registry"}
          className={activeAdminView === "registry" ? "is-active" : ""}
          onClick={() => setActiveAdminView("registry")}
        >
          Pozos
        </button>
        {canManageCas && (
          <button
            type="button"
            role="tab"
            aria-selected={activeAdminView === "cas"}
            className={activeAdminView === "cas" ? "is-active" : ""}
            onClick={() => setActiveAdminView("cas")}
          >
            Organizaciones CAS
          </button>
        )}
      </div>

      {activeAdminView === "registry" && (
        <>
          <form className="manual-entry-form" onSubmit={onSubmit}>
            <label>
              <span>CAS</span>
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
                <span>Codigo obra</span>
                <input
                  type="text"
                  value={form.codigoObra}
                  placeholder="OB-0101-114"
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
                <span>Nombre</span>
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
                <span>Latitud</span>
                <input
                  type="number"
                  step="0.000001"
                  value={form.lat}
                  placeholder="-27.360000"
                  onChange={(event) => onChange({ lat: event.target.value })}
                  required
                />
              </label>
              <label>
                <span>Longitud</span>
                <input
                  type="number"
                  step="0.000001"
                  value={form.lng}
                  placeholder="-70.330000"
                  onChange={(event) => onChange({ lng: event.target.value })}
                  required
                />
              </label>
            </div>

            <div className="manual-two-col">
              <label>
                <span>Proveedor</span>
                <input
                  type="text"
                  value={form.provider}
                  placeholder="Proveedor Norte"
                  onChange={(event) => onChange({ provider: event.target.value })}
                />
              </label>
              <label>
                <span>Centro control RUT</span>
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
              <span>Sector acuifero</span>
              <input
                type="text"
                value={form.aquiferSector}
                placeholder="Acuifero 1"
                onChange={(event) => onChange({ aquiferSector: event.target.value })}
              />
            </label>

            <section className="metadata-fieldset">
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
            </section>

            <label>
              <span>Caudal autorizado</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.authorizedFlowRate}
                placeholder="12.50"
                onChange={(event) => onChange({ authorizedFlowRate: event.target.value })}
              />
            </label>

            <section className="metadata-fieldset" aria-labelledby="water-rights-heading">
              <div className="water-rights-head">
                <h4 id="water-rights-heading">Derechos de aprovechamiento</h4>
                <button
                  type="button"
                  className="icon-text-button"
                  onClick={() =>
                    onChange({
                      waterRights: [
                        ...form.waterRights,
                        { anio: "", cbr: "", fojas: "", numero: "" },
                      ],
                    })
                  }
                >
                  <Plus size={16} aria-hidden="true" />
                  Agregar
                </button>
              </div>
              {form.waterRights.map((right, index) => (
                <div className="water-right-row" key={index}>
                  <label>
                    <span>Fojas</span>
                    <input
                      type="text"
                      value={right.fojas}
                      onChange={(event) => {
                        const waterRights = [...form.waterRights];
                        waterRights[index] = { ...right, fojas: event.target.value };
                        onChange({ waterRights });
                      }}
                    />
                  </label>
                  <label>
                    <span>Número</span>
                    <input
                      type="text"
                      value={right.numero}
                      onChange={(event) => {
                        const waterRights = [...form.waterRights];
                        waterRights[index] = { ...right, numero: event.target.value };
                        onChange({ waterRights });
                      }}
                    />
                  </label>
                  <label>
                    <span>Año</span>
                    <input
                      type="number"
                      step="1"
                      value={right.anio}
                      onChange={(event) => {
                        const waterRights = [...form.waterRights];
                        waterRights[index] = { ...right, anio: event.target.value };
                        onChange({ waterRights });
                      }}
                    />
                  </label>
                  <label>
                    <span>CBR</span>
                    <input
                      type="text"
                      value={right.cbr}
                      onChange={(event) => {
                        const waterRights = [...form.waterRights];
                        waterRights[index] = { ...right, cbr: event.target.value };
                        onChange({ waterRights });
                      }}
                    />
                  </label>
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
            </section>

            <div className="manual-two-col">
              <label>
                <span>Volumen autorizado</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.authorizedVolume}
                  placeholder="120000.00"
                  onChange={(event) => onChange({ authorizedVolume: event.target.value })}
                />
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
            </div>

            <div className="manual-two-col">
              <label>
                <span>Profundidad pozo</span>
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
                <span>Profundidad bomba</span>
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

            <section className="metadata-fieldset" aria-labelledby="utm-heading">
              <h4 id="utm-heading">Coordenadas UTM</h4>
              <div className="manual-two-col">
                <label>
                  <span>Este</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.utmEasting}
                    placeholder="368000.00"
                    onChange={(event) => onChange({ utmEasting: event.target.value })}
                  />
                </label>
                <label>
                  <span>Norte</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.utmNorthing}
                    placeholder="6972000.00"
                    onChange={(event) => onChange({ utmNorthing: event.target.value })}
                  />
                </label>
              </div>
              <div className="manual-two-col">
                <label>
                  <span>Huso</span>
                  <input
                    type="text"
                    value={form.huso}
                    placeholder="19S"
                    onChange={(event) => onChange({ huso: event.target.value })}
                  />
                </label>
                <label>
                  <span>Datum</span>
                  <input
                    type="text"
                    value={form.datum}
                    placeholder="WGS84"
                    onChange={(event) => onChange({ datum: event.target.value })}
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
            </section>

            <section className="metadata-fieldset" aria-labelledby="flowmeter-heading">
              <h4 id="flowmeter-heading">Caudalímetro</h4>
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
            </section>

            <section className="metadata-fieldset" aria-labelledby="owner-contact-heading">
              <h4 id="owner-contact-heading">Contacto titular</h4>
              <div className="manual-two-col">
                <label>
                  <span>Representante</span>
                  <input
                    type="text"
                    value={form.ownerContactRepresentative}
                    placeholder="Nombre contacto"
                    onChange={(event) =>
                      onChange({ ownerContactRepresentative: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>Teléfono</span>
                  <input
                    type="tel"
                    value={form.ownerContactPhone}
                    placeholder="+56 9 1234 5678"
                    onChange={(event) => onChange({ ownerContactPhone: event.target.value })}
                  />
                </label>
              </div>
              <label>
                <span>E-mail</span>
                <input
                  type="email"
                  value={form.ownerContactEmail}
                  placeholder="titular@cas.cl"
                  onChange={(event) => onChange({ ownerContactEmail: event.target.value })}
                />
              </label>
            </section>

            <section className="metadata-fieldset" aria-labelledby="field-contact-heading">
              <h4 id="field-contact-heading">Contacto terreno</h4>
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
            </section>

            <section className="metadata-fieldset" aria-labelledby="level-probe-heading">
              <h4 id="level-probe-heading">Sonda de nivel</h4>
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
            </section>

            <label>
              <span>Observaciones</span>
              <textarea
                value={form.observations}
                placeholder="Notas generales del pozo"
                onChange={(event) => onChange({ observations: event.target.value })}
              />
            </label>

            <button type="submit" disabled={status === "loading"}>
              {status === "loading" ? "Guardando..." : "Crear pozo"}
            </button>
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

          <div className="registry-map-preview">
            {hasPreviewLocation ? (
              <StatusLeafletMap
                className="is-registry-preview"
                points={[
                  {
                    id: "new-well-preview",
                    lat: previewLat,
                    lastUpdate: new Date().toISOString(),
                    lng: previewLng,
                    name: form.name || form.codigoObra || "Nuevo pozo",
                    sourceType: "manual",
                    status: "fresh",
                  },
                ]}
                selectedPointId="new-well-preview"
                selectedPointZoom={16}
              />
            ) : (
              <RemoteDataState
                className="is-compact"
                icon={<MapPinned size={18} />}
                message="Ingresa latitud y longitud para previsualizar el punto."
                title="Sin ubicacion"
                tone="loading"
              />
            )}
          </div>

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
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeAdminView === "cas" && canManageCas && (
        <div className="well-access-admin">
          <div>
            <h4>Organizaciones y comuneros</h4>
          </div>
          <label>
            <span>CAS</span>
            <select
              value={selectedCasId}
              disabled={casStatus === "loading"}
              onChange={(event) => setSelectedCasId(event.target.value)}
            >
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.code} - {organization.name}
                </option>
              ))}
            </select>
          </label>

          <form className="manual-entry-form" onSubmit={handleCasCreate}>
            <div className="manual-two-col">
              <label>
                <span>Codigo CAS</span>
                <input
                  value={casCode}
                  onChange={(event) => setCasCode(event.target.value)}
                  required
                />
              </label>
              <label>
                <span>Nombre CAS</span>
                <input
                  value={casName}
                  onChange={(event) => setCasName(event.target.value)}
                  required
                />
              </label>
            </div>
            <button type="submit" disabled={casStatus === "loading"}>
              Crear CAS
            </button>
          </form>

          <form className="manual-entry-form" onSubmit={handleMembershipSubmit}>
            <div className="manual-two-col">
              <label>
                <span>Comunero</span>
                <select
                  value={membershipUid}
                  onChange={(event) => setMembershipUid(event.target.value)}
                  required
                  disabled={membershipUsers.length === 0}
                >
                  {membershipUsers.length === 0 && (
                    <option value="">Sin usuarios CAS disponibles</option>
                  )}
                  {membershipUsers.map((user) => (
                    <option key={user.uid} value={user.uid}>
                      {user.displayName || user.email || "Usuario sin nombre"}
                      {user.email && user.displayName ? ` · ${user.email}` : ""}
                      {` · ${user.role}`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="submit"
              disabled={casStatus === "loading" || membershipUsers.length === 0}
            >
              {casStatus === "loading" ? "Guardando..." : "Asignar comunero"}
            </button>
          </form>

          {casMessage && <p className="login-error">{casMessage}</p>}
          <div className="registry-list">
            {memberships.map((entry) => (
              <div className="registry-row" key={entry.id}>
                <div>
                  <strong>
                    {usersByUid.get(entry.firebaseUid)?.displayName ||
                      usersByUid.get(entry.firebaseUid)?.email ||
                      "Usuario no encontrado"}
                  </strong>
                  <span>
                    {usersByUid.get(entry.firebaseUid)?.email
                      ? `${usersByUid.get(entry.firebaseUid)?.email} · `
                      : ""}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={casStatus === "loading"}
                  onClick={() => handleMembershipRevoke(entry.firebaseUid)}
                >
                  Revocar
                </button>
              </div>
            ))}
            {casStatus === "ready" && memberships.length === 0 && (
              <p>Sin comuneros asignados a esta CAS.</p>
            )}
          </div>
        </div>
      )}

    </Panel>
  );
}
