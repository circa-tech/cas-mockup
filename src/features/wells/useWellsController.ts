import { useQuery } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getFreshnessStatus, staleThresholdDaysDefault, wellMapPoints } from "../../data/mockupData";
import { queryKeys } from "../../lib/queryKeys";
import { ApiRequestError } from "../../services/apiError";
import {
  createWellRegistryEntry,
  fetchMyWellRegistryEntries,
  fetchWellMapPoints,
  fetchWellRegistryEntries,
  fetchWellsAdminStatus,
  ingestWellMeasurement,
  ingestWellMeasurementsBatch,
  type WellsCapabilities,
} from "../../services/wellsApi";
import type { RemoteLoadStatus } from "../../types/remote";
import { toRemoteErrorMessage } from "../../app/remoteError";
import { parseMeasurementCsv } from "./measurementCsv";
import type { WellMeasurementFormState, WellRegistryFormState } from "./WellsView";

const emptyCapabilities: WellsCapabilities = {
  canAddMeasurements: false,
  canCreateWells: false,
  canDeleteMeasurements: false,
  canManageCas: false,
  canViewWells: false,
  isAdmin: false,
};

const getWellCreationErrorMessage = (error: unknown) => {
  if (error instanceof ApiRequestError) {
    if (error.status === 409) return "Este código de obra ya está registrado.";
    if (error.status === 422 && /codigoObra|codigo_obra|work code/i.test(error.detail)) {
      return "Código de obra inválido. Usa el formato OB-0101-11, sin ceros iniciales en el último bloque.";
    }
    if (error.status === 422 && /casId|cas_id/i.test(error.detail)) {
      return "Debes seleccionar una CAS válida.";
    }
  }
  return "No fue posible conectar con la API. Intenta nuevamente.";
};

const getCsvUploadErrorMessage = (error: unknown) => {
  if (error instanceof ApiRequestError) {
    if (error.status === 409) {
      return "El archivo contiene una medición en conflicto. No se cargó ninguna fila.";
    }
    if (error.status === 404) {
      return "El archivo contiene un pozo que ya no está disponible.";
    }
    if (error.status === 422) return `La API rechazó el archivo: ${error.detail}`;
  }
  return toRemoteErrorMessage(error, "No fue posible cargar el CSV.");
};

