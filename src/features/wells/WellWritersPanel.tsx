import { useQuery } from "@tanstack/react-query";
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
  const [message, setMessage] = useState<string | null>(null);
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
  const candidates = (usersQuery.data ?? []).filter(
    (user) => !assignedIds.has(user.uid),
  );

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
    if (!authIdToken || !selectedWellId || !candidates.some((user) => user.uid === newWriterUid)) return;
    setBusy(true);
    setMessage(null);
    try {
      await addWellWriter(authIdToken, selectedWellId, newWriterUid);
      await refresh();
      setNewWriterUid("");
      setMessage("Usuario autorizado para cargar mediciones.");
    } catch (error) {
      setMessage(toRemoteErrorMessage(error, "No fue posible asignar al usuario."));
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (firebaseUid: string) => {
    if (!authIdToken || !selectedWellId) return;
    if (firebaseUid === authUid && !(await confirm({
      title: "¿Quitar tu propio acceso?",
      description: "Perderás el permiso para cargar datos y gestionar usuarios de este pozo.",
      confirmLabel: "Quitar acceso",
      destructive: true,
    }))) return;
    setBusy(true);
    setMessage(null);
    try {
      await revokeWellWriter(authIdToken, selectedWellId, firebaseUid);
      if (firebaseUid === authUid && !canManageCas) {
        await writableQuery.refetch();
      } else {
        await refresh();
      }
      setMessage("Acceso retirado de este pozo.");
    } catch (error) {
      setMessage(toRemoteErrorMessage(error, "No fue posible quitar el acceso."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="well-access-admin">
      {confirmationDialog}
      <h4>Usuarios autorizados para cargar mediciones</h4>
      {writableQuery.isError && <p className="login-error">No fue posible cargar los permisos de pozos.</p>}
      <label>
        <span>Pozo</span>
        <select value={selectedWellId} onChange={(event) => { setSelectedWellId(event.target.value); setNewWriterUid(""); }} disabled={!availableWells.length}>
          {!availableWells.length && <option value="">Sin pozos disponibles</option>}
          {availableWells.map((well) => <option key={well.id} value={well.id}>{well.codigoObra} · {well.name}</option>)}
        </select>
      </label>
      {selectedWell && (
        <form className="manual-entry-form" onSubmit={handleAdd}>
          <label>
            <span>Agregar usuario</span>
            <select value={newWriterUid} onChange={(event) => setNewWriterUid(event.target.value)} disabled={busy || !candidates.length}>
              <option value="">Seleccionar usuario</option>
              {candidates.map((user) => <option key={user.uid} value={user.uid}>{user.displayName || user.email || user.uid} · {user.role}</option>)}
            </select>
          </label>
          <button type="submit" disabled={busy || !candidates.some((user) => user.uid === newWriterUid)}>Agregar acceso</button>
        </form>
      )}
      {usersQuery.isError && <p className="login-error">No fue posible cargar los usuarios disponibles para este pozo.</p>}
      {writersQuery.isError && <p className="login-error">No fue posible cargar los usuarios autorizados.</p>}
      <div className="registry-list">
        {(writersQuery.data ?? []).map((writer) => (
          <div className="registry-row" key={writer.firebaseUid}>
            <strong>{usersByUid.get(writer.firebaseUid)?.displayName || usersByUid.get(writer.firebaseUid)?.email || writer.displayName || writer.email || (writer.firebaseUid === authUid ? "Tú" : writer.firebaseUid)}</strong>
            <button type="button" disabled={busy} onClick={() => void handleRevoke(writer.firebaseUid)}>Quitar acceso</button>
          </div>
        ))}
        {selectedWell && writersQuery.isSuccess && writersQuery.data.length === 0 && (
          <p>Este pozo no tiene usuarios autorizados para cargar mediciones.</p>
        )}
      </div>
      {message && <p className="login-error">{message}</p>}
    </div>
  );
}
