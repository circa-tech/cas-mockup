import { useEffect, useRef, useState } from "react";
import { queryClient } from "../lib/queryClient";
import { clearSavedData, readSavedSession, saveSession } from "../offline/storage";
import { getOfflineState, sessionScope, setOfflineSession, updateOfflineState } from "../offline/state";
import {
  isFirebaseConfigured,
  signInWithEmailPassword,
  signInWithGoogle,
  signOutFromGoogle,
  subscribeToAuthSession,
  type AuthSession,
} from "../services/firebaseAuth";

const authStorageKey = "cas_mockup_is_logged_in";
const authUserStorageKey = "cas_mockup_user_name";
const defaultAuthUserName = "Camila Rojas";

const readStoredValue = (key: string, fallback: string) => {
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    return window.localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};

export function useAuthSession() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => !isFirebaseConfigured && readStoredValue(authStorageKey, "true") === "true",
  );
  const [authUserName, setAuthUserName] = useState(() =>
    readStoredValue(authUserStorageKey, defaultAuthUserName),
  );
  const [authIdToken, setAuthIdToken] = useState<string | null>(null);
  const [authPermissions, setAuthPermissions] = useState<string[]>([]);
  const [authRole, setAuthRole] = useState("public_user");
  const [authUid, setAuthUid] = useState<string | null>(null);
  const previousAuthUid = useRef<string | null>(null);
  const transition = useRef(0);
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured);

  const applySession = async (session: AuthSession) => {
    const revision = ++transition.current;
    const credentialChanged = getOfflineState().session?.idToken !== session.idToken;
    const saved = session.uid ? {
      uid: session.uid, role: session.role, permissions: session.permissions,
      userName: session.userName, verifiedAt: session.verifiedAt ?? Date.now(),
    } : null;
    const previous = session.uid ? await readSavedSession(session.uid).catch(() => undefined) : undefined;
    if (revision !== transition.current) return;
    const scopeChanged = getOfflineState().scope !== (saved ? sessionScope(saved) : "anonymous");
    if (scopeChanged || !session.uid) {
      setAuthReady(false);
      setOfflineSession(null);
      await queryClient.cancelQueries();
      queryClient.clear();
    }
    if (revision !== transition.current) return;
    if (!session.uid || (previousAuthUid.current && previousAuthUid.current !== session.uid) ||
      (previous && saved && sessionScope(previous) !== sessionScope(saved))) {
      await clearSavedData().catch(() => updateOfflineState({ storageError: true }));
      try { window.localStorage.removeItem("cas_weather_stations_snapshot"); } catch { /* Legacy cache cleanup is best-effort. */ }
    }
    if (revision !== transition.current) return;
    setOfflineSession(saved ? { ...saved, idToken: session.idToken } : null);
    if (saved && session.idToken && navigator.onLine) {
      await saveSession(saved).catch(() => updateOfflineState({ storageError: true }));
    }
    if (revision !== transition.current) return;
    previousAuthUid.current = session.uid;
    setIsLoggedIn(session.isLoggedIn);
    setAuthUserName(
      session.userName.trim().length > 0 ? session.userName : defaultAuthUserName,
    );
    setAuthIdToken(session.idToken);
    setAuthPermissions(session.permissions);
    setAuthRole(session.role);
    setAuthUid(session.uid);
    setAuthReady(true);
    if (session.idToken && credentialChanged) void queryClient.invalidateQueries();
  };

  useEffect(() => {
    if (!isFirebaseConfigured) {
      return undefined;
    }
    return subscribeToAuthSession((session) => { void applySession(session); });
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(authStorageKey, isLoggedIn ? "true" : "false");
      window.localStorage.setItem(authUserStorageKey, authUserName);
    } catch {
      // Persistence is optional in mockup mode.
    }
  }, [authUserName, isLoggedIn]);

  const loginWithGoogle = async () => applySession(await signInWithGoogle());
  const loginWithEmailPassword = async (email: string, password: string) =>
    applySession(await signInWithEmailPassword(email, password));
  const logout = async () => {
    await signOutFromGoogle();
    await applySession({
      idToken: null,
      isConfigured: isFirebaseConfigured,
      isLoggedIn: false,
      permissions: [],
      role: "public_user",
      uid: null,
      userName: defaultAuthUserName,
    });
    queryClient.clear();
  };

  return {
    authIdToken,
    authReady,
    authPermissions,
    authRole,
    authUid,
    authUserName,
    isLoggedIn,
    loginWithEmailPassword,
    loginWithGoogle,
    logout,
  };
}
