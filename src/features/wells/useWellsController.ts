import { useQuery } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getFreshnessStatus, staleThresholdDaysDefault, wellMapPoints } from "../../data/mockupData";
import { queryKeys } from "../../lib/queryKeys";
import { ApiRequestError } from "../../services/apiError";
import {
  createWellRegistryEntry,
  deleteWellRegistryEntry,
  fetchMyWellRegistryEntries,
  fetchWellMapPoints,
  fetchWellRegistryEntries,
  fetchWellsAdminStatus,
  ingestWellMeasurement,
  ingestWellMeasurementsBatch,
  updateWellRegistryEntry,
  type CatchmentStatus,
  type CreateWellRegistryEntryPayload,
  type WaterLevelCondition,
  type WellsCapabilities,
} from "../../services/wellsApi";
import type { RemoteLoadStatus } from "../../types/remote";
import { toRemoteErrorMessage } from "../../app/remoteError";
import { parseMeasurementCsv } from "./measurementCsv";
import type { WellMeasurementFormState, WellRegistryFormState } from "./WellsView";

const emptyCapabilities: WellsCapabilities = {
  canAddMeasurements: false,
  canCreateWells: false,
  canDeleteWells: false,
  canDeleteMeasurements: false,
  canManageWells: false,
  canManageCas: false,
  canViewWells: false,
  isAdmin: false,
};

const toWaterLevelCondition = (value: string): WaterLevelCondition | null =>
  value === "static" || value === "dynamic" || value === "unknown" ? value : null;

const toCatchmentStatus = (value: string): CatchmentStatus | null =>
  value === "operativa" || value === "deshabilitada" || value === "pozo_monitoreo"
    ? value
    : null;

const parseOptionalMetadataNumber = (value: string): number | null => {
  if (value.trim() === "") return null;
  return Number.parseFloat(value);
};

const emptyWaterRight = () => ({
  anio: "",
  cbr: "",
  fojas: "",
  numero: "",
});

const emptyOwnerContact = () => ({
  email: "",
  phone: "",
  representative: "",
  rut: "",
});

const emptyWellRegistryForm = (): WellRegistryFormState => ({
  aquiferSector: "",
  authorizedFlowRate: "",
  authorizedVolume: "",
  casId: "",
  catchmentStatus: "",
  centroControlRut: "",
  codigoObra: "",
  datum: "",
  fieldContactEmail: "",
  fieldContactPhone: "",
  fieldContactRepresentative: "",
  flowmeterBrand: "",
  flowmeterDiameter: "",
  flowmeterInstallationDate: "",
  flowmeterModel: "",
  habilitationDiameter: "",
  huso: "",
  lat: "",
  levelProbeBrand: "",
  levelProbeDiameter: "",
  levelProbeInstallationDate: "",
  levelProbeInstallationDepth: "",
  locationReference: "",
  lng: "",
  name: "",
  observations: "",
  ownerContacts: [emptyOwnerContact()],
  provider: "",
  pumpDepth: "",
  shac: "",
  shacSubsector: "",
  telemetryEnabled: "",
  utmEasting: "",
  utmNorthing: "",
  waterRights: [emptyWaterRight()],
  wellDepth: "",
});

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

