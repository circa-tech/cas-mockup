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
  fetchModisSnowLatestImage,
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
  const enabled = isLoggedIn;
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
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!imageQuery.data?.blob) { setImageUrl(null); return; }
    const url = URL.createObjectURL(imageQuery.data.blob);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageQuery.data?.blob]);
  const latestSnowImage = imageQuery.data
    ? {
        bounds: imageQuery.data.bounds,
        crs: imageQuery.data.crs,
        date: imageQuery.data.imageDate,
        url: imageUrl,
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

  const imageStatus = !enabled
    ? "idle"
    : imageQuery.isPending
      ? "loading"
      : (imageQuery.isError && !imageQuery.data)
        ? "error"
        : "ready";
  const basinsStatus = !enabled
    ? "idle"
    : basinsQuery.isPending
      ? "loading"
      : (basinsQuery.isError && !basinsQuery.data)
        ? "error"
        : "ready";
  const imageTone = (imageQuery.isError && !imageQuery.data) ? "error" : "loading";
  const basinsTone = (basinsQuery.isError && !basinsQuery.data) ? "error" : "loading";

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
          Cobertura de nieve
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSnowTab === "balance"}
          className={activeSnowTab === "balance" ? "is-active" : ""}
          onClick={() => setActiveSnowTab("balance")}
        >
          Balance de nieve
        </button>
      </div>

      {activeSnowTab === "coverage" && (
        <SnowCoverageTab
          authIdToken={authIdToken}
          basinsGeoJson={basinsGeoJson}
          basinsStatus={basinsStatus}
          basinsTone={basinsTone}
          imageStatus={imageStatus}
          imageTone={imageTone}
          isLoggedIn={isLoggedIn}
          jorqueraSeries={snowJorqueraSeries}
          latestSnowImage={latestSnowImage}
          manflasSeries={snowManflasSeries}
          overviewSeries={snowOverviewSeries}
          pulidoSeries={snowPulidoSeries}
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
