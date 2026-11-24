import { initializeApp, getApps } from "firebase/app";
import { hasOfflineDatabase, readSavedSession } from "../offline/storage";
import {
  getAuth,
  GoogleAuthProvider,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
  type Unsubscribe,
  type User,
} from "firebase/auth";

export type AuthSession = {
  idToken: string | null;
  isConfigured: boolean;
  isLoggedIn: boolean;
  permissions: string[];
  role: string;
  uid: string | null;
  userName: string;
  verifiedAt?: number;
  verificationUnavailable?: boolean;
};

const defaultAuthUserName = "Usuario CAS";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.appId &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId,
);

const getFirebaseAuth = (): Auth | null => {
  if (!isFirebaseConfigured) {
    return null;
  }

  const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  return getAuth(app);
};

export const subscribeToAuthSession = (
  onChange: (session: AuthSession) => void,
): Unsubscribe => {
  const auth = getFirebaseAuth();
  if (!auth) {
    onChange({
      idToken: null,
      isConfigured: false,
      isLoggedIn: false,
      permissions: [],
      role: "public_user",
      uid: null,
      userName: defaultAuthUserName,
    });
    return () => undefined;
  }

  const signedOut = {
    idToken: null,
    isConfigured: true,
    isLoggedIn: false,
    permissions: [],
    role: "public_user",
    uid: null,
    userName: defaultAuthUserName,
  };
  const offlineIdentity = (uid: string) => hasOfflineDatabase()
    .then((exists) => exists ? readSavedSession(uid) : undefined)
    .catch(() => undefined);
  let revision = 0;
  const publishUser = async (user: User | null, forceRefresh = false) => {
    const currentRevision = ++revision;
    if (!user) {
      onChange(signedOut);
      return;
    }

    try {
      if (!navigator.onLine) {
        const saved = await offlineIdentity(user.uid);
        if (currentRevision !== revision) return;
        if (!saved) {
          onChange(signedOut);
          return;
        }
        onChange({ ...saved, idToken: null, isConfigured: true, isLoggedIn: true });
        return;
      }
      const tokenResult = await user.getIdTokenResult(forceRefresh && navigator.onLine);
      if (currentRevision !== revision) return;

      onChange({
        idToken: tokenResult.token,
        isConfigured: true,
        isLoggedIn: true,
        permissions: normalizePermissionsClaim(tokenResult.claims.permissions),
        role: normalizeRoleClaim(tokenResult.claims.role),
        uid: user.uid,
        userName: user.displayName || user.email || defaultAuthUserName,
        verifiedAt: Date.now(),
      });
    } catch (error) {
      if (currentRevision !== revision) return;
      if (!navigator.onLine) {
        const saved = await offlineIdentity(user.uid);
        if (currentRevision !== revision) return;
        if (saved) {
          onChange({ ...saved, idToken: null, isConfigured: true, isLoggedIn: true });
          return;
        }
      }
      const code = (error as { code?: string })?.code;
      onChange({ ...signedOut, verificationUnavailable: code === "auth/network-request-failed" });
    }
  };
  let initial = true;
  const unsubscribe = onIdTokenChanged(auth, (user) => {
    const forceRefresh = initial;
    initial = false;
    void publishUser(user, forceRefresh);
  });
  const refresh = () => { void publishUser(auth.currentUser, true); };
  window.addEventListener("online", refresh);
  return () => {
    revision += 1;
    unsubscribe();
    window.removeEventListener("online", refresh);
  };
};

export const signInWithGoogle = async (): Promise<AuthSession> => {
  const auth = getFirebaseAuth();
  if (!auth) {
    return {
      idToken: null,
      isConfigured: false,
      isLoggedIn: true,
      permissions: [],
      role: "public_user",
      uid: null,
      userName: "Camila Rojas",
    };
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const credentials = await signInWithPopup(auth, provider);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
  try {
    const idToken = await credentials.user.getIdToken();
    const response = await fetch(`${apiBaseUrl}/api/v1/admin/activate-google-invitation`, {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!response.ok) throw new Error("No fue posible comprobar la invitación pendiente.");
  } catch (error) {
    await signOut(auth);
    throw error;
  }

  const tokenResult = await credentials.user.getIdTokenResult(true);

  return {
    idToken: tokenResult.token,
    isConfigured: true,
    isLoggedIn: true,
    permissions: normalizePermissionsClaim(tokenResult.claims.permissions),
    role: normalizeRoleClaim(tokenResult.claims.role),
    uid: credentials.user.uid,
    userName: credentials.user.displayName || credentials.user.email || defaultAuthUserName,
  };
};

export const signInWithEmailPassword = async (
  email: string,
  password: string,
): Promise<AuthSession> => {
  const auth = getFirebaseAuth();
  if (!auth) {
    return {
      idToken: null,
      isConfigured: false,
      isLoggedIn: true,
      permissions: [],
      role: "public_user",
      uid: null,
      userName: email || defaultAuthUserName,
    };
  }

  const credentials = await signInWithEmailAndPassword(auth, email, password);

  const tokenResult = await credentials.user.getIdTokenResult(true);

  return {
    idToken: tokenResult.token,
    isConfigured: true,
    isLoggedIn: true,
    permissions: normalizePermissionsClaim(tokenResult.claims.permissions),
    role: normalizeRoleClaim(tokenResult.claims.role),
    uid: credentials.user.uid,
    userName: credentials.user.displayName || credentials.user.email || defaultAuthUserName,
  };
};

export const signOutFromGoogle = async (): Promise<void> => {
  const auth = getFirebaseAuth();
  if (auth) {
    await signOut(auth);
  }
};

const normalizeRoleClaim = (value: unknown): string =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : "public_user";

const normalizePermissionsClaim = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((permission): permission is string => typeof permission === "string")
    : [];
