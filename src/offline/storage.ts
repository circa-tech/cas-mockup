export const OFFLINE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const MAX_BYTES = 50 * 1024 * 1024;
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

let database: Promise<IDBDatabase> | undefined;
function openDatabase() {
  if (!database) {
    database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(`cas-offline-v1:${namespace}`, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("sessions", { keyPath: "uid" });
        request.result.createObjectStore("responses", { keyPath: "key" });
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
  name: "sessions" | "responses",
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
  if (typeof window !== "undefined") window.dispatchEvent?.(new Event("cas-offline-cache-changed"));
}
export const deleteResponse = async (key: string) => {
  await transaction("responses", "readwrite", (store) => store.delete(key));
  notifyCacheChange();
};

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

export async function clearSavedData() {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["sessions", "responses"], "readwrite");
    tx.objectStore("sessions").clear();
    tx.objectStore("responses").clear();
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error);
  });
}

export async function invalidateResponses(scope: string, pathPrefix: string) {
  const entries = await listResponses();
  await Promise.all(entries.filter((entry) => entry.scope === scope && new URL(entry.url).pathname.startsWith(pathPrefix))
    .map((entry) => deleteResponse(entry.key)));
}
