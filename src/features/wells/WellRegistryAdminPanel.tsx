import { useQuery } from "@tanstack/react-query";
import { FormEvent, useEffect, useState } from "react";
import { toRemoteErrorMessage } from "../../app/remoteError";
import { Panel } from "../../components/Panel";
import { queryKeys } from "../../lib/queryKeys";
import {
  fetchCasOrganizations,
  type CasOrganization,
  type WellRegistryEntry,
} from "../../services/wellsApi";
import type { RemoteLoadStatus } from "../../types/remote";
import { WellCasAdminPanel } from "./WellCasAdminPanel";
import { WellRegistryEditor } from "./WellRegistryEditor";
import type { WellRegistryFormState } from "./wellsView.types";

export function WellRegistryAdminPanel({
  authIdToken,
  canManageCas,
  canManageWells,
  entries,
  form,
  message,
  onChange,
  onDeleteWell,
  onSubmit,
  onUpdateWell,
  status,
}: {
  authIdToken: string | null;
  canManageCas: boolean;
  canManageWells: boolean;
  entries: WellRegistryEntry[];
  form: WellRegistryFormState;
  message: string | null;
  onChange: (next: Partial<WellRegistryFormState>) => void;
  onDeleteWell: (wellId: string) => Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateWell: (wellId: string, event: FormEvent<HTMLFormElement>) => Promise<void>;
  status: RemoteLoadStatus;
}) {
  const [activeAdminView, setActiveAdminView] =
    useState<"registry" | "cas">("registry");
  const organizationsQuery = useQuery({
    queryKey: queryKeys.wells.casOrganizations(authIdToken),
    queryFn: () => fetchCasOrganizations(authIdToken!),
    enabled: Boolean(authIdToken),
    staleTime: 5 * 60 * 1000,
  });
  const organizations = organizationsQuery.data ?? [];
  const organizationsError = organizationsQuery.error
    ? toRemoteErrorMessage(
        organizationsQuery.error,
        "No fue posible cargar las organizaciones CAS.",
      )
    : null;

  useEffect(() => {
    const firstOrganization = organizations[0];
    if (firstOrganization && !form.casId) onChange({ casId: firstOrganization.id });
  }, [form.casId, onChange, organizations]);

  const refreshOrganizations = async (): Promise<CasOrganization[]> => {
    const result = await organizationsQuery.refetch();
    return result.data ?? [];
  };

  return (
    <Panel
      title="Administracion de pozos"
      subtitle={`${entries.length} pozos en registry`}
    >
      <div className="well-admin-view-nav" role="tablist" aria-label="Administracion de pozos">
        <button
          type="button"
          role="tab"
          aria-selected={activeAdminView === "registry"}
          className={activeAdminView === "registry" ? "is-active" : ""}
          onClick={() => setActiveAdminView("registry")}
        >
          Pozos
        </button>
        {canManageCas && (
          <button
            type="button"
            role="tab"
            aria-selected={activeAdminView === "cas"}
            className={activeAdminView === "cas" ? "is-active" : ""}
            onClick={() => setActiveAdminView("cas")}
          >
            Organizaciones CAS
          </button>
        )}
      </div>

      {activeAdminView === "registry" && (
        <WellRegistryEditor
          canManageWells={canManageWells}
          entries={entries}
          form={form}
          message={message}
          onChange={onChange}
          onDeleteWell={onDeleteWell}
          onSubmit={onSubmit}
          onUpdateWell={onUpdateWell}
          organizations={organizations}
          organizationsError={organizationsError}
          status={status}
        />
      )}

      {activeAdminView === "cas" && canManageCas && (
        <WellCasAdminPanel
          authIdToken={authIdToken}
          onDefaultCasChange={(casId) => onChange({ casId })}
          organizations={organizations}
          refreshOrganizations={refreshOrganizations}
        />
      )}
    </Panel>
  );
}
