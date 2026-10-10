import { useEffect } from "react";
import { apiFetch, canonicalUrl } from "./apiFetch";
import { getOfflineState, updateOfflineState, useOfflineState } from "./state";
import { listResponses, readResponse, OFFLINE_MAX_AGE } from "./storage";
import { queryClient } from "../lib/queryClient";

const apiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
const corePaths = [
  "weather-stations/snapshot",
  "et-lat/std-ae", "et-lat/serie-et", "et-lat/et-cult", "et-lat/mapa-sectores",
  "et-lat/mapa-cult", "et-lat/mapa-cuadrantes",
  "et-lat/serie-et?sector_id=19", "et-lat/et-cult?sector_id=19",
  "modis-snow/coverage-series", "modis-snow/basins-geojson", "modis-snow/latest-image",
];
let runRevision = 0;
export function offlinePaths(role: string) {
  return [
    ...corePaths,
    ...(role !== "public_user" ? ["wells/groundwater-measurements", "wells/admin/me", "wells/registry/mine"] : []),
    ...(["cas_user", "technical_admin", "general_admin"].includes(role)
      ? ["forum/threads?page=1&page_size=20"] : []),
  ];
}

export async function prepareOfflineData(refresh = false) {
  const initial = getOfflineState();
  if (!initial.session || !apiBase) return;
  const { generation, scope } = initial;
  const revision = ++runRevision;
  const current = () => getOfflineState().generation === generation && revision === runRevision;
  const paths = offlinePaths(initial.session.role);
  let completed = 0;
  let cursor = 0;
  updateOfflineState({ preparing: initial.online && Boolean(initial.session.idToken), completed: 0, total: paths.length });
  const run = async () => {
    while (cursor < paths.length && current() && getOfflineState().online) {
      const path = paths[cursor++];
      try {
        const response = await apiFetch(`${apiBase}/api/v1/${path}`, { cache: refresh ? "reload" : "default" });
        if (response.ok && current()) completed += 1;
      } catch { /* Other datasets remain useful after a partial failure. */ }
      if (current()) updateOfflineState({ completed });
    }
  };
  const runPhase = async (extra: string[] = []) => {
    paths.push(...extra.filter((path) => !paths.includes(path)));
    if (current()) updateOfflineState({ total: paths.length, requiredUrls: paths.map((path) => canonicalUrl(`${apiBase}/api/v1/${path}`)) });
    if (initial.online && initial.session?.idToken) await Promise.all([run(), run(), run()]);
  };
  const savedJson = async (path: string) => {
    const entry = await readResponse(scope, canonicalUrl(`${apiBase}/api/v1/${path}`)).catch(() => undefined);
    return entry ? new Response(entry.body).json().catch(() => undefined) : undefined;
  };
  await runPhase();
  if (!current()) return;
  const [sectorMap, parcelMap, capabilities] = await Promise.all([
    savedJson("et-lat/mapa-sectores"), savedJson("et-lat/mapa-cult"),
    initial.session.role !== "public_user" ? savedJson("wells/admin/me") : undefined,
  ]);
  // The map currently contains 22 sectors. Bound preparation if the backend
  // expands the area; all other selections are still saved when visited.
  const sectors = ((sectorMap?.features ?? []) as { id?: number; properties?: { sector_id?: number } }[])
    .map((feature) => Number(feature.properties?.sector_id ?? feature.id))
    .filter((id) => Number.isInteger(id) && id > 0 && ![14, 17, 18].includes(id)).slice(0, 24);
  const parcels = (parcelMap?.features ?? []) as { id?: number; properties?: { uso_id?: number } }[];
  const parcel = parcels.find((feature) => Number(feature.properties?.uso_id ?? feature.id) === 855) ?? parcels[0];
  const parcelId = Number(parcel?.properties?.uso_id ?? parcel?.id);
  const downloads = initial.session.permissions.includes("et:download");
  const downloadPath = "et-lat/data-cuad?cuadrante_id=273&variable=ETR";
  await runPhase([
    ...sectors.flatMap((id) => [`et-lat/serie-et?sector_id=${id}`, `et-lat/et-cult?sector_id=${id}`]),
    ...(Number.isInteger(parcelId) && parcelId > 0 ? ["et-poly", "kc-poly", "lai-poly"].map((resource) => `et-lat/${resource}?uso_id=${parcelId}`) : []),
    ...(capabilities?.canManageCas ? ["wells/registry"] : []),
    ...(downloads ? [downloadPath] : []),
  ]);
  if (!current()) return;
  if (downloads) {
    const years = (await savedJson(downloadPath))?.anos as number[] | undefined;
    const year = years?.includes(2025) ? 2025 : Math.max(...(years ?? []));
    if (Number.isFinite(year)) {
      const monthPath = `${downloadPath}&ano=${year}`;
      await runPhase([monthPath]);
      const months = (await savedJson(monthPath))?.meses as number[] | undefined;
      const month = months?.includes(1) ? 1 : Math.max(...(months ?? []));
      if (Number.isFinite(month)) await runPhase([`${monthPath}&mes=${month}`]);
    }
  }
  if (!current()) return;
  // Read the committed entries, not request success, before reporting readiness.
  // This also verifies the actual contents when restarting without connectivity.
  try {
    const saved = (await listResponses()).filter((entry) => entry.scope === scope && Date.now() - entry.savedAt < OFFLINE_MAX_AGE);
    const requiredUrls = paths.map((path) => canonicalUrl(`${apiBase}/api/v1/${path}`));
    const required = saved.filter((entry) => requiredUrls.includes(entry.url));
    if (current()) updateOfflineState({
      completed: required.length,
      lastSync: required.length ? Math.min(...required.map((entry) => entry.savedAt)) : null,
    });
  } catch { if (current()) updateOfflineState({ storageError: true }); }
  finally { if (current()) updateOfflineState({ preparing: false }); }
}

