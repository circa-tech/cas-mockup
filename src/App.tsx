import { lazy, Suspense } from "react";
import {
  Droplets,
  Gauge,
  LogIn,
  LogOut,
  ShieldCheck,
  Snowflake,
  Thermometer,
  UserRound,
  Waves,
} from "lucide-react";
import { RemoteDataState } from "./components/RemoteDataState";
import { useAppController } from "./app/useAppController";

const AdminView = lazy(() =>
  import("./features/admin/AdminView").then((module) => ({ default: module.AdminView })),
);
const EtrView = lazy(() =>
  import("./features/etr/EtrView").then((module) => ({ default: module.EtrView })),
);
const LoginView = lazy(() =>
  import("./features/auth/LoginView").then((module) => ({ default: module.LoginView })),
);
const MeteoView = lazy(() =>
  import("./features/meteo/MeteoView").then((module) => ({ default: module.MeteoView })),
);
const OverviewView = lazy(() =>
  import("./features/overview/OverviewView").then((module) => ({
    default: module.OverviewView,
  })),
);
const SnowView = lazy(() =>
  import("./features/snow/SnowView").then((module) => ({ default: module.SnowView })),
);
const WellsView = lazy(() =>
  import("./features/wells/WellsView").then((module) => ({ default: module.WellsView })),
);

const navIconMap = {
  overview: Gauge,
  etr: Droplets,
  snow: Snowflake,
  wells: Waves,
  meteo: Thermometer,
  admin: ShieldCheck,
} as const;

export default function App() {
  const app = useAppController();

  if (app.appScreen === "login") {
    return (
      <Suspense
        fallback={
          <RemoteDataState
            className="route-loading-state"
            message="Preparando formulario de acceso."
            title="Cargando acceso"
          />
        }
      >
        <LoginView
          onBack={() => app.setAppScreen("dashboard")}
          onGoogleLogin={app.handleGoogleLogin}
          onEmailPasswordLogin={app.handleEmailPasswordLogin}
        />
      </Suspense>
    );
  }

  return (
    <div className="page-shell">
      <header className="site-header">
        <div className="site-brand">
          <div className="site-brand-icon" aria-hidden="true">
            <Droplets size={16} />
          </div>
          <div>
            <h1>Agua con Dato</h1>
            <p>
              Mockup unificado para ET-LAT, MODIS-Snow, Pozos y Meteo
            </p>
          </div>
        </div>

        <div className="site-header-actions">
          <nav className="top-nav" aria-label="Views">
            {app.availableViews.map((view) => {
              const Icon = navIconMap[view.id];
              return (
                <button
                  key={view.id}
                  type="button"
                  className={view.id === app.activeView ? "is-active" : ""}
                  onClick={() => app.handleOpenView(view.id)}
                >
                  <Icon className="nav-icon" size={14} />
                  {view.label}
                </button>
              );
            })}
          </nav>

          <div className="auth-controls">
            {app.isLoggedIn ? (
              <>
                <span className="auth-user-chip">
                  <UserRound size={13} />
                  {app.authUserName}
                  {app.authRole === "general_admin" ? (
                    <span className="auth-role-dot">Admin</span>
                  ) : null}
                </span>
                <button
                  type="button"
                  className="auth-action-btn"
                  onClick={app.handleLogout}
                >
                  <LogOut size={13} />
                  Cerrar sesión
                </button>
              </>
            ) : (
              <button
                type="button"
                className="auth-action-btn auth-login-btn"
                onClick={app.handleOpenLogin}
              >
                <LogIn size={13} />
                Iniciar sesión
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="content-shell">
        <Suspense
          fallback={
            <RemoteDataState
              className="route-loading-state"
              message="Descargando los recursos de esta sección."
              title="Cargando módulo"
            />
          }
        >
          {app.activeView === "overview" && (
            <OverviewView
              cards={app.overviewCards}
              etrErrorMessage={app.etrErrorMessage}
              etrSeries={app.etrOverviewSeries}
              meteoErrorMessage={app.meteoErrorMessage}
              meteoStatus={app.meteoStatus}
              onOpenView={app.handleOpenView}
              snowErrorMessage={app.snowErrorMessage}
              snowSeries={app.snowOverviewSeriesForSummary}
              stations={app.stations}
              wellsErrorMessage={app.wellsErrorMessage}
              wellsStatus={app.wellsStatus}
              wells={app.wells}
            />
          )}
          {app.activeView === "etr" && (
            <EtrView
              authIdToken={app.authIdToken}
              isLoggedIn={app.hasAuthenticatedApiSession}
            />
          )}
          {app.activeView === "snow" && (
            <SnowView
              authIdToken={app.authIdToken}
              isLoggedIn={app.hasAuthenticatedApiSession}
            />
          )}
          {app.activeView === "wells" && (
            <WellsView
              authIdToken={app.authIdToken}
              canAddMeasurements={app.wellsCapabilities.canAddMeasurements}
              canCreateWells={app.wellsCapabilities.canCreateWells}
              canDeleteWells={app.wellsCapabilities.canDeleteWells}
              canManageWells={app.wellsCapabilities.canManageWells}
              canManageCas={app.wellsCapabilities.canManageCas}
              isLoggedIn={app.hasAuthenticatedApiSession}
              now={app.dashboardNow}
              onWellRegistryChange={app.handleWellRegistryChange}
              onWellRegistryDelete={app.handleWellRegistryDelete}
              onWellRegistrySubmit={app.handleWellRegistrySubmit}
              onWellRegistryUpdate={app.handleWellRegistryUpdate}
              onWellMeasurementChange={app.handleWellMeasurementChange}
              onWellMeasurementCsvUpload={app.handleWellMeasurementCsvUpload}
              onWellMeasurementSubmit={app.handleWellMeasurementSubmit}
              onSelectWell={app.setSelectedWellId}
              selectedWellId={app.selectedWellId}
              status={app.wellsStatus}
              errorMessage={app.wellsErrorMessage}
              wellMeasurementCsvMessage={app.wellMeasurementCsvMessage}
              wellMeasurementCsvStatus={app.wellMeasurementCsvStatus}
              wellMeasurementForm={app.wellMeasurementForm}
              wellMeasurementMessage={app.wellMeasurementMessage}
              wellMeasurementStatus={app.wellMeasurementStatus}
              wellRegistryEntries={app.wellRegistryEntries}
              wellRegistryForm={app.wellRegistryForm}
              wellRegistryMessage={app.wellRegistryMessage}
              wellRegistryStatus={app.wellRegistryStatus}
              wells={app.wells}
            />
          )}
          {app.activeView === "meteo" && (
            <MeteoView
              isLoggedIn={app.hasAuthenticatedApiSession}
              now={app.dashboardNow}
              onSelectStation={app.setSelectedStationId}
              selectedStationId={app.selectedStationId}
              stations={app.stations}
              status={app.meteoStatus}
              errorMessage={app.meteoErrorMessage}
            />
          )}
          {app.activeView === "admin" && app.canManageUsers && (
            <AdminView authIdToken={app.authIdToken} currentUserUid={app.authUid} />
          )}
        </Suspense>
      </main>
    </div>
  );
}
