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
import {
  fetchEtrSerieEt,
  fetchEtrStdAe,
  toEtrEtmaxSeries,
} from "../services/etrApi";
import {
  fetchModisSnowCoverageSeries,
  toModisSnowLineSeries,
} from "../services/modisSnowApi";
import { fetchWeatherStationPoints } from "../services/weatherStationsApi";
import type { RemoteLoadStatus } from "../types/remote";
import { toZonedDateTimeIso } from "../utils/date";
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
  const enabled = hasAuthenticatedApiSession && Boolean(authIdToken);
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
      : meteoQuery.isError || stations.length === 0
        ? "error"
        : "ready";
  const meteoErrorMessage = meteoQuery.isError
    ? toRemoteErrorMessage(meteoQuery.error, "No fue posible cargar datos reales de meteo.")
    : meteoQuery.isSuccess && stations.length === 0
      ? "La API respondió sin estaciones meteorológicas."
      : null;

  const etrOverviewSummary = enabled
    ? etrSummaryQuery.data
      ? {
          lastDate: etrSummaryQuery.data.fecha,
          meanValue: etrSummaryQuery.data.etr ?? 0,
        }
      : { lastDate: "Sin datos", meanValue: 0 }
    : { lastDate: "2025-10-09", meanValue: 1.2 };
  const etrOverviewSeries: LineSeries[] = enabled
    ? etrSeriesQuery.data
      ? toEtrEtmaxSeries(etrSeriesQuery.data)
      : []
    : etrOverviewSeasonSeries;
  const etrFailure = etrSummaryQuery.error ?? etrSeriesQuery.error;
  const etrErrorMessage = etrFailure
    ? toRemoteErrorMessage(etrFailure, "No fue posible cargar ET-LAT.")
    : null;

  const snowOverviewSeriesForSummary: LineSeries[] = enabled
    ? snowQuery.data
      ? toModisSnowLineSeries(snowQuery.data.ae ?? [])
      : []
    : snowOverviewSeries;
  const snowErrorMessage = snowQuery.error
    ? toRemoteErrorMessage(
        snowQuery.error,
        "No fue posible cargar datos reales de MODIS Snow.",
      )
    : null;

  useEffect(() => {
    if (stations.length && !stations.some((station) => station.id === selectedStationId)) {
      setSelectedStationId(stations[0].id);
    }
  }, [selectedStationId, stations]);

  const overviewCards = useMemo(() => {
    const latestSnowDate = snowOverviewSeriesForSummary[0]?.points.at(-1)?.label;
    return computeOverviewCards({
      etrLastDate: etrOverviewSummary.lastDate,
      etrLastUpdate: enabled
        ? toSummaryUpdateIso(etrOverviewSummary.lastDate, etrLastUpdateIso)
        : etrLastUpdateIso,
      etrMeanValue: etrOverviewSummary.meanValue,
      meteoStatus,
      now,
      snowLastUpdate:
        enabled && latestSnowDate
          ? toSummaryUpdateIso(latestSnowDate, snowLastUpdateIso)
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
    stations,
    wells,
  ]);

  return {
    etrErrorMessage,
    etrOverviewSeries,
    meteoErrorMessage,
    meteoStatus,
    overviewCards,
    selectedStationId,
    setSelectedStationId,
    snowErrorMessage,
    snowOverviewSeriesForSummary,
    stations,
  };
}
