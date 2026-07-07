import { type FormEvent, lazy, useEffect, useState } from "react";
import type { WellMapPoint } from "../../data/mockupData";
import type { WellRegistryEntry } from "../../services/wellsApi";
import type { RemoteLoadStatus } from "../../types/remote";
import { WellMeasurementIngestPanel } from "./WellMeasurementIngestPanel";
import { WellRegistryAdminPanel } from "./WellRegistryAdminPanel";
import type { WellMeasurementFormState, WellRegistryFormState } from "./wellsView.types";
export type { WellMeasurementFormState, WellRegistryFormState } from "./wellsView.types";

const WellsMonitoringTab = lazy(() =>
  import("./WellsMonitoringTab").then((module) => ({
    default: module.WellsMonitoringTab,
  })),
);

export function WellsView({
  authIdToken,
  canAddMeasurements,
  canCreateWells,
  canManageWells,
  canManageCas,
  errorMessage,
  isLoggedIn,
  now,
  onWellRegistryChange,
  onWellRegistryDelete,
  onWellRegistrySubmit,
  onWellRegistryUpdate,
  onWellMeasurementChange,
  onWellMeasurementCsvUpload,
  onWellMeasurementSubmit,
  onSelectWell,
  selectedWellId,
  status,
  wellMeasurementCsvMessage,
  wellMeasurementCsvStatus,
  wellMeasurementForm,
  wellMeasurementMessage,
  wellMeasurementStatus,
  wellRegistryEntries,
  wellRegistryForm,
  wellRegistryMessage,
  wellRegistryStatus,
  wells,
}: {
  authIdToken: string | null;
  canAddMeasurements: boolean;
  canCreateWells: boolean;
  canManageWells: boolean;
  canManageCas: boolean;
  errorMessage: string | null;
  isLoggedIn: boolean;
  now: Date;
  onWellRegistryChange: (next: Partial<WellRegistryFormState>) => void;
  onWellRegistryDelete: (wellId: string) => Promise<void>;
  onWellRegistrySubmit: (event: FormEvent<HTMLFormElement>) => void;
  onWellRegistryUpdate: (
    wellId: string,
    event: FormEvent<HTMLFormElement>,
  ) => Promise<void>;
  onWellMeasurementChange: (next: Partial<WellMeasurementFormState>) => void;
  onWellMeasurementCsvUpload: (file: File) => Promise<boolean>;
  onWellMeasurementSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSelectWell: (wellId: string) => void;
  selectedWellId: string;
  status: RemoteLoadStatus;
  wellMeasurementCsvMessage: string | null;
  wellMeasurementCsvStatus: RemoteLoadStatus;
  wellMeasurementForm: WellMeasurementFormState;
  wellMeasurementMessage: string | null;
  wellMeasurementStatus: RemoteLoadStatus;
  wellRegistryEntries: WellRegistryEntry[];
  wellRegistryForm: WellRegistryFormState;
  wellRegistryMessage: string | null;
  wellRegistryStatus: RemoteLoadStatus;
  wells: WellMapPoint[];
}) {
  const [activeWellsTab, setActiveWellsTab] =
    useState<"monitoring" | "measurement" | "admin">("monitoring");
  const canUseMeasurementForm = canAddMeasurements;
  useEffect(() => {
    if (
      (activeWellsTab === "admin" && !canCreateWells) ||
      (activeWellsTab === "measurement" && !canUseMeasurementForm)
    ) {
      setActiveWellsTab("monitoring");
    }
  }, [activeWellsTab, canCreateWells, canUseMeasurementForm]);

  const wellsSubnav = canCreateWells || canUseMeasurementForm ? (
    <div className="snow-subnav" role="tablist" aria-label="Secciones de pozos">
      <button
        type="button"
        role="tab"
        aria-selected={activeWellsTab === "monitoring"}
        className={activeWellsTab === "monitoring" ? "is-active" : ""}
        onClick={() => setActiveWellsTab("monitoring")}
      >
        Monitoreo de pozos
      </button>
      {canUseMeasurementForm && (
        <button
          type="button"
          role="tab"
          aria-selected={activeWellsTab === "measurement"}
          className={activeWellsTab === "measurement" ? "is-active" : ""}
          onClick={() => setActiveWellsTab("measurement")}
        >
          Agregar medicion
        </button>
      )}
      {canCreateWells && (
        <button
          type="button"
          role="tab"
          aria-selected={activeWellsTab === "admin"}
          className={activeWellsTab === "admin" ? "is-active" : ""}
          onClick={() => setActiveWellsTab("admin")}
        >
          Administracion de pozos
        </button>
      )}
    </div>
  ) : null;

  if (canCreateWells && activeWellsTab === "admin") {
    return (
      <div className="view-stack">
        <div className="view-intro">
          <h2>Pozos y calidad de agua</h2>
          <p>
            Mapa operativo con estado por frescura de dato, fuente de captura y panel
            de detalle por pozo.
          </p>
        </div>

        {wellsSubnav}

        <WellRegistryAdminPanel
          authIdToken={authIdToken}
          canManageCas={canManageCas}
          canManageWells={canManageWells}
          entries={wellRegistryEntries}
          form={wellRegistryForm}
          message={wellRegistryMessage}
          onChange={onWellRegistryChange}
          onDeleteWell={onWellRegistryDelete}
          onSubmit={onWellRegistrySubmit}
          onUpdateWell={onWellRegistryUpdate}
          status={wellRegistryStatus}
        />
      </div>
    );
  }

  if (canUseMeasurementForm && activeWellsTab === "measurement") {
    return (
      <div className="view-stack">
        <div className="view-intro">
          <h2>Pozos y calidad de agua</h2>
          <p>
            Mapa operativo con estado por frescura de dato, fuente de captura y panel
            de detalle por pozo.
          </p>
        </div>

        {wellsSubnav}

        <WellMeasurementIngestPanel
          csvMessage={wellMeasurementCsvMessage}
          csvStatus={wellMeasurementCsvStatus}
          entries={wellRegistryEntries}
          form={wellMeasurementForm}
          individualStatus={wellMeasurementStatus}
          message={wellMeasurementMessage}
          onChange={onWellMeasurementChange}
          onCsvUpload={onWellMeasurementCsvUpload}
          onSubmit={onWellMeasurementSubmit}
        />
      </div>
    );
  }

  return (
    <WellsMonitoringTab
      errorMessage={errorMessage}
      isLoggedIn={isLoggedIn}
      now={now}
      onSelectWell={onSelectWell}
      selectedWellId={selectedWellId}
      status={status}
      subnav={wellsSubnav}
      wells={wells}
    />
  );
}
