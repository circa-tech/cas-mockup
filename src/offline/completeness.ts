import { OFFLINE_MAX_AGE, type SavedResponse } from "./storage";
import { findSavedHistoryPreset } from "./history";

export function snapshotCompleteness(entries: SavedResponse[], scope: string, requiredUrls: string[]) {
  const saved = new Map(entries.filter((entry) => entry.scope === scope && Date.now() - entry.savedAt < OFFLINE_MAX_AGE)
    .map((entry) => [entry.url, entry]));
  // Preparation includes the one-year preset. A valid older copy still counts
  // as available offline when the calendar advances; online refresh uses today.
  const available = new Map(requiredUrls.map((url) => [url, saved.get(url) ?? findSavedHistoryPreset(entries, scope, url, 1)]));
  const required = [...available.values()].filter((entry): entry is SavedResponse => Boolean(entry));
  const labels: Record<string, string> = { "weather-stations": "Clima", "et-lat": "Evapotranspiración", "modis-snow": "Nieve", wells: "Pozos", forum: "Foro" };
  return {
    completed: required.length,
    lastSync: required.length ? Math.min(...required.map((entry) => entry.savedAt)) : null,
    missingSections: [...new Set(requiredUrls.filter((url) => !available.get(url)).map((url) => labels[new URL(url).pathname.split("/")[3]] ?? "Datos") )],
  };
}
