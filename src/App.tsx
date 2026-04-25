import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  CloudRain,
  CloudSun,
  Droplets,
  Gauge,
  LogIn,
  LogOut,
  MapPinned,
  Radio,
  Snowflake,
  Sun,
  Thermometer,
  UserRound,
  Waves,
} from "lucide-react";
import {
  Cell,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EtrMap, type EtrSectorSelection } from "./components/EtrMap";
import {
  defaultEtrQuadrantSelection,
  EtrQuadrantMap,
  type EtrQuadrantSelection,
} from "./components/EtrQuadrantMap";
import {
  defaultEtrUsoMapSelection,
  EtrUsoMap,
  type EtrUsoSelection,
} from "./components/EtrUsoMap";
import { KpiCard } from "./components/KpiCard";
import { MiniSparkline } from "./components/MiniSparkline";
import { SimpleBarChart } from "./components/SimpleBarChart";
import { SimpleLineChart, type LineSeries } from "./components/SimpleLineChart";
import { SnowCoverageMap } from "./components/SnowCoverageMap";
import { StatusLeafletMap } from "./components/StatusLeafletMap";
import {
  buildEtrDownloadFilename,
  chartPalette,
  computeOverviewCards,
  etrDownloadFormats,
  etrDownloadMonthLabels,
  etrDownloadVariables,
  EtrDownloadFormat,
  EtrDownloadVariable,
  etrLastUpdateIso,
  etrOverviewBarGroups,
  etrOverviewSeasonSeries,
  etrRegions,
  etrStats,
  getEtrDownloadDays,
  getEtrDownloadMonths,
  getEtrDownloadYears,
  getFreshnessStatus,
  ManualWellEntry,
  MeteoStationPoint,
  meteoStationPoints,
  mockNowIso,
  snowJorqueraSeries,
  snowLastUpdateIso,
  snowManflasSeries,
  snowOverviewSeries,
  snowPulidoSeries,
  staleThresholdDaysDefault,
  ViewId,
  views,
  wellMapPoints,
  WellMapPoint,
  waterQualityRecords,
  WaterQualityStatus,
} from "./data/mockupData";
import {
  getSnowBalanceDisplayRows,
  getSnowBalanceRecord,
  getSnowBalanceYears,
  snowBalanceBasinLabels,
  snowBalanceLatestYear,
  SnowBalanceBasinId,
} from "./data/snowBalanceData";

const monthLabels = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const navIconMap = {
  overview: Gauge,
  etr: Droplets,
  snow: Snowflake,
  wells: Waves,
  meteo: Thermometer,
} as const;

const authStorageKey = "cas_mockup_is_logged_in";
const authUserStorageKey = "cas_mockup_user_name";
const defaultAuthUserName = "Camila Rojas";

const freshnessClassMap = {
  fresh: "is-good",
  warning: "is-warning",
  stale: "is-danger",
} as const;

const freshnessLabelMap = {
  fresh: "Actualizado < 24 h",
  warning: "Actualizado 24-48 h",
  stale: "Sin reporte > 48 h",
} as const;

const freshnessCompactLabelMap = {
  fresh: "OK",
  warning: "Seguim.",
  stale: "Alerta",
} as const;

const qualityClassMap: Record<WaterQualityStatus, string> = {
  good: "is-good",
  watch: "is-warning",
  alert: "is-danger",
};

const qualityLabelMap: Record<WaterQualityStatus, string> = {
  good: "Buena",
  watch: "Atención",
  alert: "Alerta",
};

const sourceLabelMap = {
  telemetry: "Telemetría",
  manual: "Manual",
} as const;

const getStationWeatherSummary = (station: MeteoStationPoint) => {
  if (station.humidityValue >= 52 || (station.temperatureValue <= 15.5 && station.humidityValue >= 47)) {
    return {
      icon: CloudRain,
      label: "Precipitaciones",
      tone: "rain",
    } as const;
  }

  if (station.humidityValue >= 44) {
    return {
      icon: CloudSun,
      label: "Parcial nublado",
      tone: "cloud",
    } as const;
  }

  return {
    icon: Sun,
    label: "Soleado",
    tone: "sun",
  } as const;
};

type ManualFormState = {
  date: string;
  level: string;
  note: string;
  operator: string;
  time: string;
  wellId: string;
};

function Panel({
  children,
  className,
  title,
  subtitle,
}: {
  children: ReactNode;
  className?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <section className={`panel ${className ?? ""}`.trim()}>
      <header className="panel-header">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </header>
      <div className="panel-content">{children}</div>
    </section>
  );
}

