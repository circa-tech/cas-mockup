import { useOfflineState } from "../../offline/state";
import { FormEvent, lazy, useEffect, useMemo, useState } from "react";
import { Panel } from "../../components/Panel";
import { RemoteDataState } from "../../components/RemoteDataState";
import {
  buildEtrDownloadFilename,
  EtrDownloadFormat,
  etrDownloadFormats,
  etrDownloadMonthLabels,
  EtrDownloadVariable,
  etrDownloadVariables,
  getEtrDownloadDays,
  getEtrDownloadMonths,
  getEtrDownloadYears
} from "../../data/mockupData";
import {
  fetchEtrDataCuad,
  fetchEtrDownCuad,
  fetchEtrDownCuadImageBlob,
  fetchEtrQuadrantMap,
} from "../../services/etrApi";
import type { RemoteLoadStatus } from "../../types/remote";
import { downloadMockQuadrantPng } from "../../utils/mockQuadrantExport";
import {
  defaultEtrQuadrantSelection,
  type EtrQuadrantSelection
} from "./mapSelections";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../lib/queryKeys";

const EtrQuadrantMap = lazy(() =>
  import("./EtrQuadrantMap").then((module) => ({
    default: module.EtrQuadrantMap,
  })),
);

export function EtrDownloadsTab({
  authIdToken,
  isLoggedIn,
}: {
  authIdToken: string | null;
  isLoggedIn: boolean;
}) {
  const offline = useOfflineState();
  const readOnly = !offline.online || offline.networkUnavailable || !authIdToken;
  const [selectedQuadrant, setSelectedQuadrant] = useState<EtrQuadrantSelection>(
    defaultEtrQuadrantSelection,
  );
  const [selectedVariable, setSelectedVariable] = useState<EtrDownloadVariable>("ETR");
  const [selectedFormat, setSelectedFormat] = useState<EtrDownloadFormat>("PNG");
  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedMonth, setSelectedMonth] = useState(1);
  const [selectedDay, setSelectedDay] = useState(1);
  const [downloadFeedback, setDownloadFeedback] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const fallbackYears = useMemo(
    () => getEtrDownloadYears(selectedQuadrant.quadrantId, selectedVariable),
    [selectedQuadrant.quadrantId, selectedVariable],
  );
  const fallbackMonths = useMemo(
    () =>
      getEtrDownloadMonths(
        selectedQuadrant.quadrantId,
        selectedVariable,
        selectedYear,
      ),
    [selectedQuadrant.quadrantId, selectedVariable, selectedYear],
  );
  const fallbackDays = useMemo(
    () =>
      getEtrDownloadDays(
        selectedQuadrant.quadrantId,
        selectedVariable,
        selectedYear,
        selectedMonth,
      ),
    [selectedQuadrant.quadrantId, selectedVariable, selectedYear, selectedMonth],
  );
  const enabled = isLoggedIn;
  const quadrantMapQuery = useQuery({
    queryKey: queryKeys.etr.resource(authIdToken, "mapa-cuadrantes"),
    queryFn: () => fetchEtrQuadrantMap(authIdToken!),
    enabled,
    staleTime: Infinity,
  });
  const yearsQuery = useQuery({
    queryKey: queryKeys.etr.resource(authIdToken, "download-years", {
      quadrantId: selectedQuadrant.quadrantId,
      variable: selectedVariable,
    }),
    queryFn: () =>
      fetchEtrDataCuad(authIdToken!, {
        quadrantId: selectedQuadrant.quadrantId,
        variable: selectedVariable,
      }),
    enabled,
    staleTime: 30 * 60 * 1000,
  });
  const monthsQuery = useQuery({
    queryKey: queryKeys.etr.resource(authIdToken, "download-months", {
      quadrantId: selectedQuadrant.quadrantId,
      variable: selectedVariable,
      year: selectedYear,
    }),
    queryFn: () =>
      fetchEtrDataCuad(authIdToken!, {
        quadrantId: selectedQuadrant.quadrantId,
        variable: selectedVariable,
        year: selectedYear,
      }),
    enabled: enabled && Boolean(yearsQuery.data?.anos.includes(selectedYear)),
    staleTime: 30 * 60 * 1000,
  });
  const daysQuery = useQuery({
    queryKey: queryKeys.etr.resource(authIdToken, "download-days", {
      month: selectedMonth,
      quadrantId: selectedQuadrant.quadrantId,
      variable: selectedVariable,
      year: selectedYear,
    }),
    queryFn: () =>
      fetchEtrDataCuad(authIdToken!, {
        month: selectedMonth,
        quadrantId: selectedQuadrant.quadrantId,
        variable: selectedVariable,
        year: selectedYear,
      }),
    enabled: enabled && Boolean(monthsQuery.data?.meses.includes(selectedMonth)),
    staleTime: 30 * 60 * 1000,
  });
  const quadrantMapData = quadrantMapQuery.data ?? null;
  const years = enabled ? (yearsQuery.data?.anos ?? []) : fallbackYears;
  const months = enabled ? (monthsQuery.data?.meses ?? []) : fallbackMonths;
  const days = enabled ? (daysQuery.data?.dias ?? []) : fallbackDays;
  const queryStatus = (query: {
    isError: boolean;
    isPending: boolean;
    isSuccess: boolean;
    data?: unknown;
  }): RemoteLoadStatus =>
    !enabled
      ? "idle"
      : query.isPending
        ? "loading"
        : query.isError && !query.data
          ? "error"
          : "ready";
  const quadrantMapStatus = queryStatus(quadrantMapQuery);
  const yearsStatus = queryStatus(yearsQuery);
  const monthsStatus = queryStatus(monthsQuery);
  const daysStatus = queryStatus(daysQuery);

  useEffect(() => {
    const latestYear = years.length > 0 ? Math.max(...years) : 2025;
    if (!years.includes(selectedYear)) {
      setSelectedYear(latestYear);
    }
  }, [selectedYear, years]);

  useEffect(() => {
    const latestMonth = months.length > 0 ? Math.max(...months) : 1;
    if (!months.includes(selectedMonth)) {
      setSelectedMonth(latestMonth);
    }
  }, [months, selectedMonth]);

  useEffect(() => {
    const latestDay = days.length > 0 ? Math.max(...days) : 1;
    if (!days.includes(selectedDay)) {
      setSelectedDay(latestDay);
    }
  }, [days, selectedDay]);

  const selectedMonthLabel =
    etrDownloadMonthLabels[selectedMonth - 1] ?? `Mes ${selectedMonth}`;
  const showQuadrantMapData = !isLoggedIn || quadrantMapStatus === "ready";
  const dateStatuses = [yearsStatus, monthsStatus, daysStatus];
  const datesHaveError =
    isLoggedIn && dateStatuses.some((status) => status === "error");
  const datesAreLoading =
    isLoggedIn &&
    !datesHaveError &&
    dateStatuses.some((status) => status !== "ready");
  const quadrantMapTone = quadrantMapStatus === "error" ? "error" : "loading";

  const handleFakeDownload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (readOnly) return;
    setIsDownloading(true);

    const filename = buildEtrDownloadFilename({
      day: selectedDay,
      format: selectedFormat,
      month: selectedMonth,
      quadrantId: selectedQuadrant.quadrantId,
      variable: selectedVariable,
      year: selectedYear,
    });
    try {
      if (selectedFormat === "PNG") {
        let overlayUrl: string | undefined;
        if (authIdToken) {
          const overlayBlob = await fetchEtrDownCuadImageBlob(authIdToken, {
            day: selectedDay,
            format: selectedFormat,
            month: selectedMonth,
            quadrantId: selectedQuadrant.quadrantId,
            variable: selectedVariable,
            year: selectedYear,
          });
          overlayUrl = URL.createObjectURL(overlayBlob);
        }

        try {
          await downloadMockQuadrantPng({
            filename,
            overlayUrl,
            quadrantId: selectedQuadrant.quadrantId,
          });
        } finally {
          if (overlayUrl) {
            URL.revokeObjectURL(overlayUrl);
          }
        }
        setDownloadFeedback(`Listo: se descargó ${filename}`);
        return;
      }

      if (authIdToken) {
        const response = await fetchEtrDownCuad(authIdToken, {
          day: selectedDay,
          format: selectedFormat,
          month: selectedMonth,
          quadrantId: selectedQuadrant.quadrantId,
          variable: selectedVariable,
          year: selectedYear,
        });
        if (!response.url) {
          throw new Error("El servicio no retornó una URL de descarga.");
        }
        window.location.assign(response.url);
        setDownloadFeedback(`Listo: se descargó ${filename}`);
        return;
      }
    } catch {
      setDownloadFeedback(
        "No pudimos generar el archivo. Prueba con otra fecha o inténtalo en unos minutos.",
      );
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="view-stack">
      <div className="etr-download-grid">
        <Panel className="panel-etr-map" title="1. Elige la zona">
          {showQuadrantMapData ? (
            <EtrQuadrantMap
              geoJson={isLoggedIn ? quadrantMapData ?? undefined : undefined}
              selectedQuadrantId={selectedQuadrant.quadrantId}
              selectedSummaryLabel={selectedQuadrant.quadrantLabel}
              onSelect={(selection) => {
                setSelectedQuadrant(selection);
                setDownloadFeedback("");
              }}
            />
          ) : (
            <RemoteDataState
              className="is-map"
              title={
                quadrantMapTone === "error"
                  ? "Zonas no disponibles"
                  : "Cargando zonas"
              }
              message={
                quadrantMapTone === "error"
                  ? "No se pudo obtener la grilla real de zonas desde GCP."
                  : "Esperando la grilla real de zonas."
              }
              tone={quadrantMapTone}
            />
          )}
        </Panel>

        <Panel
          title="Descarga de imágenes"
          subtitle={selectedQuadrant.quadrantLabel}
        >
          {datesAreLoading || datesHaveError ? (
            <RemoteDataState
              className="is-compact"
              title={datesHaveError ? "Fechas no disponibles" : "Cargando fechas"}
              message={
                datesHaveError
                  ? "No se pudo obtener la disponibilidad real para la descarga."
                  : "Consultando años, meses y días disponibles en GCP."
              }
              tone={datesHaveError ? "error" : "loading"}
            />
          ) : (
            <>
              <div className="etr-download-copy">
                <p>
                  Descarga el mapa de una zona para verlo o analizarlo en tu computador:
                  1) elige el cuadrado en el mapa, 2) elige variable, fecha y formato,
                  3) descarga.
                </p>
              </div>

              <form className="etr-download-form" onSubmit={handleFakeDownload}>
                <label>
                  <span>Variable</span>
                  <select
                    value={selectedVariable}
                    onChange={(event) =>
                      setSelectedVariable(event.target.value as EtrDownloadVariable)
                    }
                  >
                    {etrDownloadVariables.map((variable) => (
                      <option key={variable.value} value={variable.value}>
                        {variable.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Formato</span>
                  <select
                    value={selectedFormat}
                    onChange={(event) =>
                      setSelectedFormat(event.target.value as EtrDownloadFormat)
                    }
                  >
                    {etrDownloadFormats.map((format) => (
                      <option key={format.value} value={format.value}>
                        {format.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Año</span>
                  <select
                    value={selectedYear}
                    onChange={(event) => setSelectedYear(Number(event.target.value))}
                  >
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Mes</span>
                  <select
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(Number(event.target.value))}
                  >
                    {months.map((month) => (
                      <option key={month} value={month}>
                        {etrDownloadMonthLabels[month - 1] ?? `Mes ${month}`}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Día</span>
                  <select
                    value={selectedDay}
                    onChange={(event) => setSelectedDay(Number(event.target.value))}
                  >
                    {days.map((day) => (
                      <option key={day} value={day}>
                        {String(day).padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                </label>

                <button type="submit" disabled={readOnly || isDownloading}>
                  {isDownloading ? "Procesando..." : "Descargar"}
                </button>
              </form>

              <p className="etr-download-selected">
                Selección actual: {selectedQuadrant.quadrantLabel} · {selectedVariable} ·{" "}
                {selectedFormat} · {selectedYear} · {selectedMonthLabel} ·{" "}
                {String(selectedDay).padStart(2, "0")}
              </p>
              {downloadFeedback && (
                <p className="etr-download-feedback">{downloadFeedback}</p>
              )}
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
