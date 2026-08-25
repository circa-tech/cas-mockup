import {
  Droplets,
  Gauge,
  MapPinned,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { lazy, useMemo, useState } from "react";
import { KpiCard } from "../../components/KpiCard";
import { Panel } from "../../components/Panel";
import { RemoteDataState } from "../../components/RemoteDataState";
import { SimpleBarChart } from "../../components/SimpleBarChart";
import { SimpleLineChart } from "../../components/SimpleLineChart";
import {
  etrOverviewBarGroups,
  etrOverviewSeasonSeries,
  etrRegions,
  etrStats
} from "../../data/mockupData";
import { queryKeys } from "../../lib/queryKeys";
import {
  fetchEtrCult,
  fetchEtrSectorMap,
  fetchEtrSerieEt,
  fetchEtrStdAe,
  toEtrBarGroups,
  toEtrEtmaxSeries
} from "../../services/etrApi";
import {
  type EtrSectorSelection
} from "./mapSelections";

const EtrMap = lazy(() =>
  import("./EtrMap").then((module) => ({ default: module.EtrMap })),
);
const etrLoadingStats = [
  { label: "Última fecha disponible", value: "Cargando..." },
  { label: "ETR media", value: "Cargando..." },
  { label: "ETMAX media", value: "Cargando..." },
];

const etrUnavailableStats = [
  { label: "Última fecha disponible", value: "Sin datos" },
  { label: "ETR media", value: "Sin datos" },
  { label: "ETMAX media", value: "Sin datos" },
];


const defaultEtrSectorSelection: EtrSectorSelection = {
  sectorId: "19",
  sectorName: "Aguas arriba Embalse Lautaro",
  regionId: "valle-bajo",
  regionLabel: "Valle bajo",
};

const getSectorSeed = (sectorId: string) => {
  const parsed = Number.parseInt(sectorId, 10);
  return Number.isNaN(parsed) ? 1 : parsed;
};

const buildSectorBarGroups = (sectorId: string, baseGroups: typeof etrOverviewBarGroups) => {
  const seed = getSectorSeed(sectorId);

  return baseGroups.map((group, groupIndex) => ({
    ...group,
    series: group.series.map((series, seriesIndex) => {
      const factor = 0.88 + ((seed * 13 + groupIndex * 7 + seriesIndex * 11) % 30) / 100;
      const bias = seriesIndex === 0 ? -0.25 : 0.25;
      const value = Math.max(0.2, Number((series.value * factor + bias).toFixed(1)));
      return {
        ...series,
        value,
      };
    }),
  }));
};

const buildSectorSeasonSeries = (
  sectorId: string,
  baseSeries: typeof etrOverviewSeasonSeries,
) => {
  const seed = getSectorSeed(sectorId);

  return baseSeries.map((series, seriesIndex) => ({
    ...series,
    points: series.points.map((point, index) => {
      const wave = (((seed + index * 3 + seriesIndex * 5) % 9) - 4) * 0.02;
      const drift = ((seed % 5) - 2) * 0.01;
      return {
        ...point,
        value: Math.max(0, Number((point.value + wave + drift).toFixed(2))),
      };
    }),
  }));
};

const getBarGroupsMaxValue = (groups: ReturnType<typeof toEtrBarGroups>, fallback: number) => {
  const values = groups.flatMap((group) => group.series.map((series) => series.value));
  if (values.length === 0) {
    return fallback;
  }

  return Math.max(fallback, Math.ceil(Math.max(...values) / 5) * 5);
};


export function EtrSectorTab({
  authIdToken,
  isLoggedIn,
}: {
  authIdToken: string | null;
  isLoggedIn: boolean;
}) {
  const [selectedSector, setSelectedSector] = useState<EtrSectorSelection>(
    defaultEtrSectorSelection,
  );
  const selectedRegion = useMemo(
    () => etrRegions.find((region) => region.id === selectedSector.regionId) ?? etrRegions[0],
    [selectedSector.regionId],
  );
  const enabled = isLoggedIn && Boolean(authIdToken);
  const overviewQuery = useQuery({
    queryKey: queryKeys.etr.resource(authIdToken, "sector-overview"),
    queryFn: async () => {
      const [summary, series, crops, map] = await Promise.all([
        fetchEtrStdAe(authIdToken!),
        fetchEtrSerieEt(authIdToken!),
        fetchEtrCult(authIdToken!),
        fetchEtrSectorMap(authIdToken!),
      ]);
      return {
        barGroups: toEtrBarGroups(crops),
        map,
        seasonSeries: toEtrEtmaxSeries(series),
        stats: [
          { label: "Última fecha disponible", value: summary.fecha },
          { label: "ETR media", value: `${(summary.etr ?? 0).toFixed(1)} mm/día` },
          { label: "ETMAX media", value: `${(summary.etmax ?? 0).toFixed(1)} mm/día` },
        ],
      };
    },
    enabled,
    staleTime: 30 * 60 * 1000,
  });
  const sectorQuery = useQuery({
    queryKey: queryKeys.etr.resource(authIdToken, "sector-detail", {
      sectorId: selectedSector.sectorId,
    }),
    queryFn: async () => {
      const [crops, series] = await Promise.all([
        fetchEtrCult(authIdToken!, selectedSector.sectorId),
        fetchEtrSerieEt(authIdToken!, selectedSector.sectorId),
      ]);
      return {
        barGroups: toEtrBarGroups(crops),
        seasonSeries: toEtrEtmaxSeries(series),
      };
    },
    enabled,
    staleTime: 30 * 60 * 1000,
  });
  const overviewStatus = !enabled
    ? "idle"
    : overviewQuery.isPending
      ? "loading"
      : overviewQuery.isError
        ? "error"
        : "ready";
  const selectedSectorStatus = !enabled
    ? "idle"
    : sectorQuery.isPending
      ? "loading"
      : sectorQuery.isError
        ? "error"
        : "ready";
  const stats = enabled ? (overviewQuery.data?.stats ?? etrLoadingStats) : etrStats;
  const overviewBarGroups = enabled
    ? (overviewQuery.data?.barGroups ?? [])
    : etrOverviewBarGroups;
  const overviewSeasonSeries = enabled
    ? (overviewQuery.data?.seasonSeries ?? [])
    : etrOverviewSeasonSeries;
  const sectorMapData = overviewQuery.data?.map ?? null;
  const selectedSectorBarGroups = enabled
    ? (sectorQuery.data?.barGroups ?? [])
    : buildSectorBarGroups(selectedSector.sectorId, selectedRegion.barGroups);
  const selectedSectorSeasonSeries = enabled
    ? (sectorQuery.data?.seasonSeries ?? [])
    : buildSectorSeasonSeries(selectedSector.sectorId, selectedRegion.seasonSeries);
  const overviewBarMaxValue = useMemo(
    () => getBarGroupsMaxValue(overviewBarGroups, 25),
    [overviewBarGroups],
  );
  const selectedBarMaxValue = useMemo(
    () => getBarGroupsMaxValue(selectedSectorBarGroups, 35),
    [selectedSectorBarGroups],
  );
  const selectedSeasonMax = useMemo(() => {
    const max = Math.max(
      ...selectedSectorSeasonSeries.flatMap((series) =>
        series.points.map((point) => point.value),
      ),
    );
    return Math.max(1.8, Math.ceil(max * 10) / 10);
  }, [selectedSectorSeasonSeries]);

  const statsForCards = isLoggedIn
    ? overviewStatus === "ready"
      ? stats
      : overviewStatus === "error"
        ? etrUnavailableStats
        : etrLoadingStats
    : stats;
  const showOverviewData = !isLoggedIn || overviewStatus === "ready";
  const showSelectedSectorData = !isLoggedIn || selectedSectorStatus === "ready";
  const overviewStateTone = overviewStatus === "error" ? "error" : "loading";
  const selectedStateTone = selectedSectorStatus === "error" ? "error" : "loading";

  return (
    <div className="view-stack">
      <div className="stat-grid">
        <KpiCard
          delayMs={0}
          icon={Gauge}
          title={statsForCards[0].label}
          value={statsForCards[0].value}
          note="Disponibilidad ET-LAT"
          noteTone="neutral"
        />
        <KpiCard
          delayMs={80}
          icon={Droplets}
          title={statsForCards[1].label}
          value={statsForCards[1].value}
          note="Balance hídrico base"
          noteTone="positive"
        />
        <KpiCard
          delayMs={160}
          icon={MapPinned}
          title={statsForCards[2].label}
          value={statsForCards[2].value}
          note="Potencial atmosférico"
          noteTone="neutral"
        />
      </div>

      <div className="etr-summary-grid">
        <Panel
          title="Distribución de ETR (mm) por clase de cultivo en la última fecha disponible"
        >
          {showOverviewData ? (
            <SimpleBarChart
              chartHeight={338}
              groups={overviewBarGroups}
              maxValue={overviewBarMaxValue}
              tickStep={5}
              unit="mm"
              xLabelAngle={-18}
            />
          ) : (
            <RemoteDataState
              className="is-chart"
              title={overviewStateTone === "error" ? "No se pudo cargar ET-LAT" : "Cargando ET-LAT"}
              message={
                overviewStateTone === "error"
                  ? "El servicio no respondió con datos reales para el resumen por sector."
                  : "Consultando el servicio en GCP para evitar mostrar datos de mockup."
              }
              tone={overviewStateTone}
            />
          )}
        </Panel>

        <Panel
          title="Comportamiento de ETR y ETmax en la temporada (mm)"
        >
          {showOverviewData ? (
            <SimpleLineChart
              labelEvery={3}
              maxValue={1.8}
              minValue={0}
              series={overviewSeasonSeries}
              unit="mm"
              xLabelAngle={-45}
            />
          ) : (
            <RemoteDataState
              className="is-chart"
              title={overviewStateTone === "error" ? "No se pudo cargar ET-LAT" : "Cargando ET-LAT"}
              message={
                overviewStateTone === "error"
                  ? "El servicio no respondió con la serie real de temporada."
                  : "Esperando la serie real de ETR y ETmax desde GCP."
              }
              tone={overviewStateTone}
            />
          )}
        </Panel>
      </div>

      <div className="etr-top-grid">
        <Panel
          className="panel-etr-map"
          title="Mapa sectores y áreas de gestión CAS Copiapó"
        >
          {showOverviewData ? (
            <EtrMap
              geoJson={isLoggedIn ? sectorMapData ?? undefined : undefined}
              selectedSectorId={selectedSector.sectorId}
              selectedSummaryLabel={selectedSector.sectorName}
              onSelect={setSelectedSector}
            />
          ) : (
            <RemoteDataState
              className="is-map"
              title={overviewStateTone === "error" ? "Mapa no disponible" : "Cargando mapa ET-LAT"}
              message={
                overviewStateTone === "error"
                  ? "No se pudo obtener la geometría real de sectores desde GCP."
                  : "Esperando la geometría real de sectores."
              }
              tone={overviewStateTone}
            />
          )}
        </Panel>

        <Panel
          className="panel-etr-bar"
          title="Distribución de ETR (mm) por clase de cultivo en la última fecha disponible"
          subtitle={selectedSector.sectorName}
        >
          {showSelectedSectorData ? (
            <SimpleBarChart
              chartHeight="100%"
              groups={selectedSectorBarGroups}
              maxValue={selectedBarMaxValue}
              tickStep={5}
              unit="mm"
              xLabelAngle={-16}
            />
          ) : (
            <RemoteDataState
              className="is-chart"
              title={
                selectedStateTone === "error"
                  ? "No se pudo cargar el sector"
                  : "Cargando sector"
              }
              message={
                selectedStateTone === "error"
                  ? "El servicio no respondió con datos reales para el sector seleccionado."
                  : "Consultando datos reales para el sector seleccionado."
              }
              tone={selectedStateTone}
            />
          )}
        </Panel>
      </div>

      <Panel
        title="Variación temporal de la ETR y ETmax"
        subtitle={selectedSector.sectorName}
        className="panel-accent-blue"
      >
        {showSelectedSectorData ? (
          <SimpleLineChart
            labelEvery={2}
            maxValue={selectedSeasonMax}
            minValue={0}
            series={selectedSectorSeasonSeries}
            unit="mm"
            xLabelAngle={-45}
          />
        ) : (
          <RemoteDataState
            className="is-chart"
            title={
              selectedStateTone === "error"
                ? "No se pudo cargar la serie"
                : "Cargando serie del sector"
            }
            message={
              selectedStateTone === "error"
                ? "El servicio no respondió con la serie real para el sector seleccionado."
                : "Esperando la serie real de ETR y ETmax."
            }
            tone={selectedStateTone}
          />
        )}
      </Panel>
    </div>
  );
}