const toChartDateLabel = (date: string) => {
  const parsed = new Date(`${date}T00:00:00`);
  const month = monthLabels[parsed.getMonth()] ?? "N/A";
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${month} ${day}`;
};

const formatDateTime = (value: string) => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("es-CL", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
};

const formatRelativeAge = (lastUpdate: string, now: Date) => {
  const diffMs = Math.max(0, now.getTime() - new Date(lastUpdate).getTime());
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < hour) {
    return `Hace ${Math.max(1, Math.round(diffMs / minute))} min`;
  }

  if (diffMs < day) {
    return `Hace ${Math.round(diffMs / hour)} h`;
  }

  return `Hace ${Math.round(diffMs / day)} días`;
};

const getCurrentValue = (points: { value: number }[]) =>
  points[points.length - 1]?.value ?? 0;

const getDailyChangeValue = (points: { value: number }[]) => {
  const last = points[points.length - 1]?.value ?? 0;
  const reference = points[Math.max(0, points.length - 2)]?.value ?? last;
  return last - reference;
};

const getRangeValue = (points: { value: number }[]) => {
  const values = points.map((point) => point.value);
  return Math.max(...values) - Math.min(...values);
};

const upsertSeriesPoint = (
  points: { label: string; value: number }[],
  label: string,
  value: number,
) => {
  const next = points.filter((point) => point.label !== label);
  next.push({ label, value });
  return next.slice(-18);
};

const toOverviewMiniDateLabel = (value: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [, month, day] = value.split("-");
    return `${day}/${month}`;
  }

  return value.length > 8 ? value.slice(0, 8) : value;
};

type OverviewMiniSeries = {
  color: string;
  label: string;
  values: number[];
};

const buildOverviewMiniRows = (
  labels: string[] | undefined,
  lines: OverviewMiniSeries[],
) => {
  const pointsLength = Math.max(0, ...lines.map((line) => line.values.length));
  return Array.from({ length: pointsLength }, (_, index) => {
    const row: Record<string, number | string> = {
      label: labels?.[index] ?? `P${index + 1}`,
    };
    lines.forEach((line) => {
      row[line.label] = line.values[index] ?? 0;
    });
    return row;
  });
};

function OverviewMiniLine({
  labels,
  lines,
  unit,
}: {
  labels?: string[];
  lines: OverviewMiniSeries[];
  unit: string;
}) {
  const rows = useMemo(() => buildOverviewMiniRows(labels, lines), [labels, lines]);

  return (
    <div className="overview-mini-chart">
      <ResponsiveContainer height={196} width="100%">
        <LineChart data={rows} margin={{ bottom: 10, left: -10, right: 4, top: 6 }}>
          <CartesianGrid stroke="hsl(210 18% 91%)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            angle={-28}
            axisLine={{ stroke: "hsl(210 18% 86%)" }}
            dataKey="label"
            height={42}
            interval="preserveStartEnd"
            minTickGap={10}
            tick={{ fill: "hsl(215 14% 50%)", fontSize: 10 }}
            tickFormatter={(value: string) => toOverviewMiniDateLabel(value)}
            tickLine={false}
            tickMargin={4}
            textAnchor="end"
          />
          <YAxis
            axisLine={{ stroke: "hsl(210 18% 86%)" }}
            tick={{ fill: "hsl(215 14% 50%)", fontSize: 10 }}
            tickLine={false}
            width={26}
          />
          <RechartsTooltip
            animationDuration={120}
            contentStyle={{
              background: "hsl(0 0% 100%)",
              border: "1px solid hsl(210 18% 87%)",
              borderRadius: "8px",
              boxShadow: "0 8px 16px rgba(16, 44, 92, 0.12)",
              fontSize: "11px",
            }}
            cursor={{ stroke: "hsl(215 38% 70%)", strokeDasharray: "3 3" }}
            formatter={(value, name) => [`${Number(value ?? 0).toFixed(2)} ${unit}`, String(name)]}
            labelFormatter={(label) => String(toOverviewMiniDateLabel(String(label)))}
          />
          {lines.map((line, index) => (
            <Line
              key={line.label}
              activeDot={{ r: 4 }}
              animationBegin={index * 90}
              animationDuration={620}
              dataKey={line.label}
              dot={{ r: 2 }}
              isAnimationActive
              stroke={line.color}
              strokeWidth={2.1}
              type="monotone"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

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

type EtrSubTabId = "sector" | "usage" | "downloads";

const getSeriesDomain = (
  series: LineSeries[],
  {
    clampMin = 0,
    minSpan = 0.2,
    padRatio = 0.12,
  }: { clampMin?: number; minSpan?: number; padRatio?: number } = {},
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

function EtrSectorTab() {
  const [selectedSector, setSelectedSector] = useState<EtrSectorSelection>(
    defaultEtrSectorSelection,
  );
  const selectedRegion = useMemo(
    () => etrRegions.find((region) => region.id === selectedSector.regionId) ?? etrRegions[0],
    [selectedSector.regionId],
  );
  const selectedSectorBarGroups = useMemo(
    () => buildSectorBarGroups(selectedSector.sectorId, selectedRegion.barGroups),
    [selectedRegion.barGroups, selectedSector.sectorId],
  );
  const selectedSectorSeasonSeries = useMemo(
    () => buildSectorSeasonSeries(selectedSector.sectorId, selectedRegion.seasonSeries),
    [selectedRegion.seasonSeries, selectedSector.sectorId],
  );
  const selectedSeasonMax = useMemo(() => {
    const max = Math.max(
      ...selectedSectorSeasonSeries.flatMap((series) =>
        series.points.map((point) => point.value),
      ),
    );
    return Math.max(1.8, Math.ceil(max * 10) / 10);
  }, [selectedSectorSeasonSeries]);

  return (
    <div className="view-stack">
      <div className="stat-grid">
        <KpiCard
          delayMs={0}
          icon={Gauge}
          title={etrStats[0].label}
          value={etrStats[0].value}
          note="Disponibilidad ET-LAT"
          noteTone="neutral"
        />
        <KpiCard
          delayMs={80}
          icon={Droplets}
          title={etrStats[1].label}
          value={etrStats[1].value}
          note="Balance hídrico base"
          noteTone="positive"
        />
        <KpiCard
          delayMs={160}
          icon={MapPinned}
          title={etrStats[2].label}
          value={etrStats[2].value}
          note="Potencial atmosférico"
          noteTone="neutral"
        />
      </div>

      <div className="etr-summary-grid">
        <Panel
          title="Distribución de ETR (mm) por clase de cultivo en la última fecha disponible"
        >
          <SimpleBarChart
            chartHeight={338}
            groups={etrOverviewBarGroups}
            maxValue={25}
            tickStep={5}
            unit="mm"
            xLabelAngle={-18}
          />
        </Panel>

        <Panel
          title="Comportamiento de ETR y ETmax en la temporada (mm)"
        >
          <SimpleLineChart
            labelEvery={3}
            maxValue={1.8}
            minValue={0}
            series={etrOverviewSeasonSeries}
            unit="mm"
            xLabelAngle={-45}
          />
        </Panel>
      </div>

      <div className="etr-top-grid">
        <Panel
          className="panel-etr-map"
          title="Mapa sectores y áreas de gestión CAS Copiapó"
        >
          <EtrMap
            selectedSectorId={selectedSector.sectorId}
            selectedSummaryLabel={`${selectedSector.sectorName} · ${selectedSector.regionLabel}`}
            onSelect={setSelectedSector}
          />
        </Panel>

        <Panel
          className="panel-etr-bar"
          title="Distribución de ETR (mm) por clase de cultivo en la última fecha disponible"
          subtitle={`${selectedSector.sectorName} · ${selectedRegion.label}`}
        >
          <SimpleBarChart
            chartHeight="100%"
            groups={selectedSectorBarGroups}
            maxValue={35}
            tickStep={5}
            unit="mm"
            xLabelAngle={-16}
          />
        </Panel>
      </div>

      <Panel
        title="Variación temporal de la ETR y ETmax"
        subtitle={`${selectedSector.sectorName} · ${selectedRegion.label}`}
        className="panel-accent-blue"
      >
        <SimpleLineChart
          labelEvery={2}
          maxValue={selectedSeasonMax}
          minValue={0}
          series={selectedSectorSeasonSeries}
          unit="mm"
          xLabelAngle={-45}
        />
      </Panel>
    </div>
  );
}

function EtrUsageTab() {
  const [selectedUso, setSelectedUso] = useState<EtrUsoSelection>(
    defaultEtrUsoMapSelection,
  );
  const usageRecord = useMemo(
    () => buildEtrUsoRecordFromSelection(selectedUso),
    [selectedUso],
  );
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

  return (
    <div className="view-stack">
      <div className="etr-usage-top-grid">
        <Panel
          className="panel-etr-map"
          title="Mapa de uso de suelo agrícola Valle de Copiapó"
        >
          <EtrUsoMap
            selectedSummaryLabel={`${selectedUso.cultivo} · Uso ${selectedUso.usoId}`}
            selectedUsoId={selectedUso.usoId}
            onSelect={setSelectedUso}
          />
        </Panel>

        <Panel
          title="Variables para el polígono seleccionado"
          subtitle={`Uso ${selectedUso.usoId} · ${usageRecord.cultivo}`}
        >
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
        </Panel>
      </div>

      <Panel
        title="Variación temporal de la ETR y ETmax"
        subtitle={`Uso ${selectedUso.usoId} · ${usageRecord.cultivo}`}
        className="panel-accent-blue"
      >
        <SimpleLineChart
          labelEvery={3}
          maxValue={etrEtmaxDomain.max}
          minValue={etrEtmaxDomain.min}
          series={usageRecord.etrEtmaxSeries}
          unit="mm"
          xLabelAngle={-45}
        />
      </Panel>

      <div className="etr-usage-chart-grid">
        <Panel title="Variación temporal del Kc">
          <SimpleLineChart
            labelEvery={3}
            maxValue={kcDomain.max}
            minValue={kcDomain.min}
            series={usageRecord.kcSeries}
            unit="Kc"
            xLabelAngle={-45}
          />
        </Panel>
        <Panel title="Variación temporal del LAI">
          <SimpleLineChart
            labelEvery={3}
            maxValue={laiDomain.max}
            minValue={laiDomain.min}
            series={usageRecord.laiSeries}
            unit="LAI"
            xLabelAngle={-45}
          />
        </Panel>
      </div>
    </div>
  );
}

function EtrDownloadsTab() {
  const [selectedQuadrant, setSelectedQuadrant] = useState<EtrQuadrantSelection>(
    defaultEtrQuadrantSelection,
  );
  const [selectedVariable, setSelectedVariable] = useState<EtrDownloadVariable>("ETR");
  const [selectedFormat, setSelectedFormat] = useState<EtrDownloadFormat>("TIFF");
  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedMonth, setSelectedMonth] = useState(1);
  const [selectedDay, setSelectedDay] = useState(1);
  const [downloadFeedback, setDownloadFeedback] = useState("");

  const years = useMemo(
    () => getEtrDownloadYears(selectedQuadrant.quadrantId, selectedVariable),
    [selectedQuadrant.quadrantId, selectedVariable],
  );
  const months = useMemo(
    () =>
      getEtrDownloadMonths(
        selectedQuadrant.quadrantId,
        selectedVariable,
        selectedYear,
      ),
    [selectedQuadrant.quadrantId, selectedVariable, selectedYear],
  );
  const days = useMemo(
    () =>
      getEtrDownloadDays(
        selectedQuadrant.quadrantId,
        selectedVariable,
        selectedYear,
        selectedMonth,
      ),
    [selectedQuadrant.quadrantId, selectedVariable, selectedYear, selectedMonth],
  );

  useEffect(() => {
    if (!years.includes(selectedYear)) {
      const fallbackYear = years[years.length - 1] ?? 2025;
      setSelectedYear(fallbackYear);
    }
  }, [selectedYear, years]);

  useEffect(() => {
    if (!months.includes(selectedMonth)) {
      const fallbackMonth = months[0] ?? 1;
      setSelectedMonth(fallbackMonth);
    }
  }, [months, selectedMonth]);

  useEffect(() => {
    if (!days.includes(selectedDay)) {
      const fallbackDay = days[0] ?? 1;
      setSelectedDay(fallbackDay);
    }
  }, [days, selectedDay]);

  const selectedMonthLabel =
    etrDownloadMonthLabels[selectedMonth - 1] ?? `Mes ${selectedMonth}`;

  const handleFakeDownload = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const filename = buildEtrDownloadFilename({
      day: selectedDay,
      format: selectedFormat,
      month: selectedMonth,
      quadrantId: selectedQuadrant.quadrantId,
      variable: selectedVariable,
      year: selectedYear,
    });
    const modeLabel =
      selectedFormat === "JPEG"
        ? "Exportación visual simulada"
        : "Descarga raster simulada";
    setDownloadFeedback(`${modeLabel}: ${filename}`);
  };

  return (
    <div className="view-stack">
      <div className="etr-download-grid">
        <Panel className="panel-etr-map" title="Cuadrantes disponibles para descarga">
          <EtrQuadrantMap
            selectedQuadrantId={selectedQuadrant.quadrantId}
            selectedSummaryLabel={selectedQuadrant.quadrantLabel}
            onSelect={(selection) => {
              setSelectedQuadrant(selection);
              setDownloadFeedback("");
            }}
          />
        </Panel>

        <Panel
          title="Descarga de imágenes"
          subtitle={selectedQuadrant.quadrantLabel}
        >
          <div className="etr-download-copy">
            <p>
              En la plataforma original los cuadrados corresponden a cuadrantes de
              descarga sobre base satelital. Aquí simulamos descarga raster por
              cuadrante, variable, fecha y formato.
            </p>
          </div>

          <form className="etr-download-form" onSubmit={handleFakeDownload}>
            <label>
              <span>Variable</span>
              <select
                value={selectedVariable}
                onChange={(event) => setSelectedVariable(event.target.value as EtrDownloadVariable)}
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

            <button type="submit">Descargar</button>
          </form>

          <p className="etr-download-selected">
            Selección actual: {selectedQuadrant.quadrantLabel} · {selectedVariable} ·{" "}
            {selectedFormat} · {selectedYear} · {selectedMonthLabel} ·{" "}
            {String(selectedDay).padStart(2, "0")}
          </p>
          {downloadFeedback && (
            <p className="etr-download-feedback">{downloadFeedback}</p>
          )}
          {selectedFormat === "JPEG" && (
            <p className="etr-download-format-note">
              Nota: en la app original la descarga real es GeoTIFF; JPEG aquí es
              una opción mock para demo.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function EtrView({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [activeEtrTab, setActiveEtrTab] = useState<EtrSubTabId>("sector");

  useEffect(() => {
    if (!isLoggedIn && activeEtrTab !== "sector") {
      setActiveEtrTab("sector");
    }
  }, [activeEtrTab, isLoggedIn]);

  return (
    <div className="view-stack etr-page">
      <div className="view-intro">
        <h2>Monitoreo de Evapotranspiración en el Valle de Copiapó</h2>
      </div>

      <div className="etr-subnav" role="tablist" aria-label="Secciones de ETR">
        <button
          type="button"
          role="tab"
          aria-selected={activeEtrTab === "sector"}
          className={activeEtrTab === "sector" ? "is-active" : ""}
          onClick={() => setActiveEtrTab("sector")}
        >
          Indicadores por sector
        </button>
        {isLoggedIn && (
          <button
            type="button"
            role="tab"
            aria-selected={activeEtrTab === "usage"}
            className={activeEtrTab === "usage" ? "is-active" : ""}
            onClick={() => setActiveEtrTab("usage")}
          >
            Indicadores por uso
          </button>
        )}
        {isLoggedIn && (
          <button
            type="button"
            role="tab"
            aria-selected={activeEtrTab === "downloads"}
            className={activeEtrTab === "downloads" ? "is-active" : ""}
            onClick={() => setActiveEtrTab("downloads")}
          >
            Descarga de imágenes
          </button>
        )}
      </div>

      {!isLoggedIn && (
        <p className="etr-access-note">
          Inicia sesión para habilitar <strong>Indicadores por uso</strong> y{" "}
          <strong>Descarga de imágenes</strong>.
        </p>
      )}

      {activeEtrTab === "sector" && <EtrSectorTab />}
      {isLoggedIn && activeEtrTab === "usage" && <EtrUsageTab />}
      {isLoggedIn && activeEtrTab === "downloads" && <EtrDownloadsTab />}
    </div>
  );
}

const snowBalanceBasins: SnowBalanceBasinId[] = ["jorquera", "pulido", "manflas"];

function SnowView() {
  const [activeSnowTab, setActiveSnowTab] = useState<"coverage" | "balance">("coverage");
  const [selectedBalanceYearByBasin, setSelectedBalanceYearByBasin] = useState<
    Record<SnowBalanceBasinId, number>
  >({
    jorquera: snowBalanceLatestYear,
    pulido: snowBalanceLatestYear,
    manflas: snowBalanceLatestYear,
  });

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
        <div className="snow-grid">
          <Panel title="Cobertura nival" subtitle="Última imagen disponible (2025-12-30)">
            <div className="snow-copy">
              <p>
                La imagen de cobertura nival muestra la presencia o ausencia de nieve
                en la cuenca para una fecha dada.
              </p>
              <p>
                El mockup muestra las áreas de estudio cargadas desde GeoJSON sobre
                mapa satelital y mantiene las series de evolución anual por cuenca.
              </p>
            </div>

            <div className="snow-image-card">
              <SnowCoverageMap />
            </div>
          </Panel>

          <div className="snow-charts">
            <div className="snow-description">
              <h3>Gráficas de evolución diaria de FSCA.</h3>
              <p>
                Los gráficos de evolución diaria de cobertura de nieve (FSCA)
                muestran el porcentaje del área de estudio y de cada cuenca que
                está cubierta con nieve durante los días correspondientes al período
                húmedo (abril-septiembre) del año actual y el anterior.
              </p>
            </div>

            <Panel title="Evolución diaria de la cobertura de nieve en el área de estudio (%)">
              <SimpleLineChart
                maxValue={100}
                minValue={0}
                series={snowOverviewSeries}
                unit="Cobertura (%)"
              />
            </Panel>

            <Panel title="Evolución diaria de FSCA de la cuenca de Jorquera">
              <SimpleLineChart
                maxValue={100}
                minValue={0}
                series={snowJorqueraSeries}
                unit="Cobertura (%)"
              />
            </Panel>

            <Panel title="Evolución diaria de FSCA de la cuenca de Pulido">
              <SimpleLineChart
                maxValue={100}
                minValue={0}
                series={snowPulidoSeries}
                unit="Cobertura (%)"
              />
            </Panel>

            <Panel title="Evolución diaria de FSCA de la cuenca de Manflas">
              <SimpleLineChart
                maxValue={100}
                minValue={0}
                series={snowManflasSeries}
                unit="Cobertura (%)"
              />
            </Panel>
          </div>
        </div>
      )}

      {activeSnowTab === "balance" && (
        <div className="snow-balance-stack">
          <div className="snow-description">
            <h3>Balance de masa de nieve</h3>
            <p>
              Estimación del derretimiento, transporte y pérdidas durante la
              temporada húmeda. Cada cuenca permite seleccionar un año histórico
              y revisar intervalos de confianza (95%) en mm equivalentes de agua en nieve (SWE).
            </p>
          </div>

          <div className="snow-balance-grid">
            {snowBalanceBasins.map((basin) => {
              const years = [...getSnowBalanceYears(basin)].sort((a, b) => b - a);
              const selectedYear = selectedBalanceYearByBasin[basin];
              const record = getSnowBalanceRecord(basin, selectedYear);
              const rows = getSnowBalanceDisplayRows(record);

              return (
                <Panel
                  key={basin}
                  title={`Balance de la cuenca del río ${snowBalanceBasinLabels[basin]}`}
                  subtitle="Intervalos de confianza (95%)"
                >
                  <div className="snow-balance-controls">
                    <label htmlFor={`snow-balance-year-${basin}`}>Año</label>
                    <select
                      id={`snow-balance-year-${basin}`}
                      value={selectedYear}
                      onChange={(event) => {
                        const nextYear = Number(event.target.value);
                        setSelectedBalanceYearByBasin((prev) => ({
                          ...prev,
                          [basin]: nextYear,
                        }));
                      }}
                    >
                      {years.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="snow-balance-chart-layout">
                    <div className="snow-balance-donut">
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={rows}
                            dataKey="value"
                            nameKey="label"
                            innerRadius={52}
                            outerRadius={84}
                            paddingAngle={2}
                            cx="50%"
                            cy="50%"
                          >
                            {rows.map((row) => (
                              <Cell key={`${basin}-${row.componentId}`} fill={row.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            formatter={(value, label) => [
                              `${Number(value ?? 0).toFixed(2)} mm`,
                              String(label ?? ""),
                            ]}
                            contentStyle={{
                              background: "#fff",
                              border: "1px solid hsl(210 18% 86%)",
                              borderRadius: "8px",
                              boxShadow: "0 8px 16px rgba(16, 44, 92, 0.12)",
                              fontSize: "11px",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="snow-balance-legend">
                      {rows.map((row) => (
                        <div key={`${basin}-legend-${row.componentId}`} className="snow-balance-legend-row">
                          <span className="snow-balance-legend-main">
                            <i
                              className="snow-balance-dot"
                              style={{ backgroundColor: row.color }}
                            />
                            {row.label}
                          </span>
                          <strong>{row.percent.toFixed(1)}%</strong>
                        </div>
                      ))}
                      <p className="snow-balance-total">
                        Total estimado: <strong>{record.total.toFixed(2)} mm SWE</strong>
                      </p>
                    </div>
                  </div>

                  <div className="snow-balance-table-wrap">
                    <table className="snow-balance-table">
                      <thead>
                        <tr>
                          <th>Componente</th>
                          <th>Máximo (mm)</th>
                          <th>Mínimo (mm)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={`${basin}-row-${row.componentId}`}>
                            <td>{row.label}</td>
                            <td>{row.max.toFixed(2)}</td>
                            <td>{row.min.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewView({
  cards,
  onOpenView,
  stations,
  wells,
}: {
  cards: ReturnType<typeof computeOverviewCards>;
  onOpenView: (viewId: Exclude<ViewId, "overview">) => void;
  stations: MeteoStationPoint[];
  wells: WellMapPoint[];
}) {
  const etrMiniLines = etrOverviewSeasonSeries.map((line) => ({
    color: line.color,
    label: line.label,
    values: line.points.slice(-12).map((point) => point.value),
  }));
  const etrMiniLabels = etrOverviewSeasonSeries[0]?.points
    .slice(-12)
    .map((point) => point.label) ?? [];

  const snowMiniLines = snowOverviewSeries.map((line) => ({
    color: line.color,
    label: line.label,
    values: line.points.map((point) => point.value),
  }));
  const snowMiniLabels = snowOverviewSeries[0]?.points.map((point) => point.label) ?? [];

  const recentWells = [...wells]
    .sort((a, b) => new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime())
    .slice(0, 4)
    .map((well) => ({
      id: well.id,
      name: well.name.replace("Pozo ", ""),
      level: getCurrentValue(well.levelSeries),
      dailyChange: getDailyChangeValue(well.levelSeries),
      status: well.status,
    }));

  const meteoSnapshot = [...stations]
    .sort((a, b) => new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime())
    .slice(0, 3)
    .map((station) => ({
      id: station.id,
      name: station.name.replace("Estación ", ""),
      humidity: station.humidityValue,
      status: station.status,
      temperature: station.temperatureValue,
    }));

  return (
    <div className="view-stack">
      <div className="view-intro">
        <h2>Resumen operativo</h2>
        <p>Acceso rápido a ET-LAT, MODIS-Snow, Pozos y Meteo.</p>
      </div>
      <div className="overview-grid">
        {cards.map((card) => {
          const isNetworkCard = card.targetView === "wells" || card.targetView === "meteo";
          const cardStatusLabel = isNetworkCard
            ? card.status === "stale"
              ? "Red con alertas"
              : card.status === "warning"
                ? "Red en seguimiento"
                : "Red estable"
            : freshnessLabelMap[card.status];

          const cardSecondaryKpi =
            card.targetView === "wells"
              ? `${wells.length} pozos monitoreados`
              : card.targetView === "meteo"
                ? `${stations.length} estaciones monitoreadas`
                : card.secondaryKpi;

          return (
            <button
              key={card.id}
              type="button"
              className="overview-card"
              onClick={() => onOpenView(card.targetView)}
            >
              <div className="overview-card-header">
                <h3>{card.title}</h3>
                <span className={`status-pill ${freshnessClassMap[card.status]}`}>
                  {cardStatusLabel}
                </span>
              </div>
              <strong>{card.primaryKpi}</strong>
              <p>{cardSecondaryKpi}</p>
              {card.targetView === "etr" && (
                <OverviewMiniLine labels={etrMiniLabels} lines={etrMiniLines} unit="mm" />
              )}
              {card.targetView === "snow" && (
                <OverviewMiniLine labels={snowMiniLabels} lines={snowMiniLines} unit="%" />
              )}
              {card.targetView === "wells" && (
                <div className="overview-mini-table">
                  <div className="overview-mini-table-head">
                    <span>Pozo</span>
                    <span>Nivel</span>
                    <span>Cambio</span>
                    <span>Estado</span>
                  </div>
                  {recentWells.map((well) => (
                    <div key={well.id} className="overview-mini-table-row">
                      <span className="overview-mini-name">{well.name}</span>
                      <span>{well.level.toFixed(2)} m</span>
                      <span className={`overview-mini-delta ${well.dailyChange >= 0 ? "is-up" : "is-down"}`}>
                        {well.dailyChange >= 0 ? "+" : ""}
                        {well.dailyChange.toFixed(2)} m
                      </span>
                      <span className={`overview-mini-status ${well.status}`}>
                        {freshnessCompactLabelMap[well.status]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {card.targetView === "meteo" && (
                <div className="overview-mini-table">
                  <div className="overview-mini-table-head">
                    <span>Estación</span>
                    <span>Temp</span>
                    <span>HR</span>
                    <span>Estado</span>
                  </div>
                  {meteoSnapshot.map((station) => (
                    <div key={station.id} className="overview-mini-table-row">
                      <span className="overview-mini-name">{station.name}</span>
                      <span>{station.temperature.toFixed(1)}°C</span>
                      <span>{station.humidity.toFixed(0)}%</span>
                      <span className={`overview-mini-status ${station.status}`}>
                        {freshnessCompactLabelMap[station.status]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <small>Última actualización: {formatDateTime(card.lastUpdate)}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WellsView({
  manualEntries,
  manualForm,
  now,
  onManualChange,
  onManualSubmit,
  onSelectWell,
  selectedWellId,
  wells,
}: {
  manualEntries: ManualWellEntry[];
  manualForm: ManualFormState;
  now: Date;
  onManualChange: (next: Partial<ManualFormState>) => void;
  onManualSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSelectWell: (wellId: string) => void;
  selectedWellId: string;
  wells: WellMapPoint[];
}) {
  const waterByWell = useMemo(
    () => new Map(waterQualityRecords.map((record) => [record.wellId, record])),
    [],
  );
  const selectedWell = wells.find((well) => well.id === selectedWellId) ?? wells[0];
  const selectedQuality = waterByWell.get(selectedWell.id);
  const wellRows = wells.map((well) => ({
    ...well,
    currentLevel: getCurrentValue(well.levelSeries),
    dailyChange: getDailyChangeValue(well.levelSeries),
    range: getRangeValue(well.levelSeries),
    qualityStatus: waterByWell.get(well.id)?.qualityStatus,
  }));
  const wellsFreshCount = wells.filter((well) => well.status !== "stale").length;
  const wellsStaleCount = wells.filter((well) => well.status === "stale").length;
  const manualWells = wells.filter((well) => well.sourceType === "manual").length;
  const waterAlerts = waterQualityRecords.filter((record) => record.qualityStatus === "alert").length;
  const maxUpdate = wells.reduce((latest, well) => {
    if (!latest) {
      return well.lastUpdate;
    }

    return new Date(well.lastUpdate).getTime() > new Date(latest).getTime()
      ? well.lastUpdate
      : latest;
  }, "");
  const seriesValues = selectedWell.levelSeries.map((point) => point.value);
  const minSeriesValue = Math.min(...seriesValues) - 0.1;
  const maxSeriesValue = Math.max(...seriesValues) + 0.1;

  return (
    <div className="view-stack">
      <div className="view-intro">
        <h2>Pozos y calidad de agua</h2>
        <p>
          Mapa operativo con estado por frescura de dato, fuente de captura y panel
          de detalle por pozo.
        </p>
      </div>

      <div className="stat-grid">
        <KpiCard
          delayMs={0}
          icon={Waves}
          title="Pozos al día"
          value={`${wellsFreshCount}/${wells.length}`}
          note={`${wellsStaleCount} sin reporte en las últimas 48 h`}
          noteTone={wellsStaleCount > 0 ? "negative" : "positive"}
        />
        <KpiCard
          delayMs={80}
          icon={Radio}
          title="Pozos con carga manual"
          value={String(manualWells)}
          note="Lecturas diarias desde mobile/tablet"
          noteTone="neutral"
        />
        <KpiCard
          delayMs={160}
          icon={Droplets}
          title="Calidad en alerta"
          value={String(waterAlerts)}
          note="Muestras de calidad de agua fuera de rango"
          noteTone={waterAlerts > 0 ? "negative" : "positive"}
        />
        <KpiCard
          delayMs={240}
          icon={Gauge}
          title="Última sincronización global"
          value={formatDateTime(maxUpdate)}
          note={formatRelativeAge(maxUpdate, now)}
          noteTone="neutral"
        />
      </div>

      <div className="map-detail-grid">
        <Panel
          title="Mapa de pozos (Copiapó)"
          subtitle="Semáforo de frescura: verde <24 h · amarillo 24-48 h · rojo >48 h"
        >
          <StatusLeafletMap
            points={wellRows.map((well) => ({
              id: well.id,
              name: well.name,
              lat: well.lat,
              lng: well.lng,
              status: well.status,
              sourceType: well.sourceType,
              lastUpdate: well.lastUpdate,
              qualityStatus: well.qualityStatus,
            }))}
            selectedPointId={selectedWellId}
            onSelect={onSelectWell}
          />
          <div className="map-legend">
            <span><i className="legend-dot fresh" /> Actualizado &lt; 24 h</span>
            <span><i className="legend-dot warning" /> Actualizado 24-48 h</span>
            <span><i className="legend-dot stale" /> Sin reporte &gt; 48 h</span>
            <span><i className="legend-dot quality-alert" /> Urgencia calidad de agua</span>
          </div>
        </Panel>

        <Panel
          title={`Detalle: ${selectedWell.name}`}
          subtitle={`${selectedWell.provider} · ${selectedWell.aquiferSector}`}
        >
          <div className="detail-kpi-grid">
            <article className="detail-kpi">
              <span>Nivel actual</span>
              <strong>{getCurrentValue(selectedWell.levelSeries).toFixed(2)} m</strong>
            </article>
            <article className="detail-kpi">
              <span>Cambio diario</span>
              <strong>
                {getDailyChangeValue(selectedWell.levelSeries) >= 0 ? "+" : ""}
                {getDailyChangeValue(selectedWell.levelSeries).toFixed(2)} m
              </strong>
            </article>
            <article className="detail-kpi">
              <span>Rango del período</span>
              <strong>{getRangeValue(selectedWell.levelSeries).toFixed(2)} m</strong>
            </article>
          </div>

          <div className="status-row">
            <span className={`status-pill ${freshnessClassMap[selectedWell.status]}`}>
              {freshnessLabelMap[selectedWell.status]}
            </span>
            <span className="status-pill is-neutral">
              Fuente: {sourceLabelMap[selectedWell.sourceType]}
            </span>
            <span className="status-pill is-neutral">
              {formatRelativeAge(selectedWell.lastUpdate, now)}
            </span>
          </div>

          {selectedQuality && (
            <div className="quality-box">
              <div className="quality-head">
                <strong>Calidad de agua</strong>
                <span className={`status-pill ${qualityClassMap[selectedQuality.qualityStatus]}`}>
                  {qualityLabelMap[selectedQuality.qualityStatus]}
                </span>
              </div>
              <div className="quality-grid">
                <span>Última muestra: {selectedQuality.lastSampleDate}</span>
                <span>CE: {selectedQuality.conductivity.toFixed(1)} dS/m</span>
                <span>pH: {selectedQuality.pH.toFixed(1)}</span>
                <span>Turbidez: {selectedQuality.turbidity.toFixed(1)} NTU</span>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <div className="detail-grid">
        <Panel
          title="Comparación rápida de pozos"
          subtitle="Seleccione un pozo para ver su serie y detalle"
        >
          <div className="comparison-list">
            {wellRows.map((well) => (
              <button
                key={well.id}
                type="button"
                className={`comparison-row ${selectedWellId === well.id ? "is-selected" : ""}`}
                onClick={() => onSelectWell(well.id)}
              >
                <div className="comparison-main">
                  <strong>{well.name}</strong>
                  <span>{well.provider}</span>
                </div>
                <div className="comparison-metrics">
                  <div>
                    <span>Nivel</span>
                    <strong>{well.currentLevel.toFixed(2)} m</strong>
                  </div>
                  <div>
                    <span>Cambio diario</span>
                    <strong>
                      {well.dailyChange >= 0 ? "+" : ""}
                      {well.dailyChange.toFixed(2)} m
                    </strong>
                  </div>
                </div>
                <MiniSparkline
                  points={well.levelSeries.map((point) => point.value)}
                  color={chartPalette.chart6}
                />
                <span className={`status-pill ${freshnessClassMap[well.status]}`}>
                  {freshnessLabelMap[well.status]}
                </span>
              </button>
            ))}
          </div>
        </Panel>

        {false && (
          <Panel
            title="Carga manual diaria (mobile/tablet)"
            subtitle="Solo para pozos sin telemetría"
          >
          {/*
            <form className="manual-entry-form" onSubmit={onManualSubmit}>
              <label>
                <span>Pozo</span>
                <select
                  value={manualForm.wellId}
                  onChange={(event) => onManualChange({ wellId: event.target.value })}
                >
                  {wells
                    .filter((well) => well.sourceType === "manual")
                    .map((well) => (
                      <option key={well.id} value={well.id}>
                        {well.name}
                      </option>
                    ))}
                </select>
              </label>

              <div className="manual-two-col">
                <label>
                  <span>Fecha</span>
                  <input
                    type="date"
                    value={manualForm.date}
                    onChange={(event) => onManualChange({ date: event.target.value })}
                  />
                </label>
                <label>
                  <span>Hora</span>
                  <input
                    type="time"
                    value={manualForm.time}
                    onChange={(event) => onManualChange({ time: event.target.value })}
                  />
                </label>
              </div>

              <label>
                <span>Nivel (m)</span>
                <input
                  type="number"
                  step="0.01"
                  value={manualForm.level}
                  placeholder="Ej: 3.74"
                  onChange={(event) => onManualChange({ level: event.target.value })}
                  required
                />
              </label>

              <label>
                <span>Operador</span>
                <input
                  type="text"
                  value={manualForm.operator}
                  onChange={(event) => onManualChange({ operator: event.target.value })}
                  required
                />
              </label>

              <label>
                <span>Observación corta</span>
                <input
                  type="text"
                  value={manualForm.note}
                  onChange={(event) => onManualChange({ note: event.target.value })}
                />
              </label>

              <div className="manual-source-pill">Origen: mobile/tablet</div>
              <button type="submit">Guardar registro manual</button>
            </form>
          */}

          <div className="manual-history">
            <h4>Últimas cargas</h4>
            {manualEntries.length === 0 && <p>No hay cargas manuales en esta sesión.</p>}
            {manualEntries.slice(0, 4).map((entry) => {
              const wellName = wells.find((well) => well.id === entry.wellId)?.name ?? entry.wellId;
              return (
                <div key={entry.id} className="manual-history-row">
                  <strong>{wellName}</strong>
                  <span>{entry.date} {entry.time}</span>
                  <span>{entry.level.toFixed(2)} m</span>
                </div>
              );
            })}
          </div>
          </Panel>
        )}
      </div>

      <Panel
        title={`Variación temporal: ${selectedWell.name}`}
        subtitle={`Cambio diario ${getDailyChangeValue(selectedWell.levelSeries) >= 0 ? "+" : ""}${getDailyChangeValue(selectedWell.levelSeries).toFixed(2)} m`}
      >
        <SimpleLineChart
          labelEvery={1}
          maxValue={maxSeriesValue}
          minValue={minSeriesValue}
          mode="linear"
          series={[
            {
              label: selectedWell.name,
              color: chartPalette.chart6,
              points: selectedWell.levelSeries,
            },
          ]}
          unit="m"
          xLabelAngle={-40}
        />
      </Panel>
    </div>
  );
}

function MeteoView({
  now,
  onSelectStation,
  selectedStationId,
  stations,
}: {
  now: Date;
  onSelectStation: (stationId: string) => void;
  selectedStationId: string;
  stations: typeof meteoStationPoints;
}) {
  const selectedStation = stations.find((station) => station.id === selectedStationId) ?? stations[0];

  return (
    <div className="view-stack">
      <div className="view-intro">
        <h2>Estaciones meteorológicas</h2>
        <p>Tres estaciones con datos individuales y estado de actualización por punto.</p>
      </div>

      {/*
      <div className="stat-grid">
        <KpiCard
          delayMs={0}
          icon={Gauge}
          title="Estaciones al día"
          value={`${stations.filter((station) => station.status !== "stale").length}/3`}
          note={`${stations.filter((station) => station.status === "stale").length} sin reporte en las últimas 48 h`}
          noteTone={stations.some((station) => station.status === "stale") ? "negative" : "positive"}
        />
        <KpiCard
          delayMs={80}
          icon={Gauge}
          title="Última sincronización global"
          value={formatDateTime(
            stations.reduce((latest, station) => {
              if (!latest) {
                return station.lastUpdate;
              }
              return new Date(station.lastUpdate).getTime() > new Date(latest).getTime()
                ? station.lastUpdate
                : latest;
            }, ""),
          )}
          note="Frescura de red meteo"
          noteTone="neutral"
        />
        <KpiCard
          delayMs={160}
          icon={Thermometer}
          title="Temperatura media red"
          value={`${(stations.reduce((total, station) => total + station.temperatureValue, 0) / stations.length).toFixed(1)} °C`}
          note="Promedio simple de las 3 estaciones"
          noteTone="neutral"
        />
      </div>
      */}

      <div className="station-card-grid">
        {stations.map((station) => {
          const weather = getStationWeatherSummary(station);
          const WeatherIcon = weather.icon;

          return (
            <button
              key={station.id}
              type="button"
              className={`station-card ${selectedStationId === station.id ? "is-selected" : ""}`}
              onClick={() => onSelectStation(station.id)}
            >
              <div className="station-card-head">
                <div className="station-card-title">
                  <strong>{station.name}</strong>
                  <span className={`station-weather station-weather--${weather.tone}`}>
                    <WeatherIcon size={14} />
                    {weather.label}
                  </span>
                </div>
                <span className={`status-pill ${freshnessClassMap[station.status]}`}>
                  {freshnessLabelMap[station.status]}
                </span>
              </div>
              <div className="station-card-metrics">
                <span>Temp {station.temperatureValue.toFixed(1)}°C</span>
                <span>HR {station.humidityValue.toFixed(0)}%</span>
                <span>Viento {station.windValue.toFixed(1)} km/h</span>
                <span>Presión {station.pressureValue.toFixed(0)} hPa</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="map-detail-grid">
        <Panel
          title="Mapa de estaciones (Copiapó)"
          subtitle="Semáforo de frescura: verde <24 h · amarillo 24-48 h · rojo >48 h"
        >
          <StatusLeafletMap
            points={stations.map((station) => ({
              id: station.id,
              name: station.name,
              lat: station.lat,
              lng: station.lng,
              status: station.status,
              sourceType: station.sourceType,
              lastUpdate: station.lastUpdate,
            }))}
            selectedPointId={selectedStationId}
            onSelect={onSelectStation}
          />
          <div className="map-legend">
            <span><i className="legend-dot fresh" /> Actualizado &lt; 24 h</span>
            <span><i className="legend-dot warning" /> Actualizado 24-48 h</span>
            <span><i className="legend-dot stale" /> Sin reporte &gt; 48 h</span>
          </div>
        </Panel>

        <Panel title={selectedStation.name} subtitle={`${formatRelativeAge(selectedStation.lastUpdate, now)} · ${formatDateTime(selectedStation.lastUpdate)}`}>
          <div className="detail-kpi-grid">
            <article className="detail-kpi">
              <span>Temperatura</span>
              <strong>{selectedStation.temperatureValue.toFixed(1)}°C</strong>
            </article>
            <article className="detail-kpi">
              <span>Humedad</span>
              <strong>{selectedStation.humidityValue.toFixed(0)}%</strong>
            </article>
            <article className="detail-kpi">
              <span>Viento</span>
              <strong>{selectedStation.windValue.toFixed(1)} km/h</strong>
            </article>
            <article className="detail-kpi">
              <span>Presión</span>
              <strong>{selectedStation.pressureValue.toFixed(0)} hPa</strong>
            </article>
          </div>

          <div className="status-row">
            <span className={`status-pill ${freshnessClassMap[selectedStation.status]}`}>
              {freshnessLabelMap[selectedStation.status]}
            </span>
            <span className="status-pill is-neutral">Fuente: Telemetría</span>
          </div>
        </Panel>
      </div>
    </div>
  );
}

const readStoredAuthFlag = () => {
  if (typeof window === "undefined") {
    return true;
  }

  try {
    const stored = window.localStorage.getItem(authStorageKey);
    if (stored === null) {
      return true;
    }
    return stored === "true";
  } catch {
    return true;
  }
};

const readStoredAuthUserName = () => {
  if (typeof window === "undefined") {
    return defaultAuthUserName;
  }

  try {
    const stored = window.localStorage.getItem(authUserStorageKey);
    if (!stored || stored.trim().length === 0) {
      return defaultAuthUserName;
    }
    return stored;
  } catch {
    return defaultAuthUserName;
  }
};

function LoginView({
  onBack,
  onLogin,
}: {
  onBack: () => void;
  onLogin: () => void;
}) {
  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <div className="site-brand-icon" aria-hidden="true">
            <Droplets size={16} />
          </div>
          <div>
            <h1>Agua con Dato</h1>
            <p>Mockup de acceso para usuarios y administradores.</p>
          </div>
        </div>

        <div className="login-copy">
          <h2>Iniciar sesión</h2>
          <p>
            Flujo simulado de OAuth 2.0 para demo. Al continuar, se activará el
            estado de sesión local y volverás al resumen operativo.
          </p>
        </div>

        <button type="button" className="login-google-btn" onClick={onLogin}>
          <span className="login-google-mark" aria-hidden="true">G</span>
          Continuar con Google
        </button>
        <button type="button" className="login-back-btn" onClick={onBack}>
          Volver al dashboard
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const defaultManualWellId =
    wellMapPoints.find((well) => well.sourceType === "manual")?.id ?? wellMapPoints[0].id;
  const [activeView, setActiveView] = useState<ViewId>("overview");
  const [appScreen, setAppScreen] = useState<"dashboard" | "login">("dashboard");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => readStoredAuthFlag());
  const [authUserName, setAuthUserName] = useState<string>(() =>
    readStoredAuthUserName(),
  );
  const [selectedWellId, setSelectedWellId] = useState(wellMapPoints[0].id);
  const [selectedStationId, setSelectedStationId] = useState(meteoStationPoints[0].id);
  const [manualEntries, setManualEntries] = useState<ManualWellEntry[]>([]);
  const [wellState, setWellState] = useState(wellMapPoints);
  const [manualForm, setManualForm] = useState<ManualFormState>({
    wellId: defaultManualWellId,
    date: "2026-03-22",
    time: "10:30",
    level: "",
    operator: "Operador CAS",
    note: "",
  });

  const dashboardNow = useMemo(() => {
    const seed = new Date(mockNowIso).getTime();
    const manualTimes = manualEntries.map((entry) =>
      new Date(`${entry.date}T${entry.time}:00-03:00`).getTime(),
    );
    return new Date(Math.max(seed, ...manualTimes));
  }, [manualEntries]);

  const wells = useMemo(
    () =>
      wellState.map((well) => ({
        ...well,
        status: getFreshnessStatus(
          well.lastUpdate,
          dashboardNow,
          staleThresholdDaysDefault,
        ),
      })),
    [dashboardNow, wellState],
  );

  const stations = useMemo(
    () =>
      meteoStationPoints.map((station) => ({
        ...station,
        status: getFreshnessStatus(
          station.lastUpdate,
          dashboardNow,
          staleThresholdDaysDefault,
        ),
      })),
    [dashboardNow],
  );

  useEffect(() => {
    if (!wells.some((well) => well.id === selectedWellId)) {
      setSelectedWellId(wells[0].id);
    }
  }, [selectedWellId, wells]);

  useEffect(() => {
    if (!stations.some((station) => station.id === selectedStationId)) {
      setSelectedStationId(stations[0].id);
    }
  }, [selectedStationId, stations]);

  useEffect(() => {
    try {
      window.localStorage.setItem(authStorageKey, isLoggedIn ? "true" : "false");
    } catch {
      // Ignore persistence errors in mockup mode.
    }
  }, [isLoggedIn]);

  useEffect(() => {
    try {
      window.localStorage.setItem(authUserStorageKey, authUserName);
    } catch {
      // Ignore persistence errors in mockup mode.
    }
  }, [authUserName]);

  const overviewCards = useMemo(
    () =>
      computeOverviewCards({
        etrLastDate: "2025-10-09",
        etrLastUpdate: etrLastUpdateIso,
        etrMeanValue: 1.2,
        now: dashboardNow,
        snowLastUpdate: snowLastUpdateIso,
        snowSeries: snowOverviewSeries,
        stations,
        wells,
      }),
    [dashboardNow, stations, wells],
  );

  const handleManualSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedLevel = Number.parseFloat(manualForm.level);
    if (Number.isNaN(parsedLevel)) {
      return;
    }

    const timestamp = `${manualForm.date}T${manualForm.time}:00-03:00`;
    const chartLabel = toChartDateLabel(manualForm.date);
    const nextEntry: ManualWellEntry = {
      id: `manual-${Date.now()}`,
      wellId: manualForm.wellId,
      date: manualForm.date,
      time: manualForm.time,
      level: parsedLevel,
      operator: manualForm.operator.trim() || "Operador CAS",
      note: manualForm.note.trim(),
      sourceDevice: "mobile/tablet",
    };

    setWellState((previous) =>
      previous.map((well) =>
        well.id === manualForm.wellId
          ? {
              ...well,
              sourceType: "manual",
              lastUpdate: timestamp,
              levelSeries: upsertSeriesPoint(well.levelSeries, chartLabel, parsedLevel),
            }
          : well,
      ),
    );
    setManualEntries((previous) => [nextEntry, ...previous].slice(0, 12));
    setSelectedWellId(manualForm.wellId);
    setManualForm((previous) => ({ ...previous, level: "", note: "" }));
  };

  const handleOpenLogin = () => {
    setAppScreen("login");
  };

  const handleFakeGoogleLogin = () => {
    setIsLoggedIn(true);
    setAuthUserName((previous) =>
      previous.trim().length > 0 ? previous : defaultAuthUserName,
    );
    setActiveView("overview");
    setAppScreen("dashboard");
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setAppScreen("dashboard");
  };

  if (appScreen === "login") {
    return (
      <LoginView
        onBack={() => setAppScreen("dashboard")}
        onLogin={handleFakeGoogleLogin}
      />
    );
  }

  return (
    <div className="page-shell">
      <header className="site-header">
        <div className="site-brand">
          <div className="site-brand-icon" aria-hidden="true">
            <Droplets size={16} />
          </div>
          <div>
            <h1>Agua con Dato</h1>
            <p>
              Mockup unificado para ET-LAT, MODIS-Snow, Pozos y Meteo sobre una
              infraestructura común.
            </p>
          </div>
        </div>

        <div className="site-header-actions">
          <nav className="top-nav" aria-label="Views">
            {views.map((view) => {
              const Icon = navIconMap[view.id];
              return (
                <button
                  key={view.id}
                  type="button"
                  className={view.id === activeView ? "is-active" : ""}
                  onClick={() => setActiveView(view.id)}
                >
                  <Icon className="nav-icon" size={14} />
                  {view.label}
                </button>
              );
            })}
          </nav>

          <div className="auth-controls">
            {isLoggedIn ? (
              <>
                <span className="auth-user-chip">
                  <UserRound size={13} />
                  {authUserName}
                </span>
                <button
                  type="button"
                  className="auth-action-btn"
                  onClick={handleLogout}
                >
                  <LogOut size={13} />
                  Cerrar sesión
                </button>
              </>
            ) : (
              <button
                type="button"
                className="auth-action-btn auth-login-btn"
                onClick={handleOpenLogin}
              >
                <LogIn size={13} />
                Iniciar sesión
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="content-shell">
        {activeView === "overview" && (
          <OverviewView
            cards={overviewCards}
            onOpenView={(viewId) => setActiveView(viewId)}
            stations={stations}
            wells={wells}
          />
        )}
        {activeView === "etr" && <EtrView isLoggedIn={isLoggedIn} />}
        {activeView === "snow" && <SnowView />}
        {activeView === "wells" && (
          <WellsView
            manualEntries={manualEntries}
            manualForm={manualForm}
            now={dashboardNow}
            onManualChange={(next) => setManualForm((previous) => ({ ...previous, ...next }))}
            onManualSubmit={handleManualSubmit}
            onSelectWell={setSelectedWellId}
            selectedWellId={selectedWellId}
            wells={wells}
          />
        )}
        {activeView === "meteo" && (
          <MeteoView
            now={dashboardNow}
            onSelectStation={setSelectedStationId}
            selectedStationId={selectedStationId}
            stations={stations}
          />
        )}
      </main>
    </div>
  );
}