const buildWellRegistryPayload = (
  form: WellRegistryFormState,
): { error: string } | { payload: CreateWellRegistryEntryPayload } => {
  const workCode = form.codigoObra.trim();
  if (!/^OB-\d{4}-[1-9]\d*$/.test(workCode) || !form.casId) {
    return {
      error: !form.casId
        ? "Debes seleccionar una CAS válida."
        : "Código de obra inválido. Usa el formato OB-0101-11.",
    };
  }

  const lat = Number.parseFloat(form.lat);
  const lng = Number.parseFloat(form.lng);
  const authorizedFlowRate =
    form.authorizedFlowRate.trim() === ""
      ? null
      : Number.parseFloat(form.authorizedFlowRate);
  const authorizedVolume = parseOptionalMetadataNumber(form.authorizedVolume);
  const wellDepth = parseOptionalMetadataNumber(form.wellDepth);
  const pumpDepth = parseOptionalMetadataNumber(form.pumpDepth);
  const habilitationDiameter = parseOptionalMetadataNumber(form.habilitationDiameter);
  const flowmeterDiameter = parseOptionalMetadataNumber(form.flowmeterDiameter);
  const levelProbeDiameter = parseOptionalMetadataNumber(form.levelProbeDiameter);
  const levelProbeInstallationDepth = parseOptionalMetadataNumber(
    form.levelProbeInstallationDepth,
  );
  const utmEasting = parseOptionalMetadataNumber(form.utmEasting);
  const utmNorthing = parseOptionalMetadataNumber(form.utmNorthing);
  const waterRights = form.waterRights
    .map((right) => ({
      anio: right.anio.trim() === "" ? null : Number.parseInt(right.anio, 10),
      cbr: right.cbr.trim() || null,
      fojas: right.fojas.trim() || null,
      numero: right.numero.trim() || null,
    }))
    .filter((right) =>
      right.fojas !== null ||
      right.numero !== null ||
      right.anio !== null ||
      right.cbr !== null
    );
  const ownerContacts = form.ownerContacts
    .map((contact) => ({
      email: contact.email.trim() || null,
      phone: contact.phone.trim() || null,
      representative: contact.representative.trim() || null,
      rut: contact.rut.trim() || null,
    }))
    .filter((contact) =>
      contact.representative !== null ||
      contact.rut !== null ||
      contact.phone !== null ||
      contact.email !== null
    );
  const invalidMetadataNumber = [
    ["Caudal autorizado", authorizedFlowRate],
    ["Volumen autorizado", authorizedVolume],
    ["Profundidad pozo", wellDepth],
    ["Profundidad bomba", pumpDepth],
    ["Diámetro habilitación", habilitationDiameter],
    ["Diámetro caudalímetro", flowmeterDiameter],
    ["Diámetro sonda de nivel", levelProbeDiameter],
    ["Profundidad instalación sonda de nivel", levelProbeInstallationDepth],
    ["UTM Este", utmEasting],
    ["UTM Norte", utmNorthing],
  ].find(([, value]) => typeof value === "number" && (!Number.isFinite(value) || value < 0));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { error: "Latitud y longitud deben ser números válidos." };
  }
  if (invalidMetadataNumber) {
    return { error: `${invalidMetadataNumber[0]} debe ser un número positivo.` };
  }
  if (waterRights.some((right) => right.anio !== null && !Number.isFinite(right.anio))) {
    return { error: "Año de derecho de aprovechamiento debe ser un número válido." };
  }

  return {
    payload: {
      casId: form.casId,
      codigoObra: workCode,
      lat,
      lng,
      name: form.name,
      provider: form.provider || null,
      centroControlRut: form.centroControlRut || null,
      catchmentStatus: toCatchmentStatus(form.catchmentStatus),
      aquiferSector: form.aquiferSector || null,
      authorizedFlowRate: authorizedFlowRate === null ? null : authorizedFlowRate.toFixed(2),
      authorizedVolume: authorizedVolume === null ? null : authorizedVolume.toFixed(2),
      wellDepth: wellDepth === null ? null : wellDepth.toFixed(2),
      pumpDepth: pumpDepth === null ? null : pumpDepth.toFixed(2),
      habilitationDiameter:
        habilitationDiameter === null ? null : habilitationDiameter.toFixed(2),
      flowmeterDiameter: flowmeterDiameter === null ? null : flowmeterDiameter.toFixed(2),
      flowmeterBrand: form.flowmeterBrand || null,
      flowmeterModel: form.flowmeterModel || null,
      flowmeterInstallationDate: form.flowmeterInstallationDate || null,
      ownerContacts,
      fieldContactRepresentative: form.fieldContactRepresentative || null,
      fieldContactPhone: form.fieldContactPhone || null,
      fieldContactEmail: form.fieldContactEmail || null,
      levelProbeDiameter: levelProbeDiameter === null ? null : levelProbeDiameter.toFixed(2),
      levelProbeBrand: form.levelProbeBrand || null,
      levelProbeInstallationDate: form.levelProbeInstallationDate || null,
      levelProbeInstallationDepth:
        levelProbeInstallationDepth === null
          ? null
          : levelProbeInstallationDepth.toFixed(2),
      telemetryEnabled:
        form.telemetryEnabled === "" ? null : form.telemetryEnabled === "true",
      observations: form.observations || null,
      huso: form.huso || null,
      datum: form.datum || null,
      locationReference: form.locationReference || null,
      shac: form.shac || null,
      shacSubsector: form.shacSubsector || null,
      utmEasting: utmEasting === null ? null : utmEasting.toFixed(2),
      utmNorthing: utmNorthing === null ? null : utmNorthing.toFixed(2),
      waterRights,
    },
  };
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
  const [wellRegistryForm, setWellRegistryForm] =
    useState<WellRegistryFormState>(emptyWellRegistryForm);
  const [wellMeasurementForm, setWellMeasurementForm] =
    useState<WellMeasurementFormState>({
      codigoObra: "",
      companyRut: "",
      conductivity: "",
      flowRate: "",
      isOperating: "",
      measurementDate: new Date().toISOString().slice(0, 10),
      measurementTime: "10:00",
      observations: "",
      ph: "",
      pressure: "",
      totalizer: "",
      userRut: "",
      waterTableDepth: "",
      waterLevelCondition: "",
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
    const result = buildWellRegistryPayload(wellRegistryForm);
    if ("error" in result) {
      setWellRegistryStatus("error");
      setWellRegistryMessage(result.error);
      return;
    }

    setWellRegistryStatus("loading");
    setWellRegistryMessage(null);
    try {
      const created = await createWellRegistryEntry(authIdToken, result.payload);
      await registryQuery.refetch();
      setWellRegistryForm((previous) => ({
        ...emptyWellRegistryForm(),
        casId: previous.casId,
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

  const handleWellRegistryUpdate = async (
    wellId: string,
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!authIdToken) return;
    const result = buildWellRegistryPayload(wellRegistryForm);
    if ("error" in result) {
      setWellRegistryStatus("error");
      setWellRegistryMessage(result.error);
      return;
    }

    setWellRegistryStatus("loading");
    setWellRegistryMessage(null);
    try {
      const updated = await updateWellRegistryEntry(authIdToken, wellId, result.payload);
      await registryQuery.refetch();
      await refreshWells();
      setWellRegistryStatus("ready");
      setWellRegistryMessage(`Pozo ${updated.name} (${updated.codigoObra}) actualizado.`);
    } catch (error) {
      setWellRegistryStatus("error");
      setWellRegistryMessage(getWellCreationErrorMessage(error));
    }
  };

  const handleWellRegistryDelete = async (wellId: string) => {
    if (!authIdToken) return;
    setWellRegistryStatus("loading");
    setWellRegistryMessage(null);
    try {
      await deleteWellRegistryEntry(authIdToken, wellId);
      await registryQuery.refetch();
      await refreshWells();
      setWellRegistryForm(emptyWellRegistryForm());
      setWellRegistryStatus("ready");
      setWellRegistryMessage("Pozo eliminado del registro activo.");
    } catch (error) {
      setWellRegistryStatus("error");
      setWellRegistryMessage(toRemoteErrorMessage(error, "No fue posible eliminar el pozo."));
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
        conductivity: wellMeasurementForm.conductivity || null,
        isOperating:
          wellMeasurementForm.isOperating === ""
            ? null
            : wellMeasurementForm.isOperating === "true",
        observations: wellMeasurementForm.observations || null,
        ph: wellMeasurementForm.ph || null,
        pressure: wellMeasurementForm.pressure || null,
        waterTableDepth: wellMeasurementForm.waterTableDepth || null,
        waterLevelCondition: toWaterLevelCondition(wellMeasurementForm.waterLevelCondition),
      });
      const nextWells = await refreshWells();
      if (nextWells.some((well) => well.id === wellMeasurementForm.codigoObra)) {
        setSelectedWellId(wellMeasurementForm.codigoObra);
      }
      setWellMeasurementStatus("ready");
      setWellMeasurementMessage("Medición guardada correctamente.");
      setWellMeasurementForm((previous) => ({
        ...previous,
        conductivity: "",
        flowRate: "",
        isOperating: "",
        observations: "",
        ph: "",
        pressure: "",
        totalizer: "",
        waterTableDepth: "",
        waterLevelCondition: "",
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
    handleWellRegistryDelete,
    handleWellRegistrySubmit,
    handleWellRegistryUpdate,
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
