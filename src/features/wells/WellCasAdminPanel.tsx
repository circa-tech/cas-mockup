import { useConfirmationDialog } from "../../components/useConfirmationDialog";
import { useQuery } from "@tanstack/react-query";
import { Building2, Plus, Save, Trash2, UserPlus, UserRound, UsersRound } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toRemoteErrorMessage } from "../../app/remoteError";
import { queryKeys } from "../../lib/queryKeys";
import {
  createCasOrganization,
  deleteCasOrganization,
  fetchCasMemberships,
  fetchCasMembershipUsers,
  revokeCasMembership,
  setCasMembership,
  updateCasOrganization,
  type CasOrganization,
} from "../../services/wellsApi";
import type { RemoteLoadStatus } from "../../types/remote";

type WellCasAdminPanelProps = {
  authIdToken: string | null;
  onDefaultCasChange: (casId: string) => void;
  organizations: CasOrganization[];
  refreshOrganizations: () => Promise<CasOrganization[]>;
};

const casRoleLabel = (role: string | undefined) =>
  role === "general_admin"
    ? "Administrador general"
    : role === "technical_admin"
      ? "Administrador técnico"
      : role === "cas_user"
        ? "Usuario CAS"
        : null;

export function WellCasAdminPanel({
  authIdToken,
  onDefaultCasChange,
  organizations,
  refreshOrganizations,
}: WellCasAdminPanelProps) {
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [selectedCasId, setSelectedCasId] = useState("");
  const [membershipUid, setMembershipUid] = useState("");
  const [casCode, setCasCode] = useState("");
  const [casName, setCasName] = useState("");
  const [editCasCode, setEditCasCode] = useState("");
  const [editCasName, setEditCasName] = useState("");
  const [casStatus, setCasStatus] = useState<RemoteLoadStatus>("idle");
  const [casMessage, setCasMessage] = useState<string | null>(null);
  const selectedOrganization = organizations.find(
    (organization) => organization.id === selectedCasId,
  );
  const usersQuery = useQuery({
    queryKey: queryKeys.wells.casUsers(authIdToken),
    queryFn: () => fetchCasMembershipUsers(authIdToken!),
    enabled: Boolean(authIdToken),
    staleTime: 5 * 60 * 1000,
  });
  const membershipsQuery = useQuery({
    queryKey: queryKeys.wells.casMemberships(authIdToken, selectedCasId),
    queryFn: () => fetchCasMemberships(authIdToken!, selectedCasId),
    enabled: Boolean(authIdToken) && Boolean(selectedCasId),
    staleTime: 5 * 60 * 1000,
  });
  const membershipUsers = (usersQuery.data ?? []).filter(
    (user) => ["cas_user", "technical_admin", "general_admin"].includes(user.role),
  );
  const usersByUid = useMemo(
    () => new Map((usersQuery.data ?? []).map((user) => [user.uid, user])),
    [usersQuery.data],
  );
  const memberships = membershipsQuery.data ?? [];
  const membershipIds = useMemo(
    () => new Set((membershipsQuery.data ?? []).map((member) => member.firebaseUid)),
    [membershipsQuery.data],
  );
  const membershipCandidates = membershipUsers.filter((user) => !membershipIds.has(user.uid));
  const canAssign = casStatus !== "loading" && membershipsQuery.isSuccess &&
    membershipCandidates.some((user) => user.uid === membershipUid);

  useEffect(() => {
    setSelectedCasId((current) => {
      if (organizations.some((organization) => organization.id === current)) return current;
      return organizations[0]?.id ?? "";
    });
  }, [organizations]);

  useEffect(() => {
    setEditCasCode(selectedOrganization?.code ?? "");
    setEditCasName(selectedOrganization?.name ?? "");
  }, [selectedOrganization?.code, selectedOrganization?.name]);

  useEffect(() => {
    if (membershipsQuery.isPending && membershipsQuery.isEnabled) {
      setCasStatus("loading");
    } else if (membershipsQuery.isError) {
      setCasStatus("error");
      setCasMessage(null);
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
    if (!authIdToken || !casCode.trim() || !casName.trim()) return;
    setCasStatus("loading");
    setCasMessage(null);
    try {
      const created = await createCasOrganization(authIdToken, {
        code: casCode.trim(),
        name: casName.trim(),
      });
      await refreshOrganizations();
      setSelectedCasId(created.id);
      onDefaultCasChange(created.id);
      setCasCode("");
      setCasName("");
      setMembershipUid("");
      setCasStatus("ready");
      setCasMessage("Organización CAS creada.");
    } catch (error) {
      setCasStatus("error");
      setCasMessage(toRemoteErrorMessage(error, "No fue posible crear la organización CAS."));
    }
  };

  const handleCasUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authIdToken || !selectedCasId || !editCasCode.trim() || !editCasName.trim()) {
      return;
    }
    setCasStatus("loading");
    setCasMessage(null);
    try {
      const updated = await updateCasOrganization(authIdToken, selectedCasId, {
        code: editCasCode.trim(),
        name: editCasName.trim(),
      });
      await refreshOrganizations();
      setCasStatus("ready");
      setCasMessage(`CAS ${updated.code} actualizada.`);
    } catch (error) {
      setCasStatus("error");
      setCasMessage(toRemoteErrorMessage(error, "No fue posible actualizar la CAS."));
    }
  };

  const handleCasDelete = async () => {
    if (!authIdToken || !selectedCasId || !selectedOrganization) return;
    if (!(await confirm({ title: "¿Eliminar esta CAS?", description: `Se eliminará la CAS ${selectedOrganization.code} del registro activo.`, confirmLabel: "Eliminar CAS", destructive: true }))) return;
    setCasStatus("loading");
    setCasMessage(null);
    try {
      await deleteCasOrganization(authIdToken, selectedCasId);
      const nextOrganizations = await refreshOrganizations();
      const nextOrganization = nextOrganizations[0];
      setSelectedCasId(nextOrganization?.id ?? "");
      setMembershipUid("");
      onDefaultCasChange(nextOrganization?.id ?? "");
      setCasStatus("ready");
      setCasMessage("CAS eliminada del registro activo.");
    } catch (error) {
      setCasStatus("error");
      setCasMessage(toRemoteErrorMessage(error, "No fue posible eliminar la CAS."));
    }
  };

  const handleMembershipSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authIdToken || !selectedCasId || !membershipCandidates.some((user) => user.uid === membershipUid)) return;
    setCasStatus("loading");
    setCasMessage(null);
    try {
      await setCasMembership(authIdToken, selectedCasId, membershipUid);
      await refreshMemberships();
      setMembershipUid("");
      setCasStatus("ready");
      setCasMessage("Usuario asignado a la CAS.");
    } catch (error) {
      setCasStatus("error");
      setCasMessage(toRemoteErrorMessage(error, "No fue posible asignar el usuario."));
    }
  };

  const handleMembershipRevoke = async (firebaseUid: string) => {
    if (!authIdToken || !selectedCasId) return;
    setCasStatus("loading");
    setCasMessage(null);
    try {
      await revokeCasMembership(authIdToken, selectedCasId, firebaseUid);
      await refreshMemberships();
      setCasStatus("ready");
      setCasMessage("Usuario retirado de la CAS.");
    } catch (error) {
      setCasStatus("error");
      setCasMessage(toRemoteErrorMessage(error, "No fue posible quitar al usuario de la CAS."));
    }
  };

  return (
    <div className="well-access-admin well-writers-panel cas-admin-panel">
      {confirmationDialog}
      <div className="well-admin-intro">
        <span className="well-admin-intro-icon" aria-hidden="true"><Building2 size={22} /></span>
        <div>
          <h4>Gestión de CAS</h4>
          <p>Crea y actualiza organizaciones CAS y administra sus usuarios.</p>
        </div>
      </div>

      <section className="well-writers-context" aria-labelledby="cas-admin-context-heading">
        <div>
          <span className="well-writers-kicker">CAS SELECCIONADA</span>
          <h5 id="cas-admin-context-heading">{selectedOrganization?.name ?? "Selecciona una CAS"}</h5>
          <p>{selectedOrganization?.code ?? "Elige una CAS para editarla y gestionar sus usuarios."}</p>
        </div>
        <label>
          <span>CAS</span>
          <select
            value={selectedCasId}
            disabled={casStatus === "loading" || organizations.length === 0}
            onChange={(event) => {
              setSelectedCasId(event.target.value);
              setMembershipUid("");
              setCasMessage(null);
            }}
          >
            {organizations.length === 0 && <option value="">Sin CAS disponibles</option>}
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.code} · {organization.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="well-writers-card" aria-labelledby="cas-admin-edit-heading">
        <div className="well-writers-card-heading">
          <div className="well-writers-card-title">
            <Save size={19} aria-hidden="true" />
            <h5 id="cas-admin-edit-heading">Datos de la CAS</h5>
          </div>
        </div>
        <p>Actualiza la organización seleccionada.</p>
        <form className="manual-entry-form cas-admin-form" onSubmit={handleCasUpdate}>
          <div className="manual-two-col">
            <label>
              <span>Código CAS</span>
              <input value={editCasCode} onChange={(event) => setEditCasCode(event.target.value)} required disabled={!selectedOrganization} />
            </label>
            <label>
              <span>Nombre CAS</span>
              <input value={editCasName} onChange={(event) => setEditCasName(event.target.value)} required disabled={!selectedOrganization} />
            </label>
          </div>
          <div className="cas-admin-actions">
            <button type="submit" disabled={casStatus === "loading" || !selectedOrganization}>
              <Save size={16} aria-hidden="true" /> Guardar cambios
            </button>
            <button type="button" className="cas-admin-delete" disabled={casStatus === "loading" || !selectedOrganization} onClick={() => void handleCasDelete()}>
              <Trash2 size={16} aria-hidden="true" /> Eliminar CAS
            </button>
          </div>
        </form>
      </section>

      {selectedOrganization && (
        <div className="well-writers-grid">
          <section className="well-writers-card" aria-labelledby="cas-admin-members-heading">
            <div className="well-writers-card-heading">
              <div className="well-writers-card-title">
                <UsersRound size={19} aria-hidden="true" />
                <h5 id="cas-admin-members-heading">Usuarios asignados</h5>
              </div>
              {membershipsQuery.isSuccess && <span className="well-writers-count">{memberships.length}</span>}
            </div>
            <p>Estas personas pertenecen a la CAS seleccionada.</p>
            {membershipsQuery.isPending && <p className="well-writers-state">Cargando usuarios…</p>}
            {membershipsQuery.isError && <p className="form-feedback is-error" role="alert">{toRemoteErrorMessage(membershipsQuery.error, "No fue posible cargar los usuarios de la CAS.")}</p>}
            {membershipsQuery.isSuccess && memberships.length === 0 && <p className="well-writers-state">Esta CAS todavía no tiene usuarios asignados.</p>}
            {membershipsQuery.isSuccess && memberships.length > 0 && (
              <ul className="well-writers-list">
                {memberships.map((entry) => {
                  const user = usersByUid.get(entry.firebaseUid);
                  const name = user?.displayName || user?.email || "Usuario no encontrado";
                  const details = [user?.email && user.email !== name ? user.email : null, casRoleLabel(user?.role)]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <li className="well-writers-person" key={entry.id}>
                      <span className="user-avatar" aria-hidden="true"><UserRound size={19} /></span>
                      <div className="well-writers-person-copy">
                        <strong>{name}</strong>
                        {details && <small>{details}</small>}
                      </div>
                      <button type="button" className="well-writers-remove" disabled={casStatus === "loading"} onClick={() => void handleMembershipRevoke(entry.firebaseUid)} aria-label={`Quitar a ${name} de la CAS`}>
                        <Trash2 size={15} aria-hidden="true" /> <span>Quitar</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="well-writers-card" aria-labelledby="cas-admin-add-heading">
            <div className="well-writers-card-heading">
              <div className="well-writers-card-title">
                <UserPlus size={19} aria-hidden="true" />
                <h5 id="cas-admin-add-heading">Asignar usuario</h5>
              </div>
            </div>
            <p>Agrega una persona a esta CAS.</p>
            <form className="manual-entry-form well-writers-add-form" onSubmit={handleMembershipSubmit}>
              <label>
                <span>Usuario</span>
                <select value={membershipUid} onChange={(event) => setMembershipUid(event.target.value)} required disabled={casStatus === "loading" || !membershipsQuery.isSuccess || membershipCandidates.length === 0}>
                  <option value="">{usersQuery.isPending || membershipsQuery.isPending ? "Cargando usuarios…" : "Selecciona una persona"}</option>
                  {membershipsQuery.isSuccess && membershipCandidates.map((user) => (
                    <option key={user.uid} value={user.uid}>
                      {user.displayName || user.email || user.uid}{user.email && user.displayName ? ` · ${user.email}` : ""} · {casRoleLabel(user.role)}
                    </option>
                  ))}
                </select>
              </label>
              {usersQuery.isError && <p className="form-feedback is-error" role="alert">No fue posible cargar los usuarios disponibles.</p>}
              {usersQuery.isSuccess && membershipsQuery.isSuccess && membershipCandidates.length === 0 && <p className="well-writers-state">No hay más usuarios disponibles para agregar.</p>}
              <button type="submit" disabled={!canAssign}>
                <UserPlus size={16} aria-hidden="true" /> Asignar usuario
              </button>
            </form>
          </section>
        </div>
      )}

      <section className="cas-admin-create-section" aria-labelledby="cas-admin-create-heading">
        <div className="well-writers-card">
          <div className="well-writers-card-heading">
            <div className="well-writers-card-title">
              <Plus size={19} aria-hidden="true" />
              <h5 id="cas-admin-create-heading">Crear nueva CAS</h5>
            </div>
          </div>
          <p>Crea una organización distinta de la CAS seleccionada.</p>
          <form className="manual-entry-form cas-admin-form" onSubmit={handleCasCreate}>
            <div className="manual-two-col">
              <label>
                <span>Código CAS</span>
                <input value={casCode} onChange={(event) => setCasCode(event.target.value)} required />
              </label>
              <label>
                <span>Nombre CAS</span>
                <input value={casName} onChange={(event) => setCasName(event.target.value)} required />
              </label>
            </div>
            <button type="submit" disabled={casStatus === "loading"}>
              <Plus size={16} aria-hidden="true" /> Crear CAS
            </button>
          </form>
        </div>
      </section>

      {casMessage && (
        <p className={`form-feedback is-${casStatus === "error" ? "error" : "success"}`} role={casStatus === "error" ? "alert" : "status"}>
          {casMessage}
        </p>
      )}
    </div>
  );
}
