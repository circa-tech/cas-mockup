import {
  Droplets,
  Gauge,
  Info,
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
  { label: "Imagen satelital más reciente", value: "Cargando..." },
  { label: "Consumo real (ETR)", value: "Cargando..." },
  { label: "Consumo máximo (ETmax)", value: "Cargando..." },
];

const etrUnavailableStats = [
  { label: "Imagen satelital más reciente", value: "Sin datos" },
  { label: "Consumo real (ETR)", value: "Sin datos" },
  { label: "Consumo máximo (ETmax)", value: "Sin datos" },
];

const formatEtrDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const parts = new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((datePart) => datePart.type === type)?.value ?? "";

  return `${part("day")} ${part("month").replace(/\.$/, "")} ${part("year")}`;
};


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
  const enabled = isLoggedIn;
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
          { label: "Imagen satelital más reciente", value: formatEtrDate(summary.fecha) },
          {
            label: "Consumo real (ETR)",
            value: `${(summary.etr ?? 0).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mm/día`,
          },
          {
            label: "Consumo máximo (ETmax)",
            value: `${(summary.etmax ?? 0).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mm/día`,
          },
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
      : (overviewQuery.isError && !overviewQuery.data)
        ? "error"
        : "ready";
  const selectedSectorStatus = !enabled
    ? "idle"
    : sectorQuery.isPending
      ? "loading"
      : (sectorQuery.isError && !sectorQuery.data)
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
  const hasLatestEtrDate = /^\d{1,2} [a-z.]+ \d{4}$/i.test(statsForCards[0].value);
  const overviewDateLabel = hasLatestEtrDate ? statsForCards[0].value : null;
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
          note={hasLatestEtrDate ? "Próxima en ~7 días" : undefined}
          noteTone="neutral"
        />
        <KpiCard
          delayMs={80}
          icon={Droplets}
          title={statsForCards[1].label}
          value={statsForCards[1].value}
          note="Consumo promedio real"
          noteTone="neutral"
        />
        <KpiCard
          delayMs={160}
          icon={MapPinned}
          title={statsForCards[2].label}
          value={statsForCards[2].value}
          note="Lo que consumirían sin falta de agua"
          noteTone="neutral"
        />
      </div>

      <h3 className="etr-block-heading">Todo el valle</h3>
      <div className="etr-summary-grid">
        <Panel
          title={`Consumo por tipo de cultivo${overviewDateLabel ? ` · ${overviewDateLabel}` : ""}`}
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
          title="Consumo durante la temporada (mm/día)"
        >
          {showOverviewData ? (
            <SimpleLineChart
              labelEvery={3}
              maxValue={1.8}
              minValue={0}
              series={overviewSeasonSeries}
              unit="mm/día"
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

      <div className="etr-block-heading-row">
        <h3 className="etr-block-heading">Detalle por sector: elige un sector en el mapa</h3>
        <span
          className="etr-block-tooltip"
          title="Áreas en que se divide el valle para comparar el consumo de agua entre zonas. Toca una para ver su detalle."
          aria-label="Información sobre los sectores del valle"
        >
          <Info aria-hidden="true" size={16} />
        </span>
      </div>
      <div className="etr-top-grid">
        <Panel
          className="panel-etr-map"
          title="Sectores del valle"
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
          title={`Consumo por tipo de cultivo en ${selectedSector.sectorName}`}
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
        title={`Consumo durante la temporada en ${selectedSector.sectorName}`}
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
