import { useEffect, useRef, useState } from "react";
import { queryClient } from "../lib/queryClient";
import { clearSavedData, hasOfflineDatabase, reconcileSavedIdentity } from "../offline/storage";
import { getOfflineState, sessionScope, setOfflineSession } from "../offline/state";
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
  const transition = useRef(0);
  const copyCleanup = useRef<Promise<void>>();

  const clearExistingCopy = () => {
    copyCleanup.current ??= hasOfflineDatabase().then(async (exists) => {
      if (exists) await clearSavedData();
    }).catch(() => undefined).finally(() => { copyCleanup.current = undefined; });
    return copyCleanup.current;
  };
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured);

  const applySession = async (session: AuthSession) => {
    const revision = ++transition.current;
    const credentialChanged = getOfflineState().session?.idToken !== session.idToken;
    const saved = session.uid ? {
      uid: session.uid, role: session.role, permissions: session.permissions,
      userName: session.userName, verifiedAt: session.verifiedAt ?? Date.now(),
    } : null;
    const previous = getOfflineState().session;
    const scope = saved ? sessionScope(saved) : "anonymous";
    const scopeChanged = getOfflineState().scope !== scope;
    if (scopeChanged) {
      setAuthReady(false);
      setOfflineSession(null);
      if (previous && !session.verificationUnavailable) void clearExistingCopy();
      await queryClient.cancelQueries();
      queryClient.clear();
    }
    await copyCleanup.current;
    if (revision !== transition.current) return;
    setOfflineSession(saved ? { ...saved, idToken: session.idToken } : null);
    if (scopeChanged && saved && session.idToken && navigator.onLine) {
      // Reconcile existing legacy rows in the background without blocking
      // healthy login or saving a private copy for new visitors.
      const current = () => getOfflineState().scope === scope;
      void reconcileSavedIdentity(saved.uid, scope, current).catch(() => undefined);
    }
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
    await clearExistingCopy();
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
