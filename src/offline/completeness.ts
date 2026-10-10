import { OFFLINE_MAX_AGE, type SavedResponse } from "./storage";

export function snapshotCompleteness(entries: SavedResponse[], scope: string, requiredUrls: string[]) {
  const saved = new Map(entries.filter((entry) => entry.scope === scope && Date.now() - entry.savedAt < OFFLINE_MAX_AGE)
    .map((entry) => [entry.url, entry]));
  const required = requiredUrls.flatMap((url) => saved.has(url) ? [saved.get(url)!] : []);
  const labels: Record<string, string> = { "weather-stations": "Clima", "et-lat": "Evapotranspiración", "modis-snow": "Nieve", wells: "Pozos", forum: "Foro" };
  return {
    completed: required.length,
    lastSync: required.length ? Math.min(...required.map((entry) => entry.savedAt)) : null,
    missingSections: [...new Set(requiredUrls.filter((url) => !saved.has(url)).map((url) => labels[new URL(url).pathname.split("/")[3]] ?? "Datos") )],
  };
}