export function useWellsController({
  authIdToken,
  hasAuthenticatedApiSession,
  now,
}: {
  authIdToken: string | null;
  hasAuthenticatedApiSession: boolean;
  now: Date;
}) {
  const [selectedWellId, setSelectedWellId] = useState(wellMapPoints[0].id);
  const [wellRegistryStatus, setWellRegistryStatus] = useState<RemoteLoadStatus>("idle");
  const [wellRegistryMessage, setWellRegistryMessage] = useState<string | null>(null);
  const [wellMeasurementStatus, setWellMeasurementStatus] =
    useState<RemoteLoadStatus>("idle");
  const [wellMeasurementMessage, setWellMeasurementMessage] = useState<string | null>(null);
  const [wellMeasurementCsvStatus, setWellMeasurementCsvStatus] =
    useState<RemoteLoadStatus>("idle");
  const [wellMeasurementCsvMessage, setWellMeasurementCsvMessage] =
    useState<string | null>(null);
  const [wellRegistryForm, setWellRegistryForm] = useState<WellRegistryFormState>({
    aquiferSector: "",
    casId: "",
    centroControlRut: "",
    codigoObra: "",
    lat: "",
    lng: "",
    name: "",
    provider: "",
  });
  const [wellMeasurementForm, setWellMeasurementForm] =
    useState<WellMeasurementFormState>({
      codigoObra: "",
      companyRut: "",
      flowRate: "",
      measurementDate: new Date().toISOString().slice(0, 10),
      measurementTime: "10:00",
      totalizer: "",
      userRut: "",
      waterTableDepth: "",
    });

  const measurementsQuery = useQuery({
    queryKey: queryKeys.wells.measurements(authIdToken),
    queryFn: () => fetchWellMapPoints(authIdToken!),
    enabled: hasAuthenticatedApiSession && Boolean(authIdToken),
    staleTime: 2 * 60 * 1000,
  });
  const capabilitiesQuery = useQuery({
    queryKey: queryKeys.wells.capabilities(authIdToken),
    queryFn: () => fetchWellsAdminStatus(authIdToken!),
    enabled: hasAuthenticatedApiSession && Boolean(authIdToken),
    staleTime: 5 * 60 * 1000,
  });
  const wellsCapabilities = capabilitiesQuery.data ?? emptyCapabilities;
  const registryQuery = useQuery({
    queryKey: queryKeys.wells.registry(authIdToken, !wellsCapabilities.canManageCas),
    queryFn: () =>
      wellsCapabilities.canManageCas
        ? fetchWellRegistryEntries(authIdToken!)
        : fetchMyWellRegistryEntries(authIdToken!),
    enabled:
      hasAuthenticatedApiSession &&
      Boolean(authIdToken) &&
      capabilitiesQuery.isSuccess,
    staleTime: 5 * 60 * 1000,
  });
  const wellRegistryEntries = registryQuery.data ?? [];
  const wellState = hasAuthenticatedApiSession
    ? (measurementsQuery.data ?? [])
    : wellMapPoints;
  const wellsStatus: RemoteLoadStatus = !hasAuthenticatedApiSession
    ? "idle"
    : measurementsQuery.isPending
      ? "loading"
      : measurementsQuery.isError || wellState.length === 0
        ? "error"
        : "ready";
  const wellsErrorMessage = measurementsQuery.isError
    ? toRemoteErrorMessage(
        measurementsQuery.error,
        "No fue posible cargar datos reales de pozos.",
      )
    : measurementsQuery.isSuccess && wellState.length === 0
      ? "La API respondió sin pozos."
      : null;

  const wells = useMemo(
    () =>
      wellState.map((well) => ({
        ...well,
        status: getFreshnessStatus(well.lastUpdate, now, staleThresholdDaysDefault),
      })),
    [now, wellState],
  );

  useEffect(() => {
    if (!hasAuthenticatedApiSession || !authIdToken) {
      setWellRegistryStatus("idle");
      setWellRegistryMessage(null);
      setWellMeasurementStatus("idle");
      setWellMeasurementMessage(null);
      setWellMeasurementCsvStatus("idle");
      setWellMeasurementCsvMessage(null);
      return;
    }
    if (capabilitiesQuery.isError || registryQuery.isError) {
      setWellRegistryStatus("error");
      setWellRegistryMessage("No fue posible cargar permisos o registro de pozos.");
    } else if (capabilitiesQuery.isPending || registryQuery.isPending) {
      setWellRegistryStatus("loading");
    } else {
      setWellRegistryStatus("ready");
    }
  }, [
    authIdToken,
    capabilitiesQuery.isError,
    capabilitiesQuery.isPending,
    hasAuthenticatedApiSession,
    registryQuery.isError,
    registryQuery.isPending,
  ]);

  useEffect(() => {
    if (wells.length && !wells.some((well) => well.id === selectedWellId)) {
      setSelectedWellId(wells[0].id);
    }
  }, [selectedWellId, wells]);

  useEffect(() => {
    if (!wellMeasurementForm.codigoObra && wellRegistryEntries.length) {
      setWellMeasurementForm((previous) => ({
        ...previous,
        codigoObra: wellRegistryEntries[0].codigoObra,
      }));
    }
  }, [wellMeasurementForm.codigoObra, wellRegistryEntries]);

  const refreshWells = async () => {
    if (!authIdToken) return [];
    const result = await measurementsQuery.refetch();
    if (result.error) throw result.error;
    return result.data ?? [];
  };

  const handleWellRegistrySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authIdToken) return;
    const workCode = wellRegistryForm.codigoObra.trim();
    if (!/^OB-\d{4}-[1-9]\d*$/.test(workCode) || !wellRegistryForm.casId) {
      setWellRegistryStatus("error");
      setWellRegistryMessage(
        !wellRegistryForm.casId
          ? "Debes seleccionar una CAS válida."
          : "Código de obra inválido. Usa el formato OB-0101-11.",
      );
      return;
    }
    const lat = Number.parseFloat(wellRegistryForm.lat);
    const lng = Number.parseFloat(wellRegistryForm.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setWellRegistryStatus("error");
      setWellRegistryMessage("Latitud y longitud deben ser números válidos.");
      return;
    }

    setWellRegistryStatus("loading");
    setWellRegistryMessage(null);
    try {
      const created = await createWellRegistryEntry(authIdToken, {
        ...wellRegistryForm,
        codigoObra: workCode,
        lat,
        lng,
        provider: wellRegistryForm.provider || null,
        centroControlRut: wellRegistryForm.centroControlRut || null,
        aquiferSector: wellRegistryForm.aquiferSector || null,
      });
      await registryQuery.refetch();
      setWellRegistryForm((previous) => ({
        ...previous,
        aquiferSector: "",
        centroControlRut: "",
        codigoObra: "",
        lat: "",
        lng: "",
        name: "",
        provider: "",
      }));
      setWellRegistryStatus("ready");
      setWellRegistryMessage(
        `Pozo ${created.name} (${created.codigoObra}) asociado a ${created.casCode}.`,
      );
    } catch (error) {
      setWellRegistryStatus("error");
      setWellRegistryMessage(getWellCreationErrorMessage(error));
    }
  };

  const handleWellMeasurementSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authIdToken) return;
    setWellMeasurementStatus("loading");
    setWellMeasurementMessage(null);
    try {
      await ingestWellMeasurement(authIdToken, {
        ...wellMeasurementForm,
        waterTableDepth: wellMeasurementForm.waterTableDepth || null,
      });
      const nextWells = await refreshWells();
      if (nextWells.some((well) => well.id === wellMeasurementForm.codigoObra)) {
        setSelectedWellId(wellMeasurementForm.codigoObra);
      }
      setWellMeasurementStatus("ready");
      setWellMeasurementMessage("Medición guardada correctamente.");
      setWellMeasurementForm((previous) => ({
        ...previous,
        flowRate: "",
        totalizer: "",
        waterTableDepth: "",
      }));
    } catch (error) {
      setWellMeasurementStatus("error");
      setWellMeasurementMessage(
        toRemoteErrorMessage(error, "No fue posible guardar la medición."),
      );
    }
  };

  const handleWellMeasurementCsvUpload = async (file: File) => {
    if (!authIdToken) return false;
    setWellMeasurementCsvStatus("loading");
    setWellMeasurementCsvMessage(null);
    try {
      const allowed = new Set(wellRegistryEntries.map((entry) => entry.codigoObra));
      const payloads = parseMeasurementCsv(await file.text(), allowed);
      const result = await ingestWellMeasurementsBatch(authIdToken, payloads);
      await refreshWells();
      setWellMeasurementCsvStatus("ready");
      setWellMeasurementCsvMessage(
        `${result.insertedCount} mediciones cargadas; ${result.skippedCount} omitidas.`,
      );
      return true;
    } catch (error) {
      setWellMeasurementCsvStatus("error");
      setWellMeasurementCsvMessage(getCsvUploadErrorMessage(error));
      return false;
    }
  };

  return {
    handleWellMeasurementChange: (next: Partial<WellMeasurementFormState>) =>
      setWellMeasurementForm((previous) => ({ ...previous, ...next })),
    handleWellMeasurementCsvUpload,
    handleWellMeasurementSubmit,
    handleWellRegistryChange: (next: Partial<WellRegistryFormState>) => {
      setWellRegistryForm((previous) => ({ ...previous, ...next }));
      setWellRegistryMessage(null);
      setWellRegistryStatus("ready");
    },
    handleWellRegistrySubmit,
    selectedWellId,
    setSelectedWellId,
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
    wellsCapabilities,
    wellsErrorMessage,
    wellsStatus,
  };
}
