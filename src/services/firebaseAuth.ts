import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
  type Unsubscribe,
} from "firebase/auth";

export type AuthSession = {
  idToken: string | null;
  isConfigured: boolean;
  isLoggedIn: boolean;
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
      userName: defaultAuthUserName,
    });
    return () => undefined;
  }

  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      onChange({
        idToken: null,
        isConfigured: true,
        isLoggedIn: false,
        userName: defaultAuthUserName,
      });
      return;
    }

    onChange({
      idToken: await user.getIdToken(),
      isConfigured: true,
      isLoggedIn: true,
      userName: user.displayName || user.email || defaultAuthUserName,
    });
  });
};

export const signInWithGoogle = async (): Promise<AuthSession> => {
  const auth = getFirebaseAuth();
  if (!auth) {
    return {
      idToken: null,
      isConfigured: false,
      isLoggedIn: true,
      userName: "Camila Rojas",
    };
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const credentials = await signInWithPopup(auth, provider);

  return {
    idToken: await credentials.user.getIdToken(),
    isConfigured: true,
    isLoggedIn: true,
    userName: credentials.user.displayName || credentials.user.email || defaultAuthUserName,
  };
};

export const signOutFromGoogle = async (): Promise<void> => {
  const auth = getFirebaseAuth();
  if (auth) {
    await signOut(auth);
  }
};
