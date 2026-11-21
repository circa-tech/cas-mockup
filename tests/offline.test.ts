import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test, mock } from "node:test";
import { apiFetch, canSaveResponse, OfflineDataUnavailableError } from "../src/offline/apiFetch.ts";
import { clearSavedData, listResponses, OFFLINE_MAX_AGE, readSavedSession, saveSession, saveResponse, responseKey, commitCopy, copyRevision, readCopy, reserveCopy, reconcileSavedIdentity } from "../src/offline/storage.ts";
import { getOfflineState, setOfflineSession, updateOfflineState } from "../src/offline/state.ts";
import { queryClient, authQueryScope } from "../src/lib/queryClient.ts";
import { snapshotCompleteness } from "../src/offline/completeness.ts";
import { mapSnapshotToStations } from "../src/services/weatherStationsApi.ts";

const url = "https://example.test/api/v1/weather-stations/snapshot";
const session = { uid: "alice", userName: "Alice", role: "cas_user", permissions: ["wells:read"], verifiedAt: Date.now(), idToken: "first-token" };
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;

async function seed(url: string, response: Response) {
  const { scope } = getOfflineState();
  return saveResponse({
    key: responseKey(scope, url), url, scope, body: await response.blob(),
    savedAt: Date.now(), headers: [...response.headers],
  });
}

beforeEach(async () => {
  Object.assign(globalThis, { window: { location: { origin: "https://example.test" }, setTimeout } });
  await clearSavedData();
  queryClient.clear();
  setOfflineSession(null);
  setOfflineSession(session);
  updateOfflineState({ online: true, storageError: false });
});
afterEach(() => {
  mock.restoreAll();
  Object.assign(globalThis, { fetch: originalFetch, window: originalWindow });
});

test("saved data survives memory cache loss and is readable without a token or network", async () => {
  const fetch = mock.fn(async () => Response.json({ stations: ["Copiapó"] }));
  globalThis.fetch = fetch;
  await seed(url, await apiFetch(url));
  queryClient.clear();
  setOfflineSession({ ...session, idToken: null });
  updateOfflineState({ online: false });
  assert.deepEqual(await (await apiFetch(url)).json(), { stations: ["Copiapó"] });
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal((await listResponses())[0].headers.some(([name]) => name === "authorization"), false);
  await saveSession(session);
  assert.equal("idToken" in (await readSavedSession(session.uid))!, false);
});

test("token refresh preserves scope; other users and changed permissions cannot read the snapshot", async () => {
  globalThis.fetch = async () => Response.json({ secret: "alice" });
  await seed(url, await apiFetch(url));
  const original = authQueryScope("first-token");
  setOfflineSession({ ...session, idToken: "refreshed-token" });
  assert.equal(authQueryScope("refreshed-token"), original);
  updateOfflineState({ online: false });
  setOfflineSession({ ...session, uid: "bob", idToken: null });
  await assert.rejects(apiFetch(url), OfflineDataUnavailableError);
  setOfflineSession({ ...session, permissions: [], idToken: null });
  await assert.rejects(apiFetch(url), OfflineDataUnavailableError);
});

test("binary image bytes and georeferencing survive offline reads", async () => {
  const imageUrl = "https://example.test/api/v1/modis-snow/latest-image";
  globalThis.fetch = async () => new Response(new Uint8Array([137, 80, 78, 71]), {
    headers: { "Content-Type": "image/png", "X-Image-Bounds": '{"south":-29,"north":-27,"west":-71,"east":-69}' },
  });
  await seed(imageUrl, await apiFetch(imageUrl));
  updateOfflineState({ online: false });
  const saved = await apiFetch(imageUrl);
  assert.deepEqual([...new Uint8Array(await saved.arrayBuffer())], [137, 80, 78, 71]);
  assert.match(saved.headers.get("X-Image-Bounds")!, /"south":-29/);
});

