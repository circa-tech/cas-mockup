import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { canonicalUrl, OfflineDataUnavailableError } from "../src/offline/apiFetch.ts";
import { snapshotCompleteness } from "../src/offline/completeness.ts";
import { fetchHistoryResponse, findSavedHistoryPreset } from "../src/offline/history.ts";
import { getOfflineState, setOfflineSession, updateOfflineState } from "../src/offline/state.ts";
import { clearSavedData, listResponses, OFFLINE_MAX_AGE, responseKey, saveResponse, type SavedResponse } from "../src/offline/storage.ts";
import { historyPreset, type HistoryPreset } from "../src/utils/history.ts";

const now = Date.now();
const yesterday = new Date(now - 24 * 60 * 60 * 1000);
const session = { uid: "alice", userName: "Alice", role: "cas_user", permissions: [], verifiedAt: now, idToken: "test-token" };
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const historyUrl = (preset: HistoryPreset, day: Date, selection = { sector_id: "19" }) => canonicalUrl(
  `https://example.test/api/v1/et-lat/history?${new URLSearchParams({ ...selection, ...historyPreset(preset, day), resolution: "auto", max_points: "1200" })}`,
);
const entry = (url: string, changes: Partial<SavedResponse> = {}): SavedResponse => {
  const scope = getOfflineState().scope;
  const params = new URL(url).searchParams;
  return { key: responseKey(scope, url), scope, url, savedAt: yesterday.getTime(), headers: [["content-type", "application/json"]],
    body: new Blob([JSON.stringify({ start_date: params.get("start_date"), end_date: params.get("end_date"), points: [] })]), ...changes };
};

beforeEach(async () => {
  Object.assign(globalThis, { window: { location: { origin: "https://example.test" }, setTimeout } });
  await clearSavedData();
  setOfflineSession(null);
  setOfflineSession(session);
  updateOfflineState({ online: false, networkUnavailable: false, storageError: false });
});
afterEach(() => Object.assign(globalThis, { fetch: originalFetch, window: originalWindow }));

test("each moving preset restores its latest saved dates after a day change", () => {
  const scope = getOfflineState().scope;
  for (const preset of [1, 2, "all"] as const) {
    const saved = entry(historyUrl(preset, yesterday));
    const older = entry(historyUrl(preset, new Date(now - 2 * 24 * 60 * 60 * 1000)), { savedAt: now });
    assert.equal(findSavedHistoryPreset([older, saved], scope, historyUrl(preset, new Date(now)), preset, now), saved);
  }
  const saved = entry(historyUrl(1, yesterday));
  const status = snapshotCompleteness([saved], scope, [historyUrl(1, new Date(now))]);
  assert.equal(status.completed, 1);
  assert.equal(status.lastSync, saved.savedAt);
  assert.deepEqual(status.missingSections, []);
});

test("preset lookup isolates accounts, API hosts, series, resolution, dates and expiry", () => {
  const scope = getOfflineState().scope;
  const requested = historyUrl(1, new Date(now));
  const savedUrl = historyUrl(1, yesterday);
  const others = [
    entry(savedUrl, { scope: "another-account" }),
    entry(savedUrl, { savedAt: now - OFFLINE_MAX_AGE }),
    entry(savedUrl.replace("example.test", "other.test")),
    entry(savedUrl.replace("sector_id=19", "sector_id=20")),
    entry(savedUrl.replace("sector_id=19", "uso_id=19")),
    entry(savedUrl.replace("et-lat/history", "modis-snow/history")),
    entry(savedUrl.replace("resolution=auto", "resolution=monthly")),
    entry(savedUrl.replace("max_points=1200", "max_points=100")),
    entry(historyUrl(2, yesterday)),
    entry(historyUrl(1, new Date(now + 24 * 60 * 60 * 1000))),
  ];
  assert.equal(findSavedHistoryPreset(others, scope, requested, 1, now), undefined);
  assert.equal(snapshotCompleteness(others, scope, [requested]).completed, 0);
  const custom = new URL(requested);
  custom.searchParams.set("start_date", "2022-01-01");
  assert.equal(findSavedHistoryPreset([entry(savedUrl)], scope, custom.href, 1, now), undefined);
});

test("offline fetch preserves saved bounds without aliasing them to today or custom requests", async () => {
  const saved = entry(historyUrl(1, yesterday));
  await saveResponse(saved);
  const requested = historyUrl(1, new Date(now));
  globalThis.fetch = async () => { throw new Error("No network request expected offline"); };
  const data = await (await fetchHistoryResponse(requested, {}, 1)).json();
  assert.equal(data.end_date, yesterday.toISOString().slice(0, 10));
  await assert.rejects(fetchHistoryResponse(requested, {}), OfflineDataUnavailableError);
  assert.deepEqual((await listResponses()).map((item) => item.url), [saved.url]);
  setOfflineSession({ ...session, uid: "bob", idToken: null });
  await assert.rejects(fetchHistoryResponse(requested, {}, 1), OfflineDataUnavailableError);
});

test("transport failures allow preset fallback, reconnect fetches today, and denials are never masked", async () => {
  await saveResponse(entry(historyUrl(1, yesterday)));
  const requested = historyUrl(1, new Date(now));
  updateOfflineState({ online: true });
  globalThis.fetch = async () => { throw new TypeError("Network unavailable"); };
  assert.equal((await (await fetchHistoryResponse(requested, {}, 1)).json()).end_date, yesterday.toISOString().slice(0, 10));
  for (const status of [401, 403, 404]) {
    globalThis.fetch = async () => new Response(null, { status });
    assert.equal((await fetchHistoryResponse(requested, {}, 1)).status, status);
  }
  globalThis.fetch = async (input) => {
    assert.equal(String(input), requested);
    return Response.json(historyPreset(1, new Date(now)));
  };
  assert.equal((await (await fetchHistoryResponse(requested, {}, 1)).json()).end_date, new Date(now).toISOString().slice(0, 10));
});
