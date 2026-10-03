import { type FormEvent, lazy, useEffect, useState } from "react";
import type { WellMapPoint } from "../../data/mockupData";
import { fetchWritableWellIds, type WellRegistryEntry } from "../../services/wellsApi";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../lib/queryKeys";
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
  authUid,
  canAddMeasurements,
  canCreateWells,
  canDeleteWells,
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
  authUid: string | null;
  canAddMeasurements: boolean;
  canCreateWells: boolean;
  canDeleteWells: boolean;
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
  const writableQuery = useQuery({
    queryKey: queryKeys.wells.writable(authIdToken),
    queryFn: () => fetchWritableWellIds(authIdToken!),
    enabled: Boolean(authIdToken && canAddMeasurements),
  });
  const writableIds = new Set(writableQuery.data ?? []);
  const writableEntries = wellRegistryEntries.filter((entry) => writableIds.has(entry.id));
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
          Administrar pozos
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
            Revisa a qué profundidad está el agua en tus pozos, cómo ha cambiado y
            si están enviando datos.
          </p>
        </div>

        {wellsSubnav}

        <WellRegistryAdminPanel
          authIdToken={authIdToken}
          authUid={authUid}
          canDeleteWells={canDeleteWells}
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
            Revisa a qué profundidad está el agua en tus pozos, cómo ha cambiado y
            si están enviando datos.
          </p>
        </div>

        {wellsSubnav}

        <WellMeasurementIngestPanel
          csvMessage={wellMeasurementCsvMessage}
          csvStatus={wellMeasurementCsvStatus}
          entries={writableEntries}
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