test("live requests never use the saved copy even for a transport failure or 5xx", async () => {
  await seed(url, Response.json({ value: 1 }, { headers: { ETag: "previous-copy" } }));
  globalThis.fetch = async (_input, init) => {
    assert.equal(new Headers(init?.headers).has("If-None-Match"), false);
    assert.equal(init?.cache, "no-store");
    return Response.json({ value: 2 });
  };
  assert.deepEqual(await (await apiFetch(url)).json(), { value: 2 });
  globalThis.fetch = async () => { throw new TypeError("Network failed"); };
  await assert.rejects(apiFetch(url), /Network failed/);
  globalThis.fetch = async () => new Response(null, { status: 503 });
  assert.equal((await apiFetch(url)).status, 503);
  updateOfflineState({ online: false });
  assert.deepEqual(await (await apiFetch(url)).json(), { value: 1 });
  updateOfflineState({ online: true });
  globalThis.fetch = async () => new Response("Denied", { status: 403 });
  assert.equal((await apiFetch(url)).status, 403);
  updateOfflineState({ online: false });
  await assert.rejects(apiFetch(url), OfflineDataUnavailableError);
});

test("offline mutations are blocked and never replayed on reconnect", async () => {
  const fetch = mock.fn(async () => new Response(null));
  globalThis.fetch = fetch;
  updateOfflineState({ online: false });
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    await assert.rejects(apiFetch(url, { method }), /Necesitas conexión/);
  }
  updateOfflineState({ online: true });
  assert.equal(fetch.mock.callCount(), 0);
});

test("a request finishing after logout cannot persist the previous user's data", async () => {
  let finish!: (value: Response) => void;
  let started!: () => void;
  const start = new Promise<void>((resolve) => { started = resolve; });
  globalThis.fetch = async () => { started(); return new Promise<Response>((resolve) => { finish = resolve; }); };
  const pending = apiFetch(url);
  await start;
  setOfflineSession(null);
  await clearSavedData();
  finish(Response.json({ secret: "old account" }));
  await assert.rejects(pending, { name: "AbortError" });
  assert.deepEqual(await listResponses(), []);
});

test("concurrent foreground reads share a request with independently readable bodies", async () => {
  const fetch = mock.fn(async () => Response.json({ value: 1 }));
  globalThis.fetch = fetch;
  const responses = await Promise.all([apiFetch(url), apiFetch(url)]);
  assert.deepEqual(await responses[0].json(), { value: 1 });
  assert.deepEqual(await responses[1].json(), { value: 1 });
  assert.equal(fetch.mock.callCount(), 1);
});

test("online data stays usable when IndexedDB transactions fail", async () => {
  globalThis.fetch = async () => Response.json({ stations: [] });
  const original = IDBObjectStore.prototype.put;
  mock.method(IDBObjectStore.prototype, "put", function (this: IDBObjectStore, ...args: Parameters<typeof original>) {
    if (this.name === "responses") {
      this.transaction.abort();
      return {} as IDBRequest<IDBValidKey>;
    }
    return original.apply(this, args);
  });
  assert.deepEqual(await (await apiFetch(url)).json(), { stations: [] });
  assert.equal(getOfflineState().storageError, false);
  assert.deepEqual(await listResponses(), []);
});

test("online changes invalidate saved responses so stale data cannot reappear offline", async () => {
  const wells = "https://example.test/api/v1/wells/groundwater-measurements";
  globalThis.fetch = async (_input, init) => init?.method === "POST"
    ? new Response(null, { status: 204 }) : Response.json([]);
  await seed(wells, await apiFetch(wells));
  await apiFetch("https://example.test/api/v1/wells/measurements", { method: "POST" });
  updateOfflineState({ online: false });
  await assert.rejects(apiFetch(wells), OfflineDataUnavailableError);
});

test("registering a recorder keeps saved well measurements and never saves the directory", async () => {
  const wells = "https://example.test/api/v1/wells/groundwater-measurements";
  const directory = "https://example.test/api/v1/wells/measurement-recorders";
  globalThis.fetch = async () => Response.json([]);
  await seed(wells, await apiFetch(wells));
  await apiFetch(directory);
  await apiFetch(directory, { method: "POST" });
  globalThis.fetch = async () => new Response(null, { status: 403 });
  assert.equal((await apiFetch(directory)).status, 403);
  assert.equal((await apiFetch(directory, { method: "POST" })).status, 403);
  assert.equal((await listResponses()).length, 1);
  updateOfflineState({ online: false });
  assert.deepEqual(await (await apiFetch(wells)).json(), []);
  await assert.rejects(apiFetch(directory), OfflineDataUnavailableError);
});

test("saved responses and offline sessions expire after seven days", async () => {
  globalThis.fetch = async () => Response.json({ value: 1 });
  await saveSession(session);
  await seed(url, await apiFetch(url));
  const now = Date.now();
  mock.method(Date, "now", () => now + OFFLINE_MAX_AGE + 1);
  updateOfflineState({ online: false });
  await assert.rejects(apiFetch(url), OfflineDataUnavailableError);
  assert.equal(await readSavedSession(session.uid), undefined);
});

