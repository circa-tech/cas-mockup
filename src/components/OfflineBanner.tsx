import { CloudDownload, WifiOff } from "lucide-react";
import { useOfflineState } from "../offline/state";
import { refreshOfflineData } from "../offline/prepare";
import { updateOfflineShell } from "../offline/serviceWorker";

export function OfflineBanner() {
  const state = useOfflineState();
  if (!state.session) return null;
  const offline = !state.online || state.networkUnavailable || !state.session.idToken;
  const ready = state.total > 0 && state.completed === state.total && state.shellReady && !state.storageError && !state.forumTruncated;
  const starting = !offline && state.total === 0 && !state.storageError;
  const preparing = starting || state.preparing;
  const title = offline ? "Sin conexión · Solo lectura"
    : state.shellUpdateAvailable ? "Hay una nueva versión para guardar sin conexión"
    : state.storageError ? "No se pudieron guardar todos los datos en este dispositivo"
    : preparing ? `Preparando datos sin conexión${state.total > 0 ? ` (${state.completed}/${state.total})` : "…"}`
    : ready ? "Datos principales disponibles sin conexión"
    : "Preparación sin conexión incompleta";
  return (
    <aside className={`offline-banner${offline ? " is-offline" : ""}`} aria-label="Disponibilidad sin conexión">
      {offline ? <WifiOff size={18} aria-hidden="true" /> : <CloudDownload size={18} aria-hidden="true" />}
      <div role="status" aria-live="polite">
        <strong>{title}</strong>
        <span>
          {ready ? "Copia principal completa. " : preparing ? "Puedes consultar el resumen mientras se guardan las demás secciones. " : state.total > 0 ? `Copia parcial (${state.completed}/${state.total}). ` : "Comprobando la copia guardada. "}
          {state.lastSync ? `Última copia: ${new Date(state.lastSync).toLocaleString("es-CL")}. ` : ""}
          {!preparing && state.missingSections.length > 0 ? `Falta guardar: ${state.missingSections.join(", ")}. ` : ""}
          {state.forumTruncated ? "El foro supera el tamaño de la descarga inicial; algunas páginas requieren conexión. " : ""}
          Mapa regional disponible sin conexión. Otras parcelas se guardan al consultarlas. Satélite, videos y nuevas descargas requieren internet.
        </span>
      </div>
      {state.online && state.shellUpdateAvailable ? (
        <button type="button" onClick={() => { void updateOfflineShell(); }}>Actualizar aplicación</button>
      ) : state.online && state.session.idToken && (
        <button type="button" disabled={preparing} onClick={() => { void refreshOfflineData(); }}>
          {preparing ? "Guardando…" : "Actualizar copia"}
        </button>
      )}
    </aside>
  );
}
