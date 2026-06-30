import { useQuery } from "@tanstack/react-query";
import { lazy, useEffect, useMemo, useState } from "react";
import { Panel } from "../../components/Panel";
import { RemoteDataState } from "../../components/RemoteDataState";
import { SimpleLineChart, type LineSeries } from "../../components/SimpleLineChart";
import {
  chartPalette
} from "../../data/mockupData";
import { queryKeys } from "../../lib/queryKeys";
import {
  fetchEtrPoly,
  fetchEtrUsoMap,
  fetchKcPoly,
  fetchLaiPoly,
  toEtrEtmaxSeries,
  toSingleMetricSeries
} from "../../services/etrApi";
import {
  buildEtrUsoSelection,
  defaultEtrUsoMapSelection,
  type EtrUsoFeature,
  type EtrUsoSelection
} from "./mapSelections";

const EtrUsoMap = lazy(() =>
  import("./EtrUsoMap").then((module) => ({ default: module.EtrUsoMap })),
);



const getSeriesDomain = (
  series: LineSeries[],
  {
    clampMin = 0,
    minSpan = 0.2,
    padRatio = 0.12,
  }: { clampMin?: number; minSpan?: number; padRatio?: number; } = {},
) => {
  const values = series.flatMap((line) => line.points.map((point) => point.value));
  const min = values.length > 0 ? Math.min(...values) : clampMin;
  const max = values.length > 0 ? Math.max(...values) : clampMin + minSpan;
  const span = Math.max(minSpan, max - min);
  const lower = Math.max(clampMin, Number((min - span * padRatio).toFixed(2)));
  const upper = Number((max + span * padRatio).toFixed(2));
  return {
    max: Math.max(lower + minSpan, upper),
    min: lower,
  };
};

type EtrUsoRecord = {
  cultivo: string;
  etmaxValue: number;
  etrEtmaxSeries: LineSeries[];
  etrValue: number;
  kcSeries: LineSeries[];
  laiSeries: LineSeries[];
  lastDate: string;
};

const toUsoDisplayMetric = (rawValue: number) =>
  Number((rawValue * 0.1).toFixed(1));

