import {
  MapPinned
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
                <span>Provider</span>
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
              <span>Sector acuifero</span>
              <input
                type="text"
                value={form.aquiferSector}
                placeholder="Acuifero 1"
                onChange={(event) => onChange({ aquiferSector: event.target.value })}
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
                  <span>{entry.provider ?? "Sin provider"}</span>
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
