import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  snowJorqueraSeries,
  snowManflasSeries,
  snowOverviewSeries,
  snowPulidoSeries,
} from "../../data/mockupData";
import {
  getSnowBalanceYears,
  snowBalanceLatestYear,
  type SnowBalanceBasinId,
} from "../../data/snowBalanceData";
import { queryKeys } from "../../lib/queryKeys";
import {
  fetchModisSnowBasinsGeoJson,
  fetchModisSnowCoverageSeries,
  fetchModisSnowLatestImage,
  toModisSnowLineSeries,
} from "../../services/modisSnowApi";
import { SnowBalanceTab } from "./SnowBalanceTab";
import { SnowCoverageTab } from "./SnowCoverageTab";

const snowBalanceBasins: SnowBalanceBasinId[] = ["jorquera", "pulido", "manflas"];

export function SnowView({
  authIdToken,
  isLoggedIn,
}: {
  authIdToken: string | null;
  isLoggedIn: boolean;
}) {
  const [activeSnowTab, setActiveSnowTab] = useState<"coverage" | "balance">("coverage");
  const enabled = isLoggedIn && Boolean(authIdToken);
  const coverageQuery = useQuery({
    queryKey: queryKeys.snow.coverage(authIdToken),
    queryFn: () => fetchModisSnowCoverageSeries(authIdToken!),
    enabled,
    staleTime: 30 * 60 * 1000,
  });
  const imageQuery = useQuery({
    queryKey: queryKeys.snow.image(authIdToken),
    queryFn: () => fetchModisSnowLatestImage(authIdToken!),
    enabled,
    staleTime: 30 * 60 * 1000,
  });
  const basinsQuery = useQuery({
    queryKey: queryKeys.snow.basins(authIdToken),
    queryFn: () => fetchModisSnowBasinsGeoJson(authIdToken!),
    enabled,
    staleTime: Infinity,
  });
  const overviewSeries = enabled
    ? toModisSnowLineSeries(coverageQuery.data?.ae ?? [])
    : snowOverviewSeries;
  const jorqueraSeries = enabled
    ? toModisSnowLineSeries(coverageQuery.data?.jorquera ?? [])
    : snowJorqueraSeries;
  const pulidoSeries = enabled
    ? toModisSnowLineSeries(coverageQuery.data?.pulido ?? [])
    : snowPulidoSeries;
  const manflasSeries = enabled
    ? toModisSnowLineSeries(coverageQuery.data?.manflas ?? [])
    : snowManflasSeries;
  const latestSnowImage = imageQuery.data
    ? {
        bounds: imageQuery.data.bounds,
        crs: imageQuery.data.crs,
        date: imageQuery.data.imageDate,
        url: imageQuery.data.objectUrl,
      }
    : { bounds: null, crs: null, date: null, url: null };
  const basinsGeoJson = basinsQuery.data ?? null;
  const availableBalanceYears = useMemo(() => {
    const [firstBasin, ...remainingBasins] = snowBalanceBasins;
    const firstYears = getSnowBalanceYears(firstBasin);

    return [...new Set(firstYears)]
      .filter((year) =>
        remainingBasins.every((basin) => getSnowBalanceYears(basin).includes(year)),
      )
      .sort((a, b) => b - a);
  }, []);
  const [selectedBalanceYear, setSelectedBalanceYear] = useState<number>(
    availableBalanceYears[0] ?? snowBalanceLatestYear,
  );

  useEffect(() => {
    if (availableBalanceYears.includes(selectedBalanceYear)) {
      return;
    }

    setSelectedBalanceYear(availableBalanceYears[0] ?? snowBalanceLatestYear);
  }, [availableBalanceYears, selectedBalanceYear]);

  const snowChartLabelEvery = Math.max(
    1,
    Math.ceil((overviewSeries[0]?.points.length ?? 0) / 8),
  );
  const imageStatus = !enabled
    ? "idle"
    : imageQuery.isPending
      ? "loading"
      : imageQuery.isError
        ? "error"
        : "ready";
  const basinsStatus = !enabled
    ? "idle"
    : basinsQuery.isPending
      ? "loading"
      : basinsQuery.isError
        ? "error"
        : "ready";
  const showSnowCharts = !isLoggedIn || coverageQuery.isSuccess;
  const snowChartsTone = coverageQuery.isError ? "error" : "loading";
  const imageTone = imageQuery.isError ? "error" : "loading";
  const basinsTone = basinsQuery.isError ? "error" : "loading";

  return (
    <div className="view-stack">
      <div className="view-intro">
        <h2>Sistema de Monitoreo de Cobertura Nival</h2>
      </div>

      <div className="snow-subnav" role="tablist" aria-label="Secciones de nieve">
        <button
          type="button"
          role="tab"
          aria-selected={activeSnowTab === "coverage"}
          className={activeSnowTab === "coverage" ? "is-active" : ""}
          onClick={() => setActiveSnowTab("coverage")}
        >
          Cobertura MODIS
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSnowTab === "balance"}
          className={activeSnowTab === "balance" ? "is-active" : ""}
          onClick={() => setActiveSnowTab("balance")}
        >
          Balance de Masas
        </button>
      </div>

      {activeSnowTab === "coverage" && (
        <SnowCoverageTab
          basinsGeoJson={basinsGeoJson}
          basinsStatus={basinsStatus}
          basinsTone={basinsTone}
          imageStatus={imageStatus}
          imageTone={imageTone}
          isLoggedIn={isLoggedIn}
          jorqueraSeries={jorqueraSeries}
          latestSnowImage={latestSnowImage}
          manflasSeries={manflasSeries}
          overviewSeries={overviewSeries}
          pulidoSeries={pulidoSeries}
          showSnowCharts={showSnowCharts}
          snowChartLabelEvery={snowChartLabelEvery}
          snowChartsTone={snowChartsTone}
        />
      )}

      {activeSnowTab === "balance" && (
        <SnowBalanceTab
          availableBalanceYears={availableBalanceYears}
          onSelectedBalanceYearChange={setSelectedBalanceYear}
          selectedBalanceYear={selectedBalanceYear}
        />
      )}
    </div>
  );
}
