import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
  type Unsubscribe,
} from "firebase/auth";

export type AuthSession = {
  idToken: string | null;
  isConfigured: boolean;
  isLoggedIn: boolean;
  permissions: string[];
  role: string;
  uid: string | null;
  userName: string;
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

  let shouldForceInitialRefresh = true;
  return onIdTokenChanged(auth, async (user) => {
    if (!user) {
      onChange({
        idToken: null,
        isConfigured: true,
        isLoggedIn: false,
        permissions: [],
        role: "public_user",
        uid: null,
        userName: defaultAuthUserName,
      });
      return;
    }

    try {
      const forceRefresh = shouldForceInitialRefresh;
      shouldForceInitialRefresh = false;
      const tokenResult = await user.getIdTokenResult(forceRefresh);

      onChange({
        idToken: tokenResult.token,
        isConfigured: true,
        isLoggedIn: true,
        permissions: normalizePermissionsClaim(tokenResult.claims.permissions),
        role: normalizeRoleClaim(tokenResult.claims.role),
        uid: user.uid,
        userName: user.displayName || user.email || defaultAuthUserName,
      });
    } catch {
      onChange({
        idToken: null,
        isConfigured: true,
        isLoggedIn: false,
        permissions: [],
        role: "public_user",
        uid: null,
        userName: defaultAuthUserName,
      });
    }
  });
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
