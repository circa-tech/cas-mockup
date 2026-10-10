import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test, mock } from "node:test";
import { apiFetch, canSaveResponse, OfflineDataUnavailableError } from "../src/offline/apiFetch.ts";
import { clearSavedData, listResponses, OFFLINE_MAX_AGE, readSavedSession, saveSession } from "../src/offline/storage.ts";
import { getOfflineState, setOfflineSession, updateOfflineState } from "../src/offline/state.ts";
import { queryClient, authQueryScope } from "../src/lib/queryClient.ts";

const url = "https://example.test/api/v1/weather-stations/snapshot";
const session = { uid: "alice", userName: "Alice", role: "cas_user", permissions: ["wells:read"], verifiedAt: Date.now(), idToken: "first-token" };
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;

beforeEach(async () => {
  Object.assign(globalThis, { window: { location: { origin: "https://example.test" }, setTimeout } });
  await clearSavedData();
  queryClient.clear();
  setOfflineSession(null);
  setOfflineSession(session);
  updateOfflineState({ online: true, networkUnavailable: false, storageError: false });
});
afterEach(() => {
  mock.restoreAll();
  Object.assign(globalThis, { fetch: originalFetch, window: originalWindow });
});

test("saved data survives memory cache loss and is readable without a token or network", async () => {
  const fetch = mock.fn(async () => Response.json({ stations: ["Copiapó"] }));
  globalThis.fetch = fetch;
  await apiFetch(url);
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
  await apiFetch(url);
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
  await apiFetch(imageUrl);
  updateOfflineState({ online: false });
  const saved = await apiFetch(imageUrl);
  assert.deepEqual([...new Uint8Array(await saved.arrayBuffer())], [137, 80, 78, 71]);
  assert.match(saved.headers.get("X-Image-Bounds")!, /"south":-29/);
});

test("transport failures use saved data but permission denials remove it", async () => {
  globalThis.fetch = async () => Response.json({ value: 1 });
  await apiFetch(url);
  globalThis.fetch = async () => { throw new TypeError("Network failed"); };
  assert.deepEqual(await (await apiFetch(url, { cache: "reload" })).json(), { value: 1 });
  globalThis.fetch = async () => new Response("Denied", { status: 403 });
  assert.equal((await apiFetch(url, { cache: "reload" })).status, 403);
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

test("a connection lost while reading the response body retains the saved snapshot", async () => {
  globalThis.fetch = async () => Response.json({ value: "saved" });
  await apiFetch(url);
  globalThis.fetch = async () => new Response(new ReadableStream({
    start(controller) { controller.error(new TypeError("Connection lost during download")); },
  }));
  assert.deepEqual(await (await apiFetch(url, { cache: "reload" })).json(), { value: "saved" });
  assert.equal(getOfflineState().networkUnavailable, true);
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

test("concurrent background and foreground reads share a request with independently readable bodies", async () => {
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
  assert.equal(getOfflineState().storageError, true);
  assert.deepEqual(await listResponses(), []);
});

test("online changes invalidate saved responses so stale data cannot reappear offline", async () => {
  const wells = "https://example.test/api/v1/wells/groundwater-measurements";
  globalThis.fetch = async (_input, init) => init?.method === "POST"
    ? new Response(null, { status: 204 }) : Response.json([]);
  await apiFetch(wells);
  await apiFetch("https://example.test/api/v1/wells/measurements", { method: "POST" });
  updateOfflineState({ online: false });
  await assert.rejects(apiFetch(wells), OfflineDataUnavailableError);
});

test("saved responses and offline sessions expire after seven days", async () => {
  globalThis.fetch = async () => Response.json({ value: 1 });
  await saveSession(session);
  await apiFetch(url);
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
