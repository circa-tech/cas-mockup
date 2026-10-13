import { historyPreset, validHistoryRange, type HistoryPreset } from "../utils/history";
import { apiFetch, OfflineDataUnavailableError } from "./apiFetch";
import { getOfflineState, updateOfflineState } from "./state";
import { listResponses, OFFLINE_MAX_AGE, type SavedResponse } from "./storage";

// Ignore only the moving date bounds. Origin, endpoint, entity and resolution
// must still match, and custom ranges never opt into this fallback.
function presetIdentity(input: string, preset: HistoryPreset, today: Date) {
  const url = new URL(input);
  if (!/^\/api\/v1\/(et-lat|modis-snow)\/history$/.test(url.pathname)) return undefined;
  const range = { start_date: url.searchParams.get("start_date") ?? "", end_date: url.searchParams.get("end_date") ?? "" };
  if (!validHistoryRange(range, today)
    || range.start_date !== historyPreset(preset, new Date(`${range.end_date}T00:00:00Z`)).start_date) return undefined;
  url.searchParams.delete("start_date");
  url.searchParams.delete("end_date");
  url.searchParams.sort();
  return { identity: url.href, end: range.end_date };
}

export function findSavedHistoryPreset(entries: SavedResponse[], scope: string, url: string, preset: HistoryPreset, now = Date.now()) {
  const today = new Date(now);
  const requested = presetIdentity(url, preset, today);
  if (!requested) return undefined;
  return entries.filter((entry) => {
    if (entry.scope !== scope || now - entry.savedAt >= OFFLINE_MAX_AGE) return false;
    const saved = presetIdentity(entry.url, preset, today);
    return saved?.identity === requested.identity && saved.end <= requested.end;
  }).sort((a, b) => {
    const endA = new URL(a.url).searchParams.get("end_date")!;
    const endB = new URL(b.url).searchParams.get("end_date")!;
    return endB.localeCompare(endA) || b.savedAt - a.savedAt;
  })[0];
}

export async function fetchHistoryResponse(url: string, init: RequestInit, preset?: HistoryPreset): Promise<Response> {
  const { scope, generation } = getOfflineState();
  try {
    return await apiFetch(url, init);
  } catch (error) {
    if (!(error instanceof OfflineDataUnavailableError) || preset === undefined) throw error;
    const entries = await listResponses().catch(() => {
      updateOfflineState({ storageError: true });
      return [];
    });
    if (getOfflineState().generation !== generation || init.signal?.aborted) {
      throw new DOMException("La sesión cambió o la solicitud se canceló.", "AbortError");
    }
    const saved = findSavedHistoryPreset(entries, scope, url, preset);
    if (!saved) throw error;
    // Preserve the saved response's actual dates; do not store it under today's URL.
    return new Response(saved.body, { headers: saved.headers });
  }
}
