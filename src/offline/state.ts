import { useSyncExternalStore } from "react";
import type { SavedSession } from "./storage";

export function sessionScope(session: Pick<SavedSession, "uid" | "role" | "permissions">) {
  return JSON.stringify([session.uid, session.role, [...session.permissions].sort()]);
}

type OfflineState = {
  online: boolean;
  session: (SavedSession & { idToken: string | null }) | null;
  scope: string;
  generation: number;
  networkUnavailable: boolean;
  storageError: boolean;
  shellReady: boolean;
  preparing: boolean;
  completed: number;
  total: number;
  requiredUrls: string[];
  lastSync: number | null;
};
let state: OfflineState = {
  online: typeof navigator === "undefined" || navigator.onLine,
  session: null,
  scope: "anonymous",
  generation: 0,
  networkUnavailable: false,
  storageError: false,
  shellReady: false,
  preparing: false,
  completed: 0,
  total: 0,
  requiredUrls: [],
  lastSync: null,
};
const listeners = new Set<() => void>();
export const getOfflineState = () => state;
export function updateOfflineState(update: Partial<OfflineState>) {
  state = { ...state, ...update };
  listeners.forEach((listener) => listener());
}
export function setOfflineSession(session: OfflineState["session"]) {
  const scope = session ? sessionScope(session) : "anonymous";
  const changed = state.scope !== scope;
  updateOfflineState({
    session,
    scope,
    ...(changed ? { generation: state.generation + 1, completed: 0, total: 0, requiredUrls: [], lastSync: null, preparing: false, storageError: false } : {}),
  });
}
export function useOfflineState() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, getOfflineState);
}
export const isReadOnly = () => {
  const current = getOfflineState();
  return !current.online || current.networkUnavailable || !current.session?.idToken;
};

if (typeof window !== "undefined") {
  window.addEventListener("offline", () => updateOfflineState({ online: false }));
  window.addEventListener("online", () => updateOfflineState({ online: true, networkUnavailable: false }));
}