test("user administration and generated files are excluded from persistence", () => {
  for (const path of ["admin/users", "wells/cas-users", "wells/123/writers", "et-lat/down-cuad", "et-lat/down-cuad-image"]) {
    assert.equal(canSaveResponse(`https://example.test/api/v1/${path}`), false);
  }
});

test("incomplete copies identify missing sections and ignore another account's responses", async () => {
  globalThis.fetch = async () => Response.json({ stations: [] });
  await seed(url, await apiFetch(url));
  const forum = "https://example.test/api/v1/forum/threads?page=1&page_size=20";
  const status = snapshotCompleteness(await listResponses(), getOfflineState().scope, [url, forum]);
  assert.equal(status.completed, 1);
  assert.deepEqual(status.missingSections, ["Foro"]);
  assert.deepEqual(snapshotCompleteness(await listResponses(), "another user", [url]).missingSections, ["Clima"]);
});

test("a clear invalidates an older save revision even when no previous rows were stored", async () => {
  const { scope } = getOfflineState();
  const revision = await copyRevision();
  await clearSavedData();
  const savedAt = Date.now();
  const entry = { key: responseKey(scope, url), scope, url, body: new Blob(["{}"]), headers: [] as [string, string][], savedAt };
  assert.equal(await commitCopy(session, { scope, savedAt, requiredUrls: [url], forumTruncated: false }, [entry], revision, () => true), false);
  assert.deepEqual(await listResponses(), []);
  assert.equal(await readCopy(scope), undefined);
});

test("another identity invalidates a first save reservation before any session row exists", async () => {
  const { scope } = getOfflineState();
  const revision = await reserveCopy(scope);
  assert.equal(await readSavedSession(session.uid), undefined);
  await reconcileSavedIdentity("bob", JSON.stringify(["bob", "cas_user", []]), () => true);
  const savedAt = Date.now();
  const entry = { key: responseKey(scope, url), scope, url, body: new Blob(["{}"]), headers: [] as [string, string][], savedAt };
  assert.equal(await commitCopy(session, { scope, savedAt, requiredUrls: [url], forumTruncated: false }, [entry], revision, () => true), false);
  assert.deepEqual(await listResponses(), []);
});

test("a failed replacement transaction leaves the previous version and date intact", async () => {
  const { scope } = getOfflineState();
  const savedAt = Date.now();
  const entry = { key: responseKey(scope, url), scope, url, body: new Blob(["original"]), headers: [] as [string, string][], savedAt };
  const copy = { scope, savedAt, requiredUrls: [url], forumTruncated: false };
  assert.equal(await commitCopy(session, copy, [entry], await copyRevision(), () => true), true);
  const original = IDBObjectStore.prototype.put;
  mock.method(IDBObjectStore.prototype, "put", function (this: IDBObjectStore, ...args: Parameters<typeof original>) {
    if (this.name === "responses") {
      const writing = original.apply(this, args);
      writing.onsuccess = () => this.transaction.abort();
      return writing;
    }
    return original.apply(this, args);
  });
  const current = await copyRevision();
  await assert.rejects(commitCopy(session, { ...copy, savedAt: savedAt + 1 }, [entry], current, () => true));
  assert.equal(await (await listResponses())[0].body.text(), "original");
  assert.deepEqual(await readCopy(scope), copy);
});

test("partial weather readings retain the station without fabricating missing measurements", () => {
  const stations = mapSnapshotToStations({ generatedAt: "2026-10-10", stations: [{
    id: "s1",
    name: "Copiapó",
    lat: -27.3,
    lng: -70.3,
    lastUpdate: "2026-10-09",
    temperatureValue: 23,
    measurements: [{
      measurementName: "Air Temperature",
      portNumber: 1,
      recordedAt: "2026-10-09T12:00:00Z",
      sensorName: "ATMOS 41",
      unit: "°C",
      value: 23,
    }],
  }] });
  assert.equal(stations.length, 2);
  assert.equal(stations[1].id, "zentra-z6-05550");
  assert.equal(stations[1].temperatureValue, null);
  assert.equal(stations[0].temperatureValue, 23);
  assert.deepEqual(stations[0].measurements.map((measurement) => measurement.measurementName), ["Air Temperature"]);
});
