import { CloudDownload, WifiOff } from "lucide-react";
import { useOfflineState } from "../offline/state";
import { refreshOfflineData } from "../offline/prepare";

export function OfflineBanner() {
  const state = useOfflineState();
  if (!state.session) return null;
  const offline = !state.online || state.networkUnavailable || !state.session.idToken;
  const ready = state.total > 0 && state.completed === state.total && state.shellReady && !state.storageError;
  const title = offline ? "Sin conexión · Solo lectura"
    : state.storageError ? "No se pudieron guardar todos los datos en este dispositivo"
    : state.preparing ? `Preparando datos sin conexión (${state.completed}/${state.total})`
    : ready ? "Datos principales disponibles sin conexión"
    : "Preparación sin conexión incompleta";
  return (
    <aside className={`offline-banner${offline ? " is-offline" : ""}`} aria-label="Disponibilidad sin conexión">
      {offline ? <WifiOff size={18} aria-hidden="true" /> : <CloudDownload size={18} aria-hidden="true" />}
      <div role="status" aria-live="polite">
        <strong>{title}</strong>
        <span>
          {state.lastSync ? `Datos principales guardados desde ${new Date(state.lastSync).toLocaleString("es-CL")}. ` : "Aún no hay una copia completa. "}
          Las parcelas y páginas del foro se guardan al consultarlas. Mapas base, videos y nuevas descargas requieren conexión.
        </span>
      </div>
      {state.online && state.session.idToken && (
        <button type="button" disabled={state.preparing} onClick={() => { void refreshOfflineData(); }}>
          {state.preparing ? "Guardando…" : "Actualizar copia"}
        </button>
      )}
    </aside>
  );
}