const buildUsoDateLabels = (latestDate: string, total = 18) => {
  const parsed = new Date(`${latestDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return Array.from({ length: total }, (_, index) => `P-${total - index}`);
  }

  return Array.from({ length: total }, (_, index) => {
    const pointDate = new Date(parsed);
    pointDate.setDate(parsed.getDate() - (total - index - 1) * 8);
    return pointDate.toISOString().slice(0, 10);
  });
};

const buildUsageTrend = ({
  amplitude,
  baseline,
  floor,
  labels,
  seed,
}: {
  amplitude: number;
  baseline: number;
  floor: number;
  labels: string[];
  seed: number;
}) => {
  const total = labels.length;
  const values = labels.map((_, index) => {
    const progress = total <= 1 ? 1 : index / (total - 1);
    const trend = (progress - 0.5) * baseline * 0.2;
    const wave = Math.sin((index + seed * 0.11) / 2.6) * amplitude;
    const jitter = ((((seed * 19 + index * 7) % 7) - 3) * amplitude) / 12;
    return Math.max(floor, Number((baseline + trend + wave + jitter).toFixed(2)));
  });

  values[values.length - 1] = Number(baseline.toFixed(2));
  return values;
};

const buildEtrUsoRecordFromSelection = (selection: EtrUsoSelection): EtrUsoRecord => {
  const parsedSeed = Number.parseInt(selection.usoId, 10);
  const seed = Number.isNaN(parsedSeed) ? 1 : parsedSeed;
  const labels = buildUsoDateLabels(selection.date, 18);
  const etrValue = toUsoDisplayMetric(selection.etrRaw);
  const etmaxValue = toUsoDisplayMetric(selection.etmaxRaw);
  const kcValue = Math.max(
    0.2,
    Math.min(1.35, Number((etmaxValue > 0 ? etrValue / etmaxValue : 0.55).toFixed(2))),
  );
  const laiValue = Math.max(
    0.5,
    Math.min(
      5.8,
      Number((0.8 + kcValue * 3 + ((seed % 5) - 2) * 0.12).toFixed(2)),
    ),
  );

  const etrSeriesValues = buildUsageTrend({
    amplitude: Math.max(0.05, etrValue * 0.16),
    baseline: etrValue,
    floor: 0.02,
    labels,
    seed,
  });
  const etmaxSeriesValues = buildUsageTrend({
    amplitude: Math.max(0.07, etmaxValue * 0.14),
    baseline: etmaxValue,
    floor: 0.04,
    labels,
    seed: seed + 3,
  });
  const kcSeriesValues = buildUsageTrend({
    amplitude: Math.max(0.05, kcValue * 0.2),
    baseline: kcValue,
    floor: 0.05,
    labels,
    seed: seed + 7,
  });
  const laiSeriesValues = buildUsageTrend({
    amplitude: Math.max(0.1, laiValue * 0.16),
    baseline: laiValue,
    floor: 0.2,
    labels,
    seed: seed + 11,
  });

  return {
    cultivo: selection.cultivo,
    etmaxValue,
    etrEtmaxSeries: [
      {
        color: chartPalette.chart2,
        label: "ETR media",
        points: labels.map((label, index) => ({
          label,
          value: etrSeriesValues[index] ?? etrValue,
        })),
      },
      {
        color: chartPalette.chart4,
        label: "ETMAX media",
        points: labels.map((label, index) => ({
          label,
          value: etmaxSeriesValues[index] ?? etmaxValue,
        })),
      },
    ],
    etrValue,
    kcSeries: [
      {
        color: chartPalette.chart5,
        label: "Kc media",
        points: labels.map((label, index) => ({
          label,
          value: kcSeriesValues[index] ?? kcValue,
        })),
      },
    ],
    laiSeries: [
      {
        color: chartPalette.chart1,
        label: "LAI media",
        points: labels.map((label, index) => ({
          label,
          value: laiSeriesValues[index] ?? laiValue,
        })),
      },
    ],
    lastDate: selection.date,
  };
};


export function EtrUsageTab({
  authIdToken,
  isLoggedIn,
}: {
  authIdToken: string | null;
  isLoggedIn: boolean;
}) {
  const [selectedUso, setSelectedUso] = useState<EtrUsoSelection>(
    defaultEtrUsoMapSelection,
  );
  const fallbackUsageRecord = useMemo(
    () => buildEtrUsoRecordFromSelection(selectedUso),
    [selectedUso],
  );
  const enabled = isLoggedIn && Boolean(authIdToken);
  const mapQuery = useQuery({
    queryKey: queryKeys.etr.resource(authIdToken, "mapa-cult"),
    queryFn: () => fetchEtrUsoMap(authIdToken!),
    enabled,
    staleTime: Infinity,
  });
  const usageQuery = useQuery({
    queryKey: queryKeys.etr.resource(authIdToken, "usage-detail", {
      usoId: selectedUso.usoId,
    }),
    queryFn: async (): Promise<EtrUsoRecord> => {
      const [etPoly, kcPoly, laiPoly] = await Promise.all([
        fetchEtrPoly(authIdToken!, selectedUso.usoId),
        fetchKcPoly(authIdToken!, selectedUso.usoId),
        fetchLaiPoly(authIdToken!, selectedUso.usoId),
      ]);
      if (!etPoly.length) throw new Error("ET-LAT no entregó datos para el uso.");
      const lastEtPoint = etPoly.at(-1)!;
      return {
        cultivo: selectedUso.cultivo,
        etmaxValue: lastEtPoint.etmax ?? fallbackUsageRecord.etmaxValue,
        etrEtmaxSeries: toEtrEtmaxSeries(etPoly),
        etrValue: lastEtPoint.etr ?? fallbackUsageRecord.etrValue,
        kcSeries: toSingleMetricSeries(
          kcPoly.map((point) => ({ fecha: point.fecha, value: point.kc })),
          "Kc media",
          chartPalette.chart5,
        ),
        laiSeries: toSingleMetricSeries(
          laiPoly.map((point) => ({ fecha: point.fecha, value: point.lai })),
          "LAI media",
          chartPalette.chart1,
        ),
        lastDate: lastEtPoint.fecha,
      };
    },
    enabled: enabled && mapQuery.isSuccess && Boolean(selectedUso.usoId),
    staleTime: 30 * 60 * 1000,
  });
  const usoMapData = mapQuery.data ?? null;
  const usageRecord = usageQuery.data ?? fallbackUsageRecord;
  const mapStatus = !enabled
    ? "idle"
    : mapQuery.isPending
      ? "loading"
      : mapQuery.isError
        ? "error"
        : "ready";
  const usageStatus = !enabled
    ? "idle"
    : usageQuery.isPending
      ? "loading"
      : usageQuery.isError
        ? "error"
        : "ready";
  const etrEtmaxDomain = useMemo(
    () =>
      getSeriesDomain(usageRecord.etrEtmaxSeries, {
        clampMin: 0,
        minSpan: 0.35,
        padRatio: 0.16,
      }),
    [usageRecord.etrEtmaxSeries],
  );
  const kcDomain = useMemo(
    () =>
      getSeriesDomain(usageRecord.kcSeries, {
        clampMin: 0,
        minSpan: 0.2,
        padRatio: 0.14,
      }),
    [usageRecord.kcSeries],
  );
  const laiDomain = useMemo(
    () =>
      getSeriesDomain(usageRecord.laiSeries, {
        clampMin: 0,
        minSpan: 0.4,
        padRatio: 0.16,
      }),
    [usageRecord.laiSeries],
  );

  useEffect(() => {
    if (!mapQuery.data) return;
    const features = mapQuery.data.features as EtrUsoFeature[];
    const selectionExists = features.some(
      (feature) => String(feature.properties?.uso_id ?? feature.id) === selectedUso.usoId,
    );
    if (!selectionExists && features[0]) {
      setSelectedUso(buildEtrUsoSelection(features[0]));
    }
  }, [mapQuery.data, selectedUso.usoId]);

  const showMapData = !isLoggedIn || mapStatus === "ready";
  const showUsageData = !isLoggedIn || usageStatus === "ready";
  const mapStateTone = mapStatus === "error" ? "error" : "loading";
  const usageStateTone = usageStatus === "error" ? "error" : "loading";

  return (
    <div className="view-stack">
      <div className="etr-usage-top-grid">
        <Panel
          className="panel-etr-map"
          title="Mapa de uso de suelo agrícola Valle de Copiapó"
        >
          {showMapData ? (
            <EtrUsoMap
              geoJson={isLoggedIn ? usoMapData ?? undefined : undefined}
              selectedSummaryLabel={`${selectedUso.cultivo} · Uso ${selectedUso.usoId}`}
              selectedUsoId={selectedUso.usoId}
              onSelect={setSelectedUso}
            />
          ) : (
            <RemoteDataState
              className="is-map"
              title={
                mapStateTone === "error"
                  ? "Mapa de usos no disponible"
                  : "Cargando mapa de usos"
              }
              message={
                mapStateTone === "error"
                  ? "No se pudo obtener la geometría real de usos agrícolas desde GCP."
                  : "Esperando la geometría real de usos agrícolas."
              }
              tone={mapStateTone}
            />
          )}
        </Panel>

        <Panel
          title="Variables para el polígono seleccionado"
          subtitle={`Uso ${selectedUso.usoId} · ${usageRecord.cultivo}`}
        >
          {showUsageData ? (
            <div className="etr-usage-cards">
              <article className="etr-usage-card">
                <span>Cultivo</span>
                <strong>{usageRecord.cultivo}</strong>
              </article>
              <article className="etr-usage-card">
                <span>ETR para {usageRecord.lastDate}</span>
                <strong>{usageRecord.etrValue.toFixed(1)} mm/día</strong>
              </article>
              <article className="etr-usage-card">
                <span>ETMAX para {usageRecord.lastDate}</span>
                <strong>{usageRecord.etmaxValue.toFixed(1)} mm/día</strong>
              </article>
            </div>
          ) : (
            <RemoteDataState
              className="is-compact"
              title={
                usageStateTone === "error"
                  ? "Polígono no disponible"
                  : "Cargando polígono"
              }
              message={
                usageStateTone === "error"
                  ? "No se pudo obtener la serie real para el uso seleccionado."
                  : "Consultando variables reales para el uso seleccionado."
              }
              tone={usageStateTone}
            />
          )}
        </Panel>
      </div>

      <Panel
        title="Variación temporal de la ETR y ETmax"
        subtitle={`Uso ${selectedUso.usoId} · ${usageRecord.cultivo}`}
        className="panel-accent-blue"
      >
        {showUsageData ? (
          <SimpleLineChart
            labelEvery={3}
            maxValue={etrEtmaxDomain.max}
            minValue={etrEtmaxDomain.min}
            series={usageRecord.etrEtmaxSeries}
            unit="mm"
            xLabelAngle={-45}
          />
        ) : (
          <RemoteDataState
            className="is-chart"
            title={
              usageStateTone === "error"
                ? "Serie ETR no disponible"
                : "Cargando serie ETR"
            }
            message={
              usageStateTone === "error"
                ? "El servicio no respondió con la serie real de ETR y ETmax."
                : "Esperando datos reales de ETR y ETmax."
            }
            tone={usageStateTone}
          />
        )}
      </Panel>

      <div className="etr-usage-chart-grid">
        <Panel title="Variación temporal del Kc">
          {showUsageData ? (
            <SimpleLineChart
              labelEvery={3}
              maxValue={kcDomain.max}
              minValue={kcDomain.min}
              series={usageRecord.kcSeries}
              unit="Kc"
              xLabelAngle={-45}
            />
          ) : (
            <RemoteDataState
              className="is-chart"
              title={
                usageStateTone === "error" ? "Serie Kc no disponible" : "Cargando serie Kc"
              }
              message={
                usageStateTone === "error"
                  ? "El servicio no respondió con la serie real de Kc."
                  : "Esperando datos reales de Kc."
              }
              tone={usageStateTone}
            />
          )}
        </Panel>
        <Panel title="Variación temporal del LAI">
          {showUsageData ? (
            <SimpleLineChart
              labelEvery={3}
              maxValue={laiDomain.max}
              minValue={laiDomain.min}
              series={usageRecord.laiSeries}
              unit="LAI"
              xLabelAngle={-45}
            />
          ) : (
            <RemoteDataState
              className="is-chart"
              title={
                usageStateTone === "error" ? "Serie LAI no disponible" : "Cargando serie LAI"
              }
              message={
                usageStateTone === "error"
                  ? "El servicio no respondió con la serie real de LAI."
                  : "Esperando datos reales de LAI."
              }
              tone={usageStateTone}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
