import { WifiOff } from "lucide-react";
import { deleteOfflineCopy, saveOfflineCopy } from "../offline/prepare";
import { updateOfflineShell } from "../offline/serviceWorker";
import { useOfflineState } from "../offline/state";

const formatCopyDate = (time: number) => new Date(time).toLocaleString("es-CL");

function CopyDetails() {
  const { completed, total, missingSections, forumTruncated } = useOfflineState();
  return (
    <>
      {total > 0 && completed < total && <span>Copia parcial ({completed}/{total}). Falta guardar: {missingSections.join(", ")}.</span>}
      {forumTruncated && <span>Algunas páginas del foro requieren conexión.</span>}
    </>
  );
}

export function OfflineBanner() {
  const { online, lastSync } = useOfflineState();
  if (online || !lastSync) return null;
  return (
    <aside className="offline-banner is-offline" aria-label="Disponibilidad sin conexión">
      <WifiOff size={18} aria-hidden="true" />
      <div role="status">
        <strong>Mostrando datos guardados el {formatCopyDate(lastSync)}</strong>
        <CopyDetails />
      </div>
    </aside>
  );
}

export function OfflineCopyUnavailable() {
  return (
    <main className="route-loading-state">
      <aside className="offline-banner is-offline" aria-label="Disponibilidad sin conexión" role="status">
        <WifiOff size={18} aria-hidden="true" />
        <strong>Sin conexión. Para usar la plataforma sin internet, guarda una copia antes de salir.</strong>
      </aside>
    </main>
  );
}

export function OfflineCopyControls() {
  const state = useOfflineState();
  return (
    <section className="offline-copy-controls" id="offline-copy-controls" aria-label="Disponibilidad sin conexión">
      <div role="status" aria-live="polite">
        {state.lastSync ? <p>Última copia <time dateTime={new Date(state.lastSync).toISOString()}>{formatCopyDate(state.lastSync)}</time></p>
          : <p>{state.copyChecked ? "En este dispositivo no hay una copia guardada." : "Comprobando la copia guardada…"}</p>}
        {state.progress && <p>Guardando copia ({state.progress.completed}/{state.progress.total})…</p>}
        {state.storageError && <p>No se pudo leer la copia en este navegador.</p>}
        {state.saveError && <p>{state.saveError}</p>}
        {!state.preparing && state.lastSync && <CopyDetails />}
        {state.lastSync && !state.preparing && !state.shellReady && <p>La aplicación aún no está lista para volver a abrirse sin conexión.</p>}
        {state.lastSync && !state.preparing && state.shellReady && state.total === state.completed && !state.forumTruncated &&
          <p>Datos principales disponibles sin conexión</p>}
      </div>
      <button type="button" onClick={() => void saveOfflineCopy()} disabled={!state.online || !state.session?.idToken || state.preparing}>
        Guardar copia ahora
      </button>
      <button type="button" onClick={() => void deleteOfflineCopy()} disabled={!state.lastSync && !state.preparing}>
        Eliminar copia
      </button>
      {state.online && state.shellUpdateAvailable &&
        <button type="button" onClick={() => void updateOfflineShell()}>Actualizar aplicación</button>}
    </section>
  );
}
