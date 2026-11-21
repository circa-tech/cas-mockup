export const OFFLINE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const MAX_BYTES = 50 * 1024 * 1024;
export const OFFLINE_COPY_CHANGED = "cas-offline-cache-changed";
const namespace = `${import.meta.env?.VITE_FIREBASE_PROJECT_ID ?? "demo"}:${import.meta.env?.VITE_API_BASE_URL ?? ""}`;

export type SavedSession = {
  uid: string;
  userName: string;
  role: string;
  permissions: string[];
  verifiedAt: number;
};
export type SavedResponse = {
  key: string;
  scope: string;
  url: string;
  body: Blob;
  headers: [string, string][];
  savedAt: number;
};

export type SavedCopy = {
  scope: string;
  savedAt: number;
  requiredUrls: string[];
  forumTruncated: boolean;
};

const databaseName = `cas-offline-v1:${namespace}`;
const revisionKey = "revision";
const ownerKey = "owner";

let database: Promise<IDBDatabase> | undefined;
function openDatabase() {
  if (!database) {
    database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 2);
      request.onupgradeneeded = ({ oldVersion }) => {
        if (oldVersion === 0) {
          request.result.createObjectStore("sessions", { keyPath: "uid" });
          request.result.createObjectStore("responses", { keyPath: "key" });
        }
        request.result.createObjectStore("copies");
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          database = undefined;
        };
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("El almacenamiento está ocupado en otra pestaña."));
    }).catch((error) => {
      database = undefined;
      throw error;
    });
  }
  return database;
}

async function transaction<T>(
  name: "sessions" | "responses" | "copies",
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(name, mode);
    const request = action(tx.objectStore(name));
    // A successful request is not sufficient: the transaction must commit.
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error("No se pudieron guardar los datos."));
  });
}

export async function readSavedSession(uid: string): Promise<SavedSession | undefined> {
  const session = await transaction<SavedSession | undefined>("sessions", "readonly", (store) => store.get(uid));
  return session && Date.now() - session.verifiedAt < OFFLINE_MAX_AGE ? session : undefined;
}
export const saveSession = ({ uid, userName, role, permissions, verifiedAt }: SavedSession) =>
  transaction("sessions", "readwrite", (store) => store.put({ uid, userName, role, permissions, verifiedAt }));

export const responseKey = (scope: string, url: string) => JSON.stringify([scope, url]);
export async function readResponse(scope: string, url: string) {
  const response = await transaction<SavedResponse | undefined>("responses", "readonly", (store) =>
    store.get(responseKey(scope, url)));
  return response && Date.now() - response.savedAt < OFFLINE_MAX_AGE ? response : undefined;
}
export const listResponses = () =>
  transaction<SavedResponse[]>("responses", "readonly", (store) => store.getAll());
function notifyCacheChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent?.(new Event(OFFLINE_COPY_CHANGED));
    try { window.localStorage.setItem(OFFLINE_COPY_CHANGED, crypto.randomUUID()); }
    catch { /* IndexedDB commit is independent of the cross-tab notification. */ }
  }
}
export async function saveResponse(response: SavedResponse, isCurrent = () => true) {
  if (response.body.size > MAX_BYTES) throw new Error("Los datos exceden el espacio disponible sin conexión.");
  const db = await openDatabase();
  if (!isCurrent()) throw new DOMException("La sesión cambió.", "AbortError");
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("responses", "readwrite");
    const store = tx.objectStore("responses");
    const request = store.getAll();
    request.onsuccess = () => {
      let bytes = response.body.size;
      const existing = (request.result as SavedResponse[])
        .filter((item) => item.key !== response.key)
        .sort((a, b) => b.savedAt - a.savedAt);
      for (const item of existing) {
        bytes += item.body.size;
        if (Date.now() - item.savedAt >= OFFLINE_MAX_AGE || bytes > MAX_BYTES) {
          store.delete(item.key);
          bytes -= item.body.size;
        }
      }
      store.put(response);
    };
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error("No hay espacio para guardar datos sin conexión."));
  });
  notifyCacheChange();
}

export const copyRevision = () =>
  transaction<number | undefined>("copies", "readonly", (store) => store.get(revisionKey));

export async function readCopy(scope: string): Promise<SavedCopy | undefined> {
  return transaction<SavedCopy | undefined>("copies", "readonly", (store) => store.get(scope));
}

export function readCopyContents(scope: string) {
  return openDatabase().then((db) => new Promise<{
    entries: SavedResponse[];
    copy: SavedCopy | undefined;
  }>((resolve, reject) => {
    const tx = db.transaction(["responses", "copies"], "readonly");
    const responses = tx.objectStore("responses").getAll();
    const manifest = tx.objectStore("copies").get(scope);
    tx.oncomplete = () => resolve({ entries: responses.result, copy: manifest.result });
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error("No se pudo leer la copia."));
  }));
}

