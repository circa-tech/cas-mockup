import { useEffect, useMemo, useState } from "react";
import { mockNowIso, views, type ViewId } from "../data/mockupData";
import { useWellsController } from "../features/wells/useWellsController";
import { useAuthSession } from "./useAuthSession";
import { useDashboardData } from "./useDashboardData";

export function useAppController() {
  const [activeView, setActiveView] = useState<ViewId>("overview");
  const [appScreen, setAppScreen] = useState<"dashboard" | "login">("dashboard");
  const auth = useAuthSession();
  const canManageUsers = auth.authPermissions.includes("users:manage");
  const hasAuthenticatedApiSession = auth.isLoggedIn && Boolean(auth.authIdToken);
  const dashboardNow = useMemo(() => {
    const timestamp = auth.authIdToken ? Date.now() : new Date(mockNowIso).getTime();
    return new Date(timestamp);
  }, [auth.authIdToken]);

  const wells = useWellsController({
    authIdToken: auth.authIdToken,
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
          (view.id !== "wells" ||
            !hasAuthenticatedApiSession ||
            auth.authRole !== "public_user"),
      ),
    [auth.authRole, canManageUsers, hasAuthenticatedApiSession],
  );

  useEffect(() => {
    const cannotOpenAdmin = activeView === "admin" && !canManageUsers;
    const cannotOpenWells =
      activeView === "wells" &&
      hasAuthenticatedApiSession &&
      auth.authRole === "public_user";
    if (cannotOpenAdmin || cannotOpenWells) {
      setActiveView("overview");
    }
  }, [activeView, auth.authRole, canManageUsers, hasAuthenticatedApiSession]);

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
    activeView,
    appScreen,
    authIdToken: auth.authIdToken,
    authRole: auth.authRole,
    authUid: auth.authUid,
    authUserName: auth.authUserName,
    availableViews,
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