let preparation: Promise<void> | null = null;
export function refreshOfflineData() {
  if (preparation) return preparation;
  updateOfflineState({ networkUnavailable: false, storageError: false });
  preparation = prepareOfflineData(true).then(() => queryClient.invalidateQueries()).finally(() => { preparation = null; });
  return preparation;
}

export function useOfflinePreparation(enabled: boolean) {
  const { scope, online, session } = useOfflineState();
  const hasCredential = Boolean(session?.idToken);
  useEffect(() => {
    if (!enabled) return;
    // Allow initial screen requests to start first. StrictMode cleanup cancels
    // the redundant scheduling before a second preparation job is launched.
    const timer = window.setTimeout(() => { void prepareOfflineData(); }, 500);
    return () => clearTimeout(timer);
  }, [enabled, scope, online, hasCredential]);
  useEffect(() => {
    if (!enabled) return;
    let timer: number;
    const verify = () => {
      clearTimeout(timer);
      timer = window.setTimeout(async () => {
        const snapshot = getOfflineState();
        if (snapshot.preparing || !snapshot.requiredUrls.length) return;
        try {
          const entries = (await listResponses()).filter((entry) =>
            entry.scope === snapshot.scope && snapshot.requiredUrls.includes(entry.url) && Date.now() - entry.savedAt < OFFLINE_MAX_AGE);
          if (getOfflineState().generation === snapshot.generation) updateOfflineState({
            completed: entries.length,
            lastSync: entries.length ? Math.min(...entries.map((entry) => entry.savedAt)) : null,
          });
        } catch { updateOfflineState({ storageError: true }); }
      }, 300);
    };
    window.addEventListener("cas-offline-cache-changed", verify);
    document.addEventListener("visibilitychange", verify);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("cas-offline-cache-changed", verify);
      document.removeEventListener("visibilitychange", verify);
    };
  }, [enabled, scope]);
}
