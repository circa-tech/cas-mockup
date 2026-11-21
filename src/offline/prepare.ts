import { useEffect } from "react";
import { canSaveResponse, canonicalUrl, fetchLiveResponse } from "./apiFetch";
import { getOfflineState, updateOfflineState, useOfflineState } from "./state";
import {
  clearSavedData, commitCopy, hasOfflineDatabase, invalidateResponses, reserveCopy,
  OFFLINE_COPY_CHANGED, OFFLINE_MAX_AGE, readCopyContents, responseKey,
  type SavedCopy, type SavedResponse, type SavedSession,
} from "./storage";
import { snapshotCompleteness } from "./completeness";
import { HISTORY_START, historyPreset } from "../utils/history";

const defaultHistoryPath = (module: "et-lat" | "modis-snow", date: Date, selection: Record<string, string> = {}) =>
  `${module}/history?${new URLSearchParams({ ...selection, ...historyPreset(1, date), resolution: "auto", max_points: "1200" })}`;
const fullSnowHistoryPath = (area: string, date: Date) =>
  `modis-snow/history?${new URLSearchParams({
    area,
    start_date: HISTORY_START,
    end_date: date.toISOString().slice(0, 10),
    resolution: "native",
    max_points: "5000",
  })}`;

const apiBase = import.meta.env?.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
const summaryPaths = ["weather-stations/snapshot", "et-lat/std-ae", "et-lat/serie-et", "modis-snow/coverage-series"];
const corePaths = [
  ...summaryPaths,
  "et-lat/et-cult", "et-lat/mapa-sectores", "et-lat/mapa-cult",
  "et-lat/serie-et?sector_id=19", "et-lat/et-cult?sector_id=19",
  "modis-snow/basins-geojson", "modis-snow/latest-image",
];
function offlinePaths(session: SavedSession, date: Date) {
  const { role, permissions } = session;
  return [
    ...corePaths,
    ...(permissions.includes("et:download") ? ["et-lat/mapa-cuadrantes"] : []),
    defaultHistoryPath("et-lat", date),
    defaultHistoryPath("et-lat", date, { sector_id: "19" }),
    ...["ae", "jorquera", "pulido", "manflas"].map((area) => fullSnowHistoryPath(area, date)),
    ...(role !== "public_user" ? ["wells/groundwater-measurements", "wells/admin/me", "wells/registry/mine"] : []),
    ...(["cas_user", "technical_admin", "general_admin"].includes(role)
      ? ["forum/threads?page=1&page_size=20"] : []),
  ];
}

const urlFor = (path: string) => canonicalUrl(`${apiBase}/api/v1/${path}`);

