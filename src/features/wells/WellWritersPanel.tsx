import { useQuery } from "@tanstack/react-query";
import { Trash2, UserPlus, UserRound, UsersRound } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toRemoteErrorMessage } from "../../app/remoteError";
import { useConfirmationDialog } from "../../components/useConfirmationDialog";
import { queryKeys } from "../../lib/queryKeys";
import {
  addWellWriter,
  fetchWellWriterCandidates,
  fetchWellWriters,
  fetchWritableWellIds,
  revokeWellWriter,
  type WellRegistryEntry,
} from "../../services/wellsApi";

const roleLabel = (role: string | undefined) =>
  role === "general_admin"
    ? "Administrador general"
    : role === "technical_admin"
      ? "Administrador técnico"
      : null;

export function WellWritersPanel({
  authIdToken,
  authUid,
  canManageCas,
  entries,
}: {
  authIdToken: string | null;
  authUid: string | null;
  canManageCas: boolean;
  entries: WellRegistryEntry[];
}) {
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [selectedWellId, setSelectedWellId] = useState("");
  const [newWriterUid, setNewWriterUid] = useState("");
  const [feedback, setFeedback] = useState<{ text: string; tone: "error" | "success" } | null>(null);
  const [busy, setBusy] = useState(false);
  const writableQuery = useQuery({
    queryKey: queryKeys.wells.writable(authIdToken),
    queryFn: () => fetchWritableWellIds(authIdToken!),
    enabled: Boolean(authIdToken),
  });
  const writableIds = useMemo(() => new Set(writableQuery.data ?? []), [writableQuery.data]);
  const availableWells = canManageCas
    ? entries
    : entries.filter((entry) => writableIds.has(entry.id));
  const selectedWell = availableWells.find((entry) => entry.id === selectedWellId);
  const writersQuery = useQuery({
    queryKey: queryKeys.wells.writers(authIdToken, selectedWellId),
    queryFn: () => fetchWellWriters(authIdToken!, selectedWellId),
    enabled: Boolean(authIdToken && selectedWell),
  });
  const usersQuery = useQuery({
    queryKey: queryKeys.wells.writerCandidates(authIdToken, selectedWellId),
    queryFn: () => fetchWellWriterCandidates(authIdToken!, selectedWellId),
    enabled: Boolean(authIdToken && selectedWell),
  });
  const usersByUid = useMemo(
    () => new Map((usersQuery.data ?? []).map((user) => [user.uid, user])),
    [usersQuery.data],
  );
  const assignedIds = useMemo(
    () => new Set((writersQuery.data ?? []).map((writer) => writer.firebaseUid)),
    [writersQuery.data],
  );
  const candidates = writersQuery.isSuccess
    ? (usersQuery.data ?? []).filter((user) => !assignedIds.has(user.uid))
    : [];
  const canAddSelected = !busy && candidates.some((user) => user.uid === newWriterUid);

  useEffect(() => {
    setSelectedWellId((current) =>
      availableWells.some((well) => well.id === current) ? current : (availableWells[0]?.id ?? ""),
    );
  }, [entries, writableQuery.data, canManageCas]);

  const refresh = async () => {
    await Promise.all([writersQuery.refetch(), writableQuery.refetch()]);
  };

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authIdToken || !selectedWellId || !canAddSelected) return;
    setBusy(true);
    setFeedback(null);
    try {
      await addWellWriter(authIdToken, selectedWellId, newWriterUid);
      await refresh();
      setNewWriterUid("");
      setFeedback({ text: "Usuario autorizado para cargar mediciones.", tone: "success" });
    } catch (error) {
      setFeedback({ text: toRemoteErrorMessage(error, "No fue posible asignar al usuario."), tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (firebaseUid: string) => {
    if (!authIdToken || !selectedWellId) return;
    if (firebaseUid === authUid && !(await confirm({
      title: "¿Quitar tu propio acceso?",
      description: canManageCas
        ? "Perderás el permiso para cargar datos en este pozo. Podrás seguir administrando sus accesos."
        : "Perderás el permiso para cargar datos y gestionar usuarios de este pozo.",
      confirmLabel: "Quitar acceso",
      destructive: true,
    }))) return;
    setBusy(true);
    setFeedback(null);
    try {
      await revokeWellWriter(authIdToken, selectedWellId, firebaseUid);
      if (firebaseUid === authUid && !canManageCas) {
        await writableQuery.refetch();
      } else {
        await refresh();
      }
      setFeedback({ text: "Acceso retirado de este pozo.", tone: "success" });
    } catch (error) {
      setFeedback({ text: toRemoteErrorMessage(error, "No fue posible quitar el acceso."), tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="well-access-admin well-writers-panel">
      {confirmationDialog}
      <div className="well-admin-intro">
        <span className="well-admin-intro-icon" aria-hidden="true"><UsersRound size={22} /></span>
        <div>
          <h4>Accesos de carga</h4>
          <p>Administra quién puede subir mediciones a cada pozo.</p>
        </div>
      </div>

      <section className="well-writers-context" aria-labelledby="well-writers-context-heading">
        <div>
          <span className="well-writers-kicker">POZO SELECCIONADO</span>
          <h5 id="well-writers-context-heading">{selectedWell?.name ?? "Selecciona un pozo"}</h5>
          <p>{selectedWell ? `${selectedWell.codigoObra} · ${selectedWell.casCode}` : "Elige un pozo para administrar sus accesos."}</p>
        </div>
        <label>
          <span>Pozo</span>
          <select
            value={selectedWellId}
            onChange={(event) => {
              setSelectedWellId(event.target.value);
              setNewWriterUid("");
              setFeedback(null);
            }}
            disabled={!availableWells.length}
          >
            {!availableWells.length && <option value="">Sin pozos disponibles</option>}
            {availableWells.map((well) => (
              <option key={well.id} value={well.id}>{well.codigoObra} · {well.name}</option>
            ))}
          </select>
        </label>
      </section>

      {writableQuery.isError && <p className="form-feedback is-error" role="alert">No fue posible cargar los permisos de pozos.</p>}

      {selectedWell ? (
        <div className="well-writers-grid">
          <section className="well-writers-card" aria-labelledby="well-writers-current-heading">
            <div className="well-writers-card-heading">
              <div className="well-writers-card-title">
                <UsersRound size={19} aria-hidden="true" />
                <h5 id="well-writers-current-heading">Usuarios con acceso</h5>
              </div>
              {writersQuery.isSuccess && <span className="well-writers-count">{writersQuery.data.length}</span>}
            </div>
            <p>Estas personas pueden cargar mediciones en este pozo.</p>
            {writersQuery.isPending && <p className="well-writers-state">Cargando accesos…</p>}
            {writersQuery.isError && <p className="form-feedback is-error" role="alert">No fue posible cargar los usuarios autorizados.</p>}
            {writersQuery.isSuccess && writersQuery.data.length === 0 && (
              <p className="well-writers-state">Este pozo todavía no tiene usuarios con acceso de carga.</p>
            )}
            {writersQuery.isSuccess && writersQuery.data.length > 0 && (
              <ul className="well-writers-list">
                {writersQuery.data.map((writer) => {
                  const user = usersByUid.get(writer.firebaseUid);
                  const name = user?.displayName || user?.email || writer.displayName || writer.email || (writer.firebaseUid === authUid ? "Tu cuenta" : writer.firebaseUid);
                  const email = user?.email || writer.email;
                  const role = roleLabel(user?.role);
                  const details = [email && email !== name ? email : null, role]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <li className="well-writers-person" key={writer.firebaseUid}>
                      <span className="user-avatar" aria-hidden="true"><UserRound size={19} /></span>
                      <div className="well-writers-person-copy">
                        <strong>{name}{writer.firebaseUid === authUid && name !== "Tu cuenta" && <span className="well-writers-self">Tú</span>}</strong>
                        {details && <small>{details}</small>}
                      </div>
                      <button type="button" className="well-writers-remove" disabled={busy} onClick={() => void handleRevoke(writer.firebaseUid)} aria-label={`Quitar acceso a ${name}`}>
                        <Trash2 size={15} aria-hidden="true" />
                        <span>Quitar</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="well-writers-card" aria-labelledby="well-writers-add-heading">
            <div className="well-writers-card-heading">
              <div className="well-writers-card-title">
                <UserPlus size={19} aria-hidden="true" />
                <h5 id="well-writers-add-heading">Agregar acceso</h5>
              </div>
            </div>
            <p>Elige una persona para habilitar la carga de mediciones.</p>
            <form className="manual-entry-form well-writers-add-form" onSubmit={handleAdd}>
              <label>
                <span>Usuario</span>
                <select value={newWriterUid} onChange={(event) => setNewWriterUid(event.target.value)} disabled={busy || !candidates.length}>
                  <option value="">{usersQuery.isPending || writersQuery.isPending ? "Cargando usuarios…" : "Selecciona una persona"}</option>
                  {candidates.map((user) => <option key={user.uid} value={user.uid}>{user.displayName || user.email || user.uid} · {roleLabel(user.role)}</option>)}
                </select>
              </label>
              <small>Administradores generales o técnicos miembros de la CAS.</small>
              {usersQuery.isError && <p className="form-feedback is-error" role="alert">No fue posible cargar los usuarios disponibles para este pozo.</p>}
              {usersQuery.isSuccess && writersQuery.isSuccess && candidates.length === 0 && <p className="well-writers-state">No hay más personas disponibles para agregar.</p>}
              <button type="submit" disabled={!canAddSelected}>
                <UserPlus size={16} aria-hidden="true" />
                Agregar acceso
              </button>
            </form>
          </section>
        </div>
      ) : (
        !writableQuery.isPending && <p className="well-writers-state">No hay pozos disponibles para administrar.</p>
      )}
      {feedback && <p className={`form-feedback is-${feedback.tone}`} role={feedback.tone === "error" ? "alert" : "status"}>{feedback.text}</p>}
    </div>
  );
}