function copyTransaction<T>(
  action: (tx: IDBTransaction, revision: number | undefined) => T,
): Promise<T> {
  return openDatabase().then((db) => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(["sessions", "responses", "copies"], "readwrite");
    const request = tx.objectStore("copies").get(revisionKey);
    let result: T;
    request.onsuccess = () => { result = action(tx, request.result); };
    tx.oncomplete = () => resolve(result);
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error("No se pudo guardar la copia."));
  }));
}

export function reserveCopy(scope: string) {
  return copyTransaction((tx, revision) => {
    const copies = tx.objectStore("copies");
    const next = (revision ?? 0) + 1;
    copies.put(next, revisionKey);
    copies.put(scope, ownerKey);
    return next;
  });
}

export async function commitCopy(
  session: SavedSession,
  copy: SavedCopy,
  entries: SavedResponse[],
  expectedRevision: number | undefined,
  isCurrent: () => boolean,
) {
  if (entries.reduce((total, entry) => total + entry.body.size, 0) > MAX_BYTES) {
    throw new Error("Los datos exceden el espacio disponible sin conexión.");
  }
  const committed = await copyTransaction((tx, revision) => {
    if (revision !== expectedRevision || !isCurrent()) return false;
    // Private copies belong to one identity on this device. Replace the rows and
    // manifest in the same transaction so a failed commit preserves the old copy.
    const sessions = tx.objectStore("sessions");
    const responses = tx.objectStore("responses");
    const copies = tx.objectStore("copies");
    sessions.clear();
    responses.clear();
    copies.clear();
    sessions.put(session);
    entries.forEach((entry) => responses.put(entry));
    copies.put(copy, copy.scope);
    copies.put(copy.scope, ownerKey);
    copies.put((revision ?? 0) + 1, revisionKey);
    return true;
  });
  if (committed) notifyCacheChange();
  return committed;
}

export async function clearSavedData({
  scope,
  isCurrent = () => true,
}: { scope?: string; isCurrent?: () => boolean } = {}) {
  let cleared = false;
  await copyTransaction((tx, revision) => {
    const copies = tx.objectStore("copies");
    const owner = copies.get(ownerKey);
    owner.onsuccess = () => {
      if (!isCurrent() || (scope && owner.result && scope !== owner.result)) return;
      tx.objectStore("sessions").clear();
      tx.objectStore("responses").clear();
      copies.clear();
      copies.put((revision ?? 0) + 1, revisionKey);
      cleared = true;
    };
  });
  if (cleared) notifyCacheChange();
}

function savedResource(url: string) {
  const resource = new URL(url);
  if (/^\/api\/v1\/(et-lat|modis-snow)\/history$/.test(resource.pathname)) {
    // Reject a stored rolling preset for the same series as the denied request.
    resource.searchParams.delete("start_date");
    resource.searchParams.delete("end_date");
  }
  return resource.href;
}

export async function invalidateResponses(scope: string, path: string, url?: string) {
  // A new visitor with healthy online access should never create an offline DB.
  if (!await hasOfflineDatabase()) return;
  let changed = false;
  const identity = url ? savedResource(url) : undefined;
  await copyTransaction((tx, revision) => {
    const responses = tx.objectStore("responses");
    // Bump even if a pending replacement has yet to commit this resource.
    tx.objectStore("copies").put((revision ?? 0) + 1, revisionKey);
    const request = responses.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const entry: SavedResponse = cursor.value;
      if (entry.scope === scope && (identity ? savedResource(entry.url) === identity : new URL(entry.url).pathname.startsWith(path))) {
        cursor.delete();
        changed = true;
      }
      cursor.continue();
    };
  });
  if (changed) notifyCacheChange();
}

export async function hasOfflineDatabase() {
  if (database) return true;
  if (typeof indexedDB === "undefined") return false;
  if (!indexedDB.databases) return true;
  return (await indexedDB.databases()).some((entry) => entry.name === databaseName);
}

export async function reconcileSavedIdentity(uid: string, scope: string, isCurrent: () => boolean) {
  if (!await hasOfflineDatabase()) return;
  let changed = false;
  await copyTransaction((tx, revision) => {
    const sessions = tx.objectStore("sessions");
    const copies = tx.objectStore("copies");
    const owner = copies.get(ownerKey);
    const request = sessions.getAll();
    request.onsuccess = () => {
      if (!isCurrent()) return;
      const previous = request.result as SavedSession[];
      if ((!owner.result || owner.result === scope) && previous.every((session) => session.uid === uid &&
        JSON.stringify([session.uid, session.role, [...session.permissions].sort()]) === scope)) return;
      changed = true;
      sessions.clear();
      tx.objectStore("responses").clear();
      copies.clear();
      copies.put((revision ?? 0) + 1, revisionKey);
    };
  });
  if (changed) notifyCacheChange();
}
