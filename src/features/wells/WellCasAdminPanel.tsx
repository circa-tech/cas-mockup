import { useConfirmationDialog } from "../../components/useConfirmationDialog";
import { useQuery } from "@tanstack/react-query";
import { Save, Trash2 } from "lucide-react";
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
    (user) => user.role === "cas_user",
  );
  const usersByUid = useMemo(
    () => new Map(membershipUsers.map((user) => [user.uid, user])),
    [membershipUsers],
  );
  const memberships = membershipsQuery.data ?? [];

  useEffect(() => {
    setSelectedCasId((current) => {
      if (organizations.some((organization) => organization.id === current)) return current;
      return organizations[0]?.id ?? "";
    });
  }, [organizations]);

  useEffect(() => {
    const firstUser = membershipUsers[0];
    if (firstUser) setMembershipUid((current) => current || firstUser.uid);
  }, [membershipUsers]);

  useEffect(() => {
    setEditCasCode(selectedOrganization?.code ?? "");
    setEditCasName(selectedOrganization?.name ?? "");
  }, [selectedOrganization?.code, selectedOrganization?.name]);

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
      setCasStatus("ready");
      setCasMessage("Organizacion CAS creada.");
    } catch (error) {
      setCasStatus("error");
      setCasMessage(toRemoteErrorMessage(error, "No fue posible crear la organizacion CAS."));
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
    if (!authIdToken || !selectedCasId || !membershipUid) return;
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
    if (!authIdToken || !selectedCasId) return;
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
    <div className="well-access-admin">
      {confirmationDialog}
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

      <form className="manual-entry-form" onSubmit={handleCasUpdate}>
        <div className="manual-two-col">
          <label>
            <span>Codigo CAS seleccionada</span>
            <input
              value={editCasCode}
              onChange={(event) => setEditCasCode(event.target.value)}
              required
              disabled={!selectedOrganization}
            />
          </label>
          <label>
            <span>Nombre CAS seleccionada</span>
            <input
              value={editCasName}
              onChange={(event) => setEditCasName(event.target.value)}
              required
              disabled={!selectedOrganization}
            />
          </label>
        </div>
        <div className="manual-two-col">
          <button
            type="submit"
            disabled={casStatus === "loading" || !selectedOrganization}
          >
            <Save size={16} aria-hidden="true" />
            Guardar CAS
          </button>
          <button
            type="button"
            disabled={casStatus === "loading" || !selectedOrganization}
            onClick={() => void handleCasDelete()}
          >
            <Trash2 size={16} aria-hidden="true" />
            Eliminar CAS
          </button>
        </div>
      </form>

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
  );
}
