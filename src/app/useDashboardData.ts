import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { LineSeries } from "../components/SimpleLineChart";
import {
  computeOverviewCards,
  etrLastUpdateIso,
  etrOverviewSeasonSeries,
  getFreshnessStatus,
  meteoStationPoints,
  snowLastUpdateIso,
  snowOverviewSeries,
  staleThresholdDaysDefault,
  type WellMapPoint,
} from "../data/mockupData";
import { queryKeys } from "../lib/queryKeys";
import { authQueryScope } from "../lib/queryClient";
import {
  fetchEtrSerieEt,
  fetchEtrStdAe,
  toEtrEtmaxSeries,
} from "../services/etrApi";
import {
  fetchModisSnowCoverageSeries,
} from "../services/modisSnowApi";
import { fetchHistory } from "../services/historyApi";
import { fetchWeatherStationPoints } from "../services/weatherStationsApi";
import type { RemoteLoadStatus } from "../types/remote";
import { toZonedDateTimeIso } from "../utils/date";
import { HISTORY_START } from "../utils/history";
import { buildSnowOverview } from "../features/overview/snowOverview";
import { toRemoteErrorMessage } from "./remoteError";

const toSummaryUpdateIso = (date: string, fallback: string) =>
  toZonedDateTimeIso(date) ?? fallback;

export function useDashboardData({
  authIdToken,
  hasAuthenticatedApiSession,
  now,
  wells,
}: {
  authIdToken: string | null;
  hasAuthenticatedApiSession: boolean;
  now: Date;
  wells: WellMapPoint[];
}) {
  const enabled = hasAuthenticatedApiSession;
  const [selectedStationId, setSelectedStationId] = useState(meteoStationPoints[0].id);
  const meteoQuery = useQuery({
    queryKey: queryKeys.meteo.snapshot(authIdToken),
    queryFn: () => fetchWeatherStationPoints(authIdToken!),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
  const etrSummaryQuery = useQuery({
    queryKey: queryKeys.etr.resource(authIdToken, "std-ae"),
    queryFn: () => fetchEtrStdAe(authIdToken!),
    enabled,
    staleTime: 30 * 60 * 1000,
  });
  const etrSeriesQuery = useQuery({
    queryKey: queryKeys.etr.resource(authIdToken, "serie-et"),
    queryFn: () => fetchEtrSerieEt(authIdToken!),
    enabled,
    staleTime: 30 * 60 * 1000,
  });
  const snowQuery = useQuery({
    queryKey: queryKeys.snow.coverage(authIdToken),
    queryFn: () => fetchModisSnowCoverageSeries(authIdToken!),
    enabled,
    staleTime: 30 * 60 * 1000,
  });
  const snowHistoryQuery = useQuery({
    queryKey: ["history", authQueryScope(authIdToken), "modis-snow", "ae", "snow-overview"],
    queryFn: ({ signal }) => fetchHistory("modis-snow", {
      area: "ae", start_date: HISTORY_START, end_date: new Date().toISOString().slice(0, 10),
      resolution: "native", max_points: 5000,
    }, authIdToken, signal, "all"),
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const stationData = enabled ? (meteoQuery.data ?? []) : meteoStationPoints;
  const stations = useMemo(
    () =>
      stationData.map((station) => ({
        ...station,
        status: getFreshnessStatus(station.lastUpdate, now, staleThresholdDaysDefault),
      })),
    [now, stationData],
  );
  const meteoStatus: RemoteLoadStatus = !enabled
    ? "idle"
    : meteoQuery.isPending
      ? "loading"
      : (meteoQuery.isError && !meteoQuery.data) || stations.length === 0
        ? "error"
        : "ready";
  const meteoErrorMessage = (meteoQuery.isError && !meteoQuery.data)
    ? toRemoteErrorMessage(meteoQuery.error, "No fue posible cargar datos reales de meteo.")
    : meteoQuery.isSuccess && stations.length === 0
      ? "La API respondió sin estaciones meteorológicas."
      : null;

  const etrSummary = etrSummaryQuery.data ?? etrSeriesQuery.data?.at(-1);
  const etrOverviewSummary = enabled
    ? etrSummary
      ? {
          lastDate: etrSummary.fecha,
          meanValue: etrSummary.etr ?? 0,
        }
      : { lastDate: "Sin datos", meanValue: 0 }
    : { lastDate: "2025-10-09", meanValue: 1.2 };
  const etrOverviewSeries: LineSeries[] = useMemo(() => enabled
    ? etrSeriesQuery.data
      ? toEtrEtmaxSeries(etrSeriesQuery.data)
      : []
    : etrOverviewSeasonSeries, [enabled, etrSeriesQuery.data]);
  const etrFailure = (!etrSummary && etrSummaryQuery.error) || (!etrSeriesQuery.data && etrSeriesQuery.error);
  const etrErrorMessage = etrFailure
    ? toRemoteErrorMessage(etrFailure, "No fue posible cargar ET-LAT.")
    : null;

  const snowOverview = useMemo(() => enabled
    ? buildSnowOverview(snowHistoryQuery.data, snowQuery.data?.ae)
    : { lastDate: snowLastUpdateIso, series: snowOverviewSeries },
  [enabled, snowHistoryQuery.data, snowQuery.data]);
  const snowOverviewSeriesForSummary: LineSeries[] = snowOverview.series;
  const snowLoading = enabled && !snowOverview.lastDate && (snowQuery.isPending || snowHistoryQuery.isPending);
  const snowFailure = !snowLoading && !snowOverview.lastDate && (snowHistoryQuery.error || snowQuery.error);
  const snowErrorMessage = snowFailure
    ? toRemoteErrorMessage(
        snowFailure,
        "No fue posible cargar datos reales de MODIS Snow.",
      )
    : null;

  useEffect(() => {
    if (stations.length && !stations.some((station) => station.id === selectedStationId)) {
      setSelectedStationId(stations[0].id);
    }
  }, [selectedStationId, stations]);

  const overviewCards = useMemo(() => {
    return computeOverviewCards({
      etrLastDate: etrOverviewSummary.lastDate,
      etrLastUpdate: enabled
        ? toSummaryUpdateIso(etrOverviewSummary.lastDate, "")
        : etrLastUpdateIso,
      etrMeanValue: etrOverviewSummary.meanValue,
      meteoStatus,
      now,
      snowLastUpdate: enabled
        ? snowOverview.lastDate ? toSummaryUpdateIso(snowOverview.lastDate, "") : ""
        : snowLastUpdateIso,
      snowSeries: snowOverviewSeriesForSummary,
      stations,
      wells,
    });
  }, [
    enabled,
    etrOverviewSummary,
    meteoStatus,
    now,
    snowOverviewSeriesForSummary,
    snowOverview.lastDate,
    stations,
    wells,
  ]);

  return {
    etrStatus: (enabled && etrSeriesQuery.isPending ? "loading" : etrFailure ? "error" : "ready") as RemoteLoadStatus,
    snowStatus: (snowLoading ? "loading" : snowErrorMessage ? "error" : "ready") as RemoteLoadStatus,
    etrErrorMessage,
    etrOverviewSeries,
    meteoErrorMessage,
    meteoStatus,
    retryMeteo: () => meteoQuery.refetch(),
    overviewCards,
    selectedStationId,
    setSelectedStationId,
    snowErrorMessage,
    snowOverviewSeriesForSummary,
    stations,
  };
}
