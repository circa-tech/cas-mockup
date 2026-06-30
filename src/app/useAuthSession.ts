import { useEffect, useRef, useState } from "react";
import { queryClient } from "../lib/queryClient";
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
    () => readStoredValue(authStorageKey, "true") === "true",
  );
  const [authUserName, setAuthUserName] = useState(() =>
    readStoredValue(authUserStorageKey, defaultAuthUserName),
  );
  const [authIdToken, setAuthIdToken] = useState<string | null>(null);
  const [authPermissions, setAuthPermissions] = useState<string[]>([]);
  const [authRole, setAuthRole] = useState("public_user");
  const [authUid, setAuthUid] = useState<string | null>(null);
  const previousAuthUid = useRef<string | null>(null);

  const applySession = (session: AuthSession) => {
    if (previousAuthUid.current && previousAuthUid.current !== session.uid) {
      queryClient.clear();
    }
    previousAuthUid.current = session.uid;
    setIsLoggedIn(session.isLoggedIn);
    setAuthUserName(
      session.userName.trim().length > 0 ? session.userName : defaultAuthUserName,
    );
    setAuthIdToken(session.idToken);
    setAuthPermissions(session.permissions);
    setAuthRole(session.role);
    setAuthUid(session.uid);
  };

  useEffect(() => {
    if (!isFirebaseConfigured) {
      return undefined;
    }
    return subscribeToAuthSession(applySession);
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
    applySession({
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