async function planCopy(
  session: SavedSession,
  date: Date,
  getEntry: (url: string) => Promise<SavedResponse | undefined>,
  current: () => boolean,
  status?: (completed: number, total: number) => void,
) {
  const required = new Set<string>();
  const entries = new Map<string, SavedResponse>();
  const paths: string[] = [];
  const runPhase = async (extra: string[]) => {
    if (!current()) return;
    const urls = extra.map(urlFor).filter((url) => {
      if (required.has(url)) return false;
      required.add(url);
      return true;
    });
    paths.push(...extra.filter((path) => !paths.includes(path)));
    let next = 0;
    status?.(entries.size, required.size);
    const run = async () => {
      while (current() && next < urls.length) {
        const url = urls[next++];
        const entry = await getEntry(url);
        if (entry) entries.set(url, entry);
        if (current()) status?.(entries.size, required.size);
      }
    };
    await Promise.all([run(), run(), run()]);
  };
  const savedJson = async (path: string) => {
    const entry = entries.get(urlFor(path));
    return entry ? new Response(entry.body).json().catch(() => undefined) : undefined;
  };
  await runPhase(offlinePaths(session, date));
  const [sectorMap, parcelMap, capabilities] = await Promise.all([
    savedJson("et-lat/mapa-sectores"), savedJson("et-lat/mapa-cult"),
    session.role !== "public_user" ? savedJson("wells/admin/me") : undefined,
  ]);
  // The map currently contains 22 sectors. Bound preparation if the backend
  // expands the area. Other selections require connectivity.
  const sectors = ((sectorMap?.features ?? []) as { id?: number; properties?: { sector_id?: number } }[])
    .map((feature) => Number(feature.properties?.sector_id ?? feature.id))
    .filter((id) => Number.isInteger(id) && id > 0 && ![14, 17, 18].includes(id)).slice(0, 24);
  const parcels = (parcelMap?.features ?? []) as { id?: number; properties?: { uso_id?: number } }[];
  const parcel = parcels.find((feature) => Number(feature.properties?.uso_id ?? feature.id) === 855) ?? parcels[0];
  const parcelId = Number(parcel?.properties?.uso_id ?? parcel?.id);
  const downloads = session.permissions.includes("et:download");
  const downloadPath = "et-lat/data-cuad?cuadrante_id=273&variable=ETR";
  await runPhase([
    ...sectors.flatMap((id) => [`et-lat/serie-et?sector_id=${id}`, `et-lat/et-cult?sector_id=${id}`]),
    ...sectors.map((id) => defaultHistoryPath("et-lat", date, { sector_id: String(id) })),
    ...(Number.isInteger(parcelId) && parcelId > 0 ? [defaultHistoryPath("et-lat", date, { uso_id: String(parcelId) })] : []),
    ...(Number.isInteger(parcelId) && parcelId > 0 ? ["et-poly", ...(session.role === "general_admin" ? ["kc-poly", "lai-poly"] : [])].map((resource) => `et-lat/${resource}?uso_id=${parcelId}`) : []),
    ...(capabilities?.canManageCas ? ["wells/registry"] : []),
    ...(downloads ? [downloadPath] : []),
  ]);
  if (downloads && current()) {
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
  // Follow forum pagination and save every downloaded topic's body/replies.
  // Bound unusually large archives and disclose any remaining online-only pages.
  const forumQueue = paths.filter((path) => path.startsWith("forum/"));
  const discovered = new Set(forumQueue);
  let forumTruncated = false;
  for (let index = 0; index < forumQueue.length && current(); index++) {
    const path = forumQueue[index];
    const data = await savedJson(path);
    const extra: string[] = [];
    if (data?.items) {
      const url = new URL(path, "https://offline.local/");
      const page = Number(url.searchParams.get("page") ?? 1);
      if (page * 20 < data.total) {
        url.searchParams.set("page", String(page + 1));
        extra.push(`${url.pathname.slice(1)}?${url.searchParams}`);
      }
      if (url.pathname === "/forum/threads") {
        for (const thread of data.items) {
          const id = encodeURIComponent(thread.id);
          extra.push(`forum/threads/${id}`, `forum/threads/${id}/posts?page=1&page_size=20`);
        }
      }
    }
    const next = extra.filter((entry) => !discovered.has(entry));
    const allowed = next.slice(0, Math.max(0, 300 - discovered.size));
    if (next.length > allowed.length) forumTruncated = true;
    allowed.forEach((entry) => { discovered.add(entry); forumQueue.push(entry); });
    if (allowed.length) await runPhase(allowed);
  }
  return { entries: [...entries.values()], requiredUrls: [...required], forumTruncated };
}

let saveController: AbortController | undefined;
let inspectionRevision = 0;

async function inspectCopy() {
  const { generation, scope, session } = getOfflineState();
  const revision = ++inspectionRevision;
  const current = () => getOfflineState().generation === generation && inspectionRevision === revision;
  if (!session) return;
  try {
    const exists = await hasOfflineDatabase();
    const { entries, copy } = exists ? await readCopyContents(scope) : { entries: [], copy: undefined };
    const scoped = entries.filter((entry) => entry.scope === scope && Date.now() - entry.savedAt < OFFLINE_MAX_AGE);
    if (!scoped.length) {
      if (current()) updateOfflineState({ copyChecked: true, storageError: false, completed: 0, total: 0, lastSync: null, missingSections: [], forumTruncated: false });
      return false;
    }
    const legacy = new Map(scoped.map((entry) => [entry.url, entry]));
    // Legacy rows can contain several days of opportunistic saves. Resolve the
    // presets as the UI would today, then display the original retained date.
    const plan = copy ?? await planCopy(session, new Date(), async (url) => legacy.get(url), current);
    const status = snapshotCompleteness(scoped, scope, plan.requiredUrls);
    const savedAt = copy?.savedAt ?? status.lastSync ?? Math.min(...scoped.map((entry) => entry.savedAt));
    if (current()) updateOfflineState({
      ...status, copyChecked: true, storageError: false, lastSync: savedAt, total: plan.requiredUrls.length, forumTruncated: plan.forumTruncated,
    });
    return true;
  } catch {
    if (current()) updateOfflineState({ copyChecked: true, storageError: true, lastSync: null });
  }
}

export async function saveOfflineCopy() {
  const { online, session, scope, generation } = getOfflineState();
  if (!online || !session?.idToken || !apiBase || saveController) return;
  const controller = new AbortController();
  saveController = controller;
  const current = () => getOfflineState().generation === generation && !controller.signal.aborted;
  updateOfflineState({ preparing: true, progress: null, storageError: false, saveError: null });

  try {
    const revision = await reserveCopy(scope);
    const hasPreviousCopy = await inspectCopy();
    if (!current()) return;
    if (hasPreviousCopy === undefined) throw new Error("No se pudo leer la copia anterior.");
    const denied = new Set<string>();
    let sessionRejected = false;
    const date = new Date();
    const download = async (url: string) => {
      if (!canSaveResponse(url)) return undefined;
      for (let attempt = 0; attempt < 2 && current() && getOfflineState().online; attempt++) {
        try {
          const response = await fetchLiveResponse(url, { signal: controller.signal }, true);
          if (response.ok) {
            // Read the body before declaring the request complete.
            const body = await response.blob();
            if (new URL(url).pathname === "/api/v1/modis-snow/latest-image") {
              if (!body.size || body.type !== "image/png") throw new Error("La respuesta no contiene una imagen PNG.");
            } else {
              await new Response(body).json();
            }
            return {
              key: responseKey(scope, url), scope, url, body, savedAt: date.getTime(),
              headers: [...response.headers.entries()].filter(([name]) =>
                ["content-type", "x-image-date", "x-image-bounds", "x-image-crs"].includes(name)),
            } satisfies SavedResponse;
          }
          if (response.status === 401) sessionRejected = true;
          if ([403, 404].includes(response.status)) denied.add(url);
          if (response.status < 500) break;
        } catch {
          // Retry transport and interrupted-body failures once while connected.
        }
      }
      return undefined;
    };

    const plan = await planCopy(session, date, download, current, (completed, total) =>
      updateOfflineState({ progress: { completed, total } }));
    if (!current()) return;
    if (sessionRejected) {
      await clearSavedData({ scope, isCurrent: current });
      if (current()) updateOfflineState({ saveError: "La sesión dejó de ser válida. Vuelve a iniciar sesión para guardar una copia." });
      return;
    }
    const partial = plan.entries.length < plan.requiredUrls.length;
    if (hasPreviousCopy && partial) {
      // An authoritative denial must remove an affected old response, even
      // when the rest of the usable copy is kept after a failed replacement.
      for (const url of denied) {
        await invalidateResponses(scope, "", url);
      }
      if (current()) updateOfflineState({ saveError: "No se pudo guardar una copia completa. Se conservaron los datos disponibles de la copia anterior." });
      return;
    }
    if (!plan.entries.length) {
      updateOfflineState({ saveError: "No se pudo guardar la copia. Vuelve a intentarlo con conexión." });
      return;
    }
    const copy: SavedCopy = { scope, savedAt: date.getTime(), requiredUrls: plan.requiredUrls, forumTruncated: plan.forumTruncated };
    const identity = { uid: session.uid, role: session.role, userName: session.userName, permissions: session.permissions, verifiedAt: date.getTime() };
    if (!await commitCopy(identity, copy, plan.entries, revision, current) && current()) {
      updateOfflineState({ saveError: "La copia cambió en otra pestaña. Vuelve a intentarlo." });
    }
  } catch {
    if (current()) updateOfflineState({ saveError: "No se pudo guardar la copia en este navegador." });
  } finally {
    if (saveController === controller) {
      saveController = undefined;
      if (getOfflineState().generation === generation) {
        await inspectCopy();
        if (getOfflineState().generation === generation && !saveController) {
          updateOfflineState({ preparing: false, progress: null });
        }
      }
    }
  }
}

export async function deleteOfflineCopy() {
  saveController?.abort();
  const { generation } = getOfflineState();
  try {
    if (await hasOfflineDatabase()) await clearSavedData();
    if (getOfflineState().generation === generation) {
      updateOfflineState({ saveError: null, storageError: false });
      await inspectCopy();
    }
  } catch {
    if (getOfflineState().generation === generation) updateOfflineState({ saveError: "No se pudo eliminar la copia." });
  }
}

export function useOfflineCopy(enabled: boolean, menuOpen: boolean) {
  const { online, scope } = useOfflineState();
  useEffect(() => {
    if (!enabled || (online && !menuOpen)) return;
    void inspectCopy();
    const changed = () => { void inspectCopy(); };
    const fromOtherTab = (event: StorageEvent) => {
      if (event.key === OFFLINE_COPY_CHANGED) changed();
    };
    window.addEventListener(OFFLINE_COPY_CHANGED, changed);
    window.addEventListener("storage", fromOtherTab);
    document.addEventListener("visibilitychange", changed);
    return () => {
      window.removeEventListener(OFFLINE_COPY_CHANGED, changed);
      window.removeEventListener("storage", fromOtherTab);
      document.removeEventListener("visibilitychange", changed);
    };
  }, [enabled, menuOpen, online, scope]);
}
