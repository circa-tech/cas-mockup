import { getOfflineState, isReadOnly, updateOfflineState } from "./state";
import { deleteResponse, invalidateResponses, readResponse, responseKey, saveResponse, type SavedResponse } from "./storage";

export class OfflineDataUnavailableError extends Error {
  constructor() {
    super("Estos datos aún no están disponibles sin conexión. Abre esta sección cuando tengas internet.");
    this.name = "OfflineDataUnavailableError";
  }
}

export const canonicalUrl = (input: string | URL) => {
  const url = new URL(input, window.location.origin);
  url.searchParams.sort();
  return url.href;
};

// Explicit allowlist: administration, user directories and generated downloads
// must never enter the offline response store.
export function canSaveResponse(url: string) {
  const path = new URL(url).pathname;
  return /^\/api\/v1\/(weather-stations\/snapshot|modis-snow\/(coverage-series|basins-geojson|latest-image)|et-lat\/(std-ae|serie-et|et-cult|mapa-sectores|mapa-cult|mapa-cuadrantes|et-poly|kc-poly|lai-poly|data-cuad)|wells\/(groundwater-measurements|admin\/me|registry(?:\/mine)?)|forum\/threads(?:\/[^/]+(?:\/posts)?)?)$/.test(path);
}

function savedResponse(entry: SavedResponse) {
  const headers = new Headers(entry.headers);
  headers.set("X-CAS-Saved-At", String(entry.savedAt));
  return new Response(entry.body, { status: 200, headers });
}

const inFlight = new Map<string, Promise<Response>>();

export async function apiFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  const url = canonicalUrl(input);
  const method = (init.method ?? "GET").toUpperCase();
  const current = getOfflineState();
  const cacheable = method === "GET" && canSaveResponse(url) && Boolean(current.session);
  const key = `${current.generation}:${responseKey(current.scope, url)}`;
  // Share foreground and preparation requests without sharing consumed bodies.
  if (cacheable && !init.signal) {
    const existing = inFlight.get(key);
    if (existing) return (await existing).clone();
    const pending = fetchResponse(url, init, cacheable);
    inFlight.set(key, pending);
    try { return (await pending).clone(); }
    finally { if (inFlight.get(key) === pending) inFlight.delete(key); }
  }
  return fetchResponse(url, init, cacheable);
}

async function fetchResponse(url: string, init: RequestInit, cacheable: boolean) {
  const { scope, generation, online, session } = getOfflineState();
  const method = (init.method ?? "GET").toUpperCase();
  const assertCurrent = () => {
    if (getOfflineState().generation !== generation || init.signal?.aborted) {
      throw new DOMException("La sesión cambió o la solicitud se canceló.", "AbortError");
    }
  };
  if (method !== "GET" && isReadOnly()) {
    throw new Error("Necesitas conexión para guardar cambios. No se enviará nada automáticamente.");
  }
  let cached: SavedResponse | undefined;
  if (cacheable) {
    try { cached = await readResponse(scope, url); }
    catch { updateOfflineState({ storageError: true }); }
  }
  assertCurrent();
  if (!online || !session?.idToken) {
    if (cached) return savedResponse(cached);
    throw new OfflineDataUnavailableError();
  }
  // Brief freshness prevents a login preparation job from downloading the same
  // snapshot again when a tab mounts. Reconnect/manual refresh can bypass this.
  if (cached && init.cache !== "reload" && Date.now() - cached.savedAt < 60_000) {
    return savedResponse(cached);
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.idToken}`);
  if (cached && new Headers(cached.headers).has("ETag")) {
    headers.set("If-None-Match", new Headers(cached.headers).get("ETag")!);
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  init.signal?.addEventListener("abort", abort, { once: true });
  const timeout = window.setTimeout(abort, 15_000);
  let response: Response;
  let body: Blob | undefined;
  try {
    response = await fetch(url, { ...init, headers, cache: "no-store", signal: controller.signal });
    assertCurrent();
    if (cacheable && response.ok) body = await response.clone().blob();
    assertCurrent();
  } catch (error) {
    assertCurrent();
    updateOfflineState({ networkUnavailable: true });
    if (cached) return savedResponse(cached);
    if (method === "GET") throw new OfflineDataUnavailableError();
    throw error;
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abort);
  }
  if (response.status === 401 || response.status === 403 || response.status === 404) {
    // Never mask a server-side permission denial or deletion with saved data.
    if (cached) await deleteResponse(cached.key).catch(() => updateOfflineState({ storageError: true }));
    return response;
  }
  if (response.status >= 500 && cached) {
    updateOfflineState({ networkUnavailable: true });
    return savedResponse(cached);
  }
  if (response.status === 304 && cached) response = savedResponse(cached);
  if (!response.ok) return response;
  updateOfflineState({ networkUnavailable: false });
  if (cacheable) {
    assertCurrent();
    const entry: SavedResponse = {
      key: responseKey(scope, url), scope, url, body: body ?? cached!.body, savedAt: Date.now(),
      headers: [...response.headers.entries()].filter(([name]) =>
        ["content-type", "etag", "x-image-date", "x-image-bounds", "x-image-crs"].includes(name)),
    };
    try { await saveResponse(entry, () => getOfflineState().generation === generation); }
    catch { updateOfflineState({ storageError: true }); }
    assertCurrent();
  } else if (method !== "GET") {
    const prefix = new URL(url).pathname.split("/").slice(0, 4).join("/");
    await invalidateResponses(scope, prefix).catch(() => updateOfflineState({ storageError: true }));
  }
  return response;
}
