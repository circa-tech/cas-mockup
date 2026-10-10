import { useEffect, useMemo, useState } from "react";
import { mockNowIso, views, type ViewId } from "../data/mockupData";
import { useWellsController } from "../features/wells/useWellsController";
import { useAuthSession } from "./useAuthSession";
import { useDashboardData } from "./useDashboardData";
import { useOfflineState } from "../offline/state";
import { useOfflinePreparation } from "../offline/prepare";
import { isFirebaseConfigured } from "../services/firebaseAuth";

export function useAppController() {
  const [activeView, setActiveView] = useState<ViewId>(() =>
    new URLSearchParams(window.location.search).get("view") === "forum" ? "forum" : "overview",
  );
  useEffect(() => {
    const url = new URL(window.location.href);
    if (activeView === "forum") url.searchParams.set("view", "forum");
    else url.searchParams.delete("view");
    window.history.replaceState(window.history.state, "", url);
  }, [activeView]);
  const [appScreen, setAppScreen] = useState<"dashboard" | "login">("dashboard");
  const auth = useAuthSession();
  const offline = useOfflineState();
  const readOnly = !offline.online || offline.networkUnavailable || !auth.authIdToken;
  const canManageUsers = auth.authPermissions.includes("users:manage") && !readOnly;
  const canDownloadEt = auth.authPermissions.includes("et:download");
  const hasAuthenticatedApiSession = auth.authReady && auth.isLoggedIn && Boolean(auth.authUid);
  useOfflinePreparation(hasAuthenticatedApiSession);
  const canViewCommunity =
    hasAuthenticatedApiSession &&
    ["cas_user", "technical_admin", "general_admin"].includes(auth.authRole);
  const visibleActiveView =
    (activeView === "forum" || activeView === "tutorials") && !canViewCommunity
      ? "overview"
      : activeView;
  const dashboardNow = useMemo(() => {
    const timestamp = auth.authUid ? Date.now() : new Date(mockNowIso).getTime();
    return new Date(timestamp);
  }, [auth.authUid]);

  const wells = useWellsController({
    authIdToken: auth.authIdToken,
    authUid: auth.authUid,
    hasAuthenticatedApiSession,
    now: dashboardNow,
  });
  const dashboard = useDashboardData({
    authIdToken: auth.authIdToken,
    hasAuthenticatedApiSession,
    now: dashboardNow,
    wells: wells.wells,
  });

  const availableViews = useMemo(
    () =>
      views.filter(
        (view) =>
          (view.id !== "admin" || canManageUsers) &&
          ((view.id !== "forum" && view.id !== "tutorials") ||
            canViewCommunity) &&
          (view.id !== "wells" ||
            !hasAuthenticatedApiSession ||
            auth.authRole !== "public_user"),
      ),
    [auth.authRole, canManageUsers, canViewCommunity, hasAuthenticatedApiSession],
  );

  useEffect(() => {
    const cannotOpenAdmin = activeView === "admin" && !canManageUsers;
    const cannotOpenWells =
      activeView === "wells" &&
      hasAuthenticatedApiSession &&
      auth.authRole === "public_user";
    const cannotOpenCommunity =
      (activeView === "forum" || activeView === "tutorials") &&
      !canViewCommunity &&
      (!auth.isLoggedIn || Boolean(auth.authIdToken));
    if (cannotOpenAdmin || cannotOpenWells || cannotOpenCommunity) {
      setActiveView("overview");
    }
  }, [
    activeView,
    auth.authIdToken,
    auth.authRole,
    auth.isLoggedIn,
    canManageUsers,
    canViewCommunity,
    hasAuthenticatedApiSession,
  ]);

  const finishLogin = () => {
    setActiveView("overview");
    setAppScreen("dashboard");
  };
  const handleGoogleLogin = async () => {
    await auth.loginWithGoogle();
    finishLogin();
  };
  const handleEmailPasswordLogin = async (email: string, password: string) => {
    await auth.loginWithEmailPassword(email, password);
    finishLogin();
  };
  const handleLogout = async () => {
    await auth.logout();
    finishLogin();
  };

  return {
    activeView: visibleActiveView,
    authReady: auth.authReady,
    readOnly,
    offlineAccessUnavailable: isFirebaseConfigured && !auth.isLoggedIn && !offline.online,
    appScreen,
    authIdToken: auth.authIdToken,
    authRole: auth.authRole,
    authUid: auth.authUid,
    authUserName: auth.authUserName,
    availableViews,
    canDownloadEt,
    canManageUsers,
    dashboardNow,
    ...dashboard,
    handleEmailPasswordLogin,
    handleGoogleLogin,
    handleLogout,
    handleOpenLogin: () => setAppScreen("login"),
    handleOpenView: setActiveView,
    hasAuthenticatedApiSession,
    isLoggedIn: auth.isLoggedIn,
    setAppScreen,
    ...wells,
  };
}
