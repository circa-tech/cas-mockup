import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { queryKeys } from "../../lib/queryKeys";
import { useOfflineState } from "../../offline/state";
import {
  createMeasurementRecorder,
  fetchMeasurementRecorders,
  type MeasurementRecorder,
} from "../../services/wellsApi";
import { invalidTitularRutMessage, normalizeTitularRut } from "./titular";

const lastRecorderKey = (authUid: string | null) =>
  authUid ? `cas.wells.last-recorder.${encodeURIComponent(authUid)}` : null;

function readLastRecorder(key: string | null) {
  try {
    return key ? localStorage.getItem(key) ?? "" : "";
  } catch {
    return "";
  }
}

export function useMeasurementRecorderDirectory(authIdToken: string | null, authUid: string | null, canRecord: boolean) {
  const offline = useOfflineState();
  const online = offline.online && !offline.networkUnavailable;
  const enabled = Boolean(authIdToken && authUid && online && canRecord);
  const storageKey = lastRecorderKey(authUid);
  const [selectedId, setSelectedId] = useState(() => readLastRecorder(storageKey));
  const key = queryKeys.wells.measurementRecorders(authIdToken);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: key,
    enabled,
    queryFn: ({ signal }) => fetchMeasurementRecorders(authIdToken!, signal),
    staleTime: 0,
    gcTime: 0,
  });
  const save = useMutation({
    gcTime: 0,
    mutationFn: (recorder: Pick<MeasurementRecorder, "name" | "rut">) =>
      createMeasurementRecorder(authIdToken!, recorder),
  });

  const ready = enabled && query.isSuccess;
  const recorders = ready ? query.data : [];
  const selectedRecorder = recorders.find((recorder) => recorder.id === selectedId);
  const selectRecorder = (id: string) => {
    setSelectedId(id);
    try {
      if (storageKey) {
        if (id) localStorage.setItem(storageKey, id);
        else localStorage.removeItem(storageKey);
      }
    } catch {
      // The selected recorder still works for the current form.
    }
  };
  const addRecorder = (recorder: Pick<MeasurementRecorder, "name" | "rut">, onAdded: () => void) => {
    save.mutate(recorder, {
      onSuccess: (result) => {
        client.setQueryData<MeasurementRecorder[]>(key, (previous = []) =>
          previous.some((person) => person.id === result.id) ? previous : [...previous, result],
        );
        selectRecorder(result.id);
        onAdded();
        void client.invalidateQueries({ queryKey: key, exact: true });
      },
    });
  };

  return {
    addRecorder,
    canRecord,
    online,
    ready,
    recorders,
    selectedRecorder,
    selectRecorder,
    query,
    save,
  };
}

const simplifyName = (value: string) =>
  value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es-CL");
const compactRut = (value: string) => value.replace(/[.\s-]/g, "").toUpperCase();

export function MeasurementRecorderPicker({
  directory,
  disabled,
}: {
  directory: ReturnType<typeof useMeasurementRecorderDirectory>;
  disabled: boolean;
}) {
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const { recorders, selectedRecorder, ready, online, canRecord, selectRecorder, query, save } = directory;
  const nameQuery = simplifyName(search.trim());
  const rutQuery = compactRut(search);
  const matches = recorders.filter((recorder) =>
    simplifyName(recorder.name).includes(nameQuery) ||
    (rutQuery.length > 0 && compactRut(recorder.rut).includes(rutQuery)));
  const options = selectedRecorder && !matches.includes(selectedRecorder)
    ? [selectedRecorder, ...matches]
    : matches;
  const close = () => {
    save.reset();
    setAdding(false);
  };

  return (
    <div className="recorder-picker">
      <label>
        <span>Buscar por nombre o RUT</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          disabled={!ready || disabled}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault();
          }}
        />
      </label>
      <label>
        <span>Registrado por *</span>
        <select
          required
          value={selectedRecorder?.id ?? ""}
          onChange={(event) => selectRecorder(event.target.value)}
          disabled={!ready || disabled}
        >
          <option value="">Selecciona una persona</option>
          {options.map((recorder) => (
            <option key={recorder.id} value={recorder.id}>{recorder.name} · {recorder.rut}</option>
          ))}
        </select>
      </label>
      {canRecord && !online && <small className="field-help">Conéctate para consultar el directorio.</small>}
      {canRecord && online && query.isPending && <small role="status">Cargando directorio…</small>}
      {canRecord && online && query.isError && (
        <div className="recorder-picker-actions">
          <small role="alert">No se pudo cargar el directorio.</small>
          <button type="button" onClick={() => void query.refetch()}>Reintentar</button>
        </div>
      )}
      {ready && (
        <div className="recorder-picker-actions">
          <button type="button" disabled={disabled} onClick={() => setAdding(true)}>+ Agregar persona</button>
          {matches.length === 0 && (
            <small role="status">{search.trim() ? "No hay coincidencias." : "Todavía no hay personas registradas."}</small>
          )}
        </div>
      )}
      {adding && (
        <AddRecorderDialog
          error={save.isError}
          saving={save.isPending}
          onClose={close}
          onSave={(recorder) => directory.addRecorder(recorder, () => {
            setSearch("");
            close();
          })}
        />
      )}
    </div>
  );
}

function AddRecorderDialog({
  error,
  saving,
  onClose,
  onSave,
}: {
  error: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (recorder: Pick<MeasurementRecorder, "name" | "rut">) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const [name, setName] = useState("");
  const [rut, setRut] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (saving) return;
    const normalizedRut = normalizeTitularRut(rut);
    if (!name.trim() || !normalizedRut) {
      setValidationError(name.trim() ? invalidTitularRutMessage : "Escribe el nombre de la persona.");
      return;
    }
    setValidationError(null);
    onSave({ name: name.trim(), rut: normalizedRut });
  }

  return createPortal(
    <dialog ref={dialog} className="confirmation-dialog" aria-labelledby={title} onCancel={(event) => {
      event.preventDefault();
      if (!saving) onClose();
    }}>
      <form className="confirmation-content recorder-dialog-form" onSubmit={submit}>
        <h2 id={title}>Agregar persona</h2>
        <label>
          Nombre
          <input autoFocus required maxLength={255} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          RUT
          <input required value={rut} onChange={(event) => setRut(event.target.value)} />
        </label>
        {validationError && <p role="alert">{validationError}</p>}
        {error && !validationError && <p role="alert">No se pudo agregar la persona. Intenta nuevamente.</p>}
        <div className="confirmation-actions">
          <button type="button" disabled={saving} onClick={onClose}>Cancelar</button>
          <button type="submit" className="is-primary" disabled={saving}>{saving ? "Guardando…" : "Guardar persona"}</button>
        </div>
      </form>
    </dialog>,
    document.body,
  );
}
