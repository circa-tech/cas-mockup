import { getOfflineState } from "./state";
import { clearSavedData, hasOfflineDatabase, invalidateResponses, readResponse, type SavedResponse, type SavedSession } from "./storage";

export class OfflineDataUnavailableError extends Error {
  constructor() {
    super("Estos datos no están disponibles en la copia sin conexión.");
    this.name = "OfflineDataUnavailableError";
  }
}

export const canonicalUrl = (input: string | URL) => {
  const url = new URL(input, window.location.origin);
  url.searchParams.sort();
  return url.href;
};

// Administration, user directories and generated downloads are online only.
export function canSaveResponse(url: string) {
  const path = new URL(url).pathname;
  return /^\/api\/v1\/(weather-stations\/snapshot|modis-snow\/(history|coverage-series|basins-geojson|latest-image)|et-lat\/(history|std-ae|serie-et|et-cult|mapa-sectores|mapa-cult|mapa-cuadrantes|et-poly|kc-poly|lai-poly|data-cuad)|wells\/(groundwater-measurements(?:\/history)?|admin\/me|registry(?:\/mine)?)|forum\/threads(?:\/[^/]+(?:\/posts)?)?)$/.test(path);
}

function canReadSavedResource(url: string, session: SavedSession) {
  const path = new URL(url).pathname;
  if (/^\/api\/v1\/et-lat\/(kc-poly|lai-poly)$/.test(path)) return session.role === "general_admin";
  if (/^\/api\/v1\/et-lat\/(mapa-cuadrantes|data-cuad)$/.test(path)) return session.permissions.includes("et:download");
  if (path.startsWith("/api/v1/wells/")) return session.role !== "public_user";
  if (path.startsWith("/api/v1/forum/")) return ["cas_user", "technical_admin", "general_admin"].includes(session.role);
  return true;
}

function savedResponse(entry: SavedResponse) {
  const headers = new Headers(entry.headers);
  headers.set("X-CAS-Saved-At", String(entry.savedAt));
  return new Response(entry.body, { headers });
}

const inFlight = new Map<string, Promise<Response>>();

export async function apiFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  const url = canonicalUrl(input);
  const method = (init.method ?? "GET").toUpperCase();
  const current = getOfflineState();
  const cacheable = method === "GET" && canSaveResponse(url) && Boolean(current.session);
  if (!current.online) {
    if (method !== "GET") throw new Error("Necesitas conexión para guardar cambios. No se enviará nada automáticamente.");
    const entry = cacheable && current.session && canReadSavedResource(url, current.session)
      ? await readResponse(current.scope, url).catch(() => undefined)
      : undefined;
    assertCurrent(current.generation, init.signal);
    if (entry) return savedResponse(entry);
    throw new OfflineDataUnavailableError();
  }

  // Only foreground GETs share requests. Manual downloads are independent.
  if (!cacheable || init.signal) return fetchLiveResponse(url, init);
  const key = JSON.stringify([current.generation, current.session?.idToken, url]);
  const existing = inFlight.get(key);
  if (existing) return (await existing).clone();
  const pending = fetchLiveResponse(url, init);
  inFlight.set(key, pending);
  try { return (await pending).clone(); }
  finally { if (inFlight.get(key) === pending) inFlight.delete(key); }
}

function assertCurrent(generation: number, signal?: AbortSignal | null) {
  if (getOfflineState().generation !== generation || signal?.aborted) {
    throw new DOMException("La sesión cambió o la solicitud se canceló.", "AbortError");
  }
}

export async function fetchLiveResponse(
  url: string,
  init: RequestInit = {},
  manualCopy = false,
): Promise<Response> {
  const { generation, online, scope, session } = getOfflineState();
  const method = (init.method ?? "GET").toUpperCase();
  assertCurrent(generation, init.signal);
  if (!online || !session?.idToken) {
    if (method !== "GET") throw new Error("Necesitas conexión para guardar cambios. No se enviará nada automáticamente.");
    throw new Error("No hay una sesión en línea disponible para consultar los datos.");
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.idToken}`);
  const timeout = AbortSignal.timeout(15_000);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  const response = await fetch(url, { ...init, headers, cache: "no-store", signal });
  assertCurrent(generation, init.signal);

  const deniedResource = method === "GET" && canSaveResponse(url) &&
    [401, 403, 404].includes(response.status);
  // The recorder directory contains personal data and has no offline representation.
  const changesSnapshot = method !== "GET" && response.ok &&
    new URL(url).pathname !== "/api/v1/wells/measurement-recorders";
  if (!manualCopy && (response.status === 401 || deniedResource || changesSnapshot)) {
    const prefix = new URL(url).pathname.split("/").slice(0, 4).join("/");
    // The network response stays authoritative even if local storage is disabled.
    // Wait for deletion before the returning caller can switch to offline mode.
    try {
      if (response.status === 401) {
        if (await hasOfflineDatabase()) {
          await clearSavedData({ scope, isCurrent: () => {
            const current = getOfflineState();
            return current.generation === generation && current.session?.idToken === session.idToken;
          } });
        }
      } else {
        await invalidateResponses(scope, prefix, deniedResource ? url : undefined);
      }
    } catch { /* The authenticated request's result is independent of browser storage. */ }
    assertCurrent(generation, init.signal);
  }
  return response;
}
