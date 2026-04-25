import { BarGroup } from "../components/SimpleBarChart";
import { LinePoint, LineSeries } from "../components/SimpleLineChart";

export type ViewId = "overview" | "etr" | "snow" | "wells" | "meteo";

export const views: { id: ViewId; label: string }[] = [
  { id: "overview", label: "Resumen" },
  { id: "etr", label: "ET-LAT" },
  { id: "snow", label: "MODIS Snow" },
  { id: "wells", label: "Pozos" },
  { id: "meteo", label: "Meteo" },
];

export const etrStats = [
  { label: "Última fecha disponible", value: "2025-10-09" },
  { label: "ETR media", value: "1.2 mm/día" },
  { label: "ETMAX media", value: "1.8 mm/día" },
];

export const etrLastUpdateIso = "2026-03-21T07:15:00-03:00";
export const snowLastUpdateIso = "2026-03-20T06:45:00-03:00";

export const chartPalette = {
  chart1: "rgb(20, 104, 163)",
  chart2: "rgb(48, 166, 156)",
  chart3: "rgb(59, 169, 206)",
  chart4: "rgb(89, 123, 192)",
  chart5: "rgb(77, 179, 144)",
  chart6: "rgb(23, 112, 130)",
  chart7: "rgb(135, 166, 197)",
  chart8: "rgb(89, 197, 175)",
} as const;

const ETR_COLOR = chartPalette.chart2;
const ETMAX_COLOR = chartPalette.chart4;
const SNOW_CURRENT_COLOR = chartPalette.chart1;
const SNOW_PREVIOUS_COLOR = chartPalette.chart7;

export const etrOverviewBarGroups: BarGroup[] = [
  {
    label: "Frutales",
    series: [
      { label: "ETR", value: 9.0, color: ETR_COLOR },
      { label: "ETMAX", value: 18.8, color: ETMAX_COLOR },
    ],
  },
  {
    label: "Hortalizas y Flores",
    series: [
      { label: "ETR", value: 8.1, color: ETR_COLOR },
      { label: "ETMAX", value: 16.0, color: ETMAX_COLOR },
    ],
  },
  {
    label: "Praderas",
    series: [
      { label: "ETR", value: 10.3, color: ETR_COLOR },
      { label: "ETMAX", value: 17.4, color: ETMAX_COLOR },
    ],
  },
  {
    label: "Sin Cultivo",
    series: [
      { label: "ETR", value: 5.9, color: ETR_COLOR },
      { label: "ETMAX", value: 14.1, color: ETMAX_COLOR },
    ],
  },
  {
    label: "Vides y Parronales",
    series: [
      { label: "ETR", value: 16.7, color: ETR_COLOR },
      { label: "ETMAX", value: 20.8, color: ETMAX_COLOR },
    ],
  },
];

export type EtrRegionId = "acuifer-1-4" | "tierra-amarilla" | "valle-bajo";

export type EtrRegion = {
  id: EtrRegionId;
  label: string;
  barGroups: BarGroup[];
  seasonSeries: LineSeries[];
};

const etrDates = [
  "2025-05-02",
  "2025-05-07",
  "2025-05-12",
  "2025-05-17",
  "2025-05-22",
  "2025-05-27",
  "2025-06-01",
  "2025-06-06",
  "2025-06-11",
  "2025-06-16",
  "2025-06-18",
  "2025-06-21",
  "2025-06-26",
  "2025-07-01",
  "2025-07-06",
  "2025-07-08",
  "2025-07-11",
  "2025-07-16",
  "2025-07-21",
  "2025-07-26",
  "2025-07-28",
  "2025-07-31",
  "2025-08-05",
  "2025-08-15",
  "2025-08-20",
  "2025-08-25",
  "2025-08-30",
  "2025-09-04",
  "2025-09-06",
  "2025-09-09",
  "2025-09-14",
  "2025-09-19",
  "2025-09-24",
  "2025-09-26",
  "2025-09-29",
  "2025-10-06",
  "2025-10-09",
];

const toLinePoints = (values: number[]): LinePoint[] =>
  etrDates.map((label, index) => ({
    label,
    value: values[index],
  }));

const buildEtrSeries = (etr: number[], etmax: number[]): LineSeries[] => [
  {
    label: "ETR media",
    color: ETR_COLOR,
    points: toLinePoints(etr),
  },
  {
    label: "ETMAX media",
    color: ETMAX_COLOR,
    points: toLinePoints(etmax),
  },
];

export const etrOverviewSeasonSeries = buildEtrSeries(
  [
    0.4, 0.1, 0.4, 0.3, 0.3, 0.3, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.1, 0.1,
    0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.2, 0.1, 0.1, 0.1, 0.2, 0.2, 0.4, 0.3, 0.3,
    0.3, 0.4, 0.4, 0.5, 0.5, 0.8, 0.8,
  ],
  [
    0.9, 0.7, 0.9, 0.8, 0.8, 0.6, 0.6, 0.6, 0.5, 0.6, 0.4, 0.4, 0.4, 0.3, 0.4,
    0.4, 0.3, 0.4, 0.4, 0.5, 0.4, 0.6, 0.5, 0.6, 0.6, 0.6, 0.7, 1.0, 0.9, 0.9,
    1.0, 1.1, 1.3, 1.5, 1.4, 1.8, 1.8,
  ],
);

export const etrRegions: EtrRegion[] = [
  {
    id: "acuifer-1-4",
    label: "Sectores acuífero 1 al 4",
    barGroups: [
      {
        label: "Frutales",
        series: [
          { label: "ETR", value: 31.2, color: ETR_COLOR },
          { label: "ETMAX", value: 28.0, color: ETMAX_COLOR },
        ],
      },
      {
        label: "Praderas",
        series: [
          { label: "ETR", value: 5.0, color: ETR_COLOR },
          { label: "ETMAX", value: 13.2, color: ETMAX_COLOR },
        ],
      },
      {
        label: "Sin Cultivo",
        series: [
          { label: "ETR", value: 5.2, color: ETR_COLOR },
          { label: "ETMAX", value: 12.7, color: ETMAX_COLOR },
        ],
      },
      {
        label: "Vides y Parronales",
        series: [
          { label: "ETR", value: 15.4, color: ETR_COLOR },
          { label: "ETMAX", value: 19.8, color: ETMAX_COLOR },
        ],
      },
    ],
    seasonSeries: buildEtrSeries(
      [
        0.6, 0.4, 0.4, 0.4, 0.3, 0.3, 0.3, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.1,
        0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.2, 0.1, 0.1, 0.1, 0.2, 0.2, 0.4,
        0.3, 0.3, 0.3, 0.4, 0.6, 0.8, 0.7, 1.2, 1.3,
      ],
      [
        0.9, 0.8, 0.6, 0.6, 0.6, 0.5, 0.5, 0.5, 0.4, 0.6, 0.4, 0.4, 0.4, 0.3,
        0.4, 0.4, 0.3, 0.4, 0.4, 0.5, 0.4, 0.6, 0.5, 0.6, 0.6, 0.6, 0.7, 1.0,
        0.9, 0.9, 1.0, 1.1, 1.3, 1.5, 1.8, 1.6, 1.8,
      ],
    ),
  },
  {
    id: "tierra-amarilla",
    label: "Tierra Amarilla",
    barGroups: [
      {
        label: "Frutales",
        series: [
          { label: "ETR", value: 24.6, color: ETR_COLOR },
          { label: "ETMAX", value: 26.3, color: ETMAX_COLOR },
        ],
      },
      {
        label: "Praderas",
        series: [
          { label: "ETR", value: 6.8, color: ETR_COLOR },
          { label: "ETMAX", value: 14.8, color: ETMAX_COLOR },
        ],
      },
      {
        label: "Sin Cultivo",
        series: [
          { label: "ETR", value: 4.4, color: ETR_COLOR },
          { label: "ETMAX", value: 11.6, color: ETMAX_COLOR },
        ],
      },
      {
        label: "Vides y Parronales",
        series: [
          { label: "ETR", value: 12.8, color: ETR_COLOR },
          { label: "ETMAX", value: 17.1, color: ETMAX_COLOR },
        ],
      },
    ],
    seasonSeries: buildEtrSeries(
      [
        0.5, 0.3, 0.3, 0.3, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.1,
        0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.2, 0.2, 0.3,
        0.3, 0.3, 0.4, 0.5, 0.6, 0.6, 0.5, 0.8, 0.9,
      ],
      [
        0.8, 0.7, 0.6, 0.6, 0.6, 0.5, 0.5, 0.5, 0.4, 0.5, 0.4, 0.4, 0.4, 0.3,
        0.4, 0.4, 0.3, 0.4, 0.4, 0.4, 0.4, 0.5, 0.5, 0.6, 0.6, 0.6, 0.7, 0.9,
        0.8, 0.8, 0.9, 1.0, 1.1, 1.2, 1.1, 1.4, 1.5,
      ],
    ),
  },
  {
    id: "valle-bajo",
    label: "Valle bajo",
    barGroups: [
      {
        label: "Frutales",
        series: [
          { label: "ETR", value: 28.4, color: ETR_COLOR },
          { label: "ETMAX", value: 30.1, color: ETMAX_COLOR },
        ],
      },
      {
        label: "Praderas",
        series: [
          { label: "ETR", value: 7.6, color: ETR_COLOR },
          { label: "ETMAX", value: 15.8, color: ETMAX_COLOR },
        ],
      },
      {
        label: "Sin Cultivo",
        series: [
          { label: "ETR", value: 6.2, color: ETR_COLOR },
          { label: "ETMAX", value: 13.9, color: ETMAX_COLOR },
        ],
      },
      {
        label: "Vides y Parronales",
        series: [
          { label: "ETR", value: 17.3, color: ETR_COLOR },
          { label: "ETMAX", value: 21.6, color: ETMAX_COLOR },
        ],
      },
    ],
    seasonSeries: buildEtrSeries(
      [
        0.6, 0.5, 0.5, 0.5, 0.4, 0.4, 0.4, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.2,
        0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.3, 0.2, 0.2, 0.2, 0.3, 0.3, 0.5,
        0.4, 0.4, 0.5, 0.6, 0.8, 0.9, 0.8, 1.0, 1.1,
      ],
      [
        1.0, 0.9, 0.7, 0.7, 0.7, 0.6, 0.6, 0.6, 0.5, 0.6, 0.5, 0.5, 0.5, 0.4,
        0.5, 0.5, 0.4, 0.5, 0.5, 0.6, 0.5, 0.7, 0.6, 0.7, 0.7, 0.7, 0.8, 1.0,
        0.9, 0.9, 1.0, 1.1, 1.3, 1.4, 1.3, 1.6, 1.7,
      ],
    ),
  },
];

export type EtrUsoRecord = {
  cultivo: string;
  etmaxValue: number;
  etrEtmaxSeries: LineSeries[];
  etrValue: number;
  kcSeries: LineSeries[];
  laiSeries: LineSeries[];
  lastDate: string;
  sectorId: string;
};

const usoCultivos = [
  "Uva de mesa",
  "Olivo",
  "Nogal",
  "Frutales de carozo",
  "Hortalizas",
  "Pradera mixta",
  "Sin cultivo",
] as const;

const roundTo = (value: number, decimals = 1) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const buildUsageSeriesPoints = (
  sectorSeed: number,
  {
    base,
    bias = 0,
    clampMax,
    clampMin = 0,
    wave = 0.14,
  }: {
    base: number;
    bias?: number;
    clampMax: number;
    clampMin?: number;
    wave?: number;
  },
): LinePoint[] =>
  etrDates.map((label, index) => {
    const seasonal = Math.sin((index + sectorSeed * 0.38) / 4.8) * wave;
    const jitter = (((sectorSeed * 17 + index * 7) % 9) - 4) * 0.02;
    const trend = index * 0.003;
    const raw = base + seasonal + jitter + trend + bias;
    const value = Math.min(clampMax, Math.max(clampMin, raw));
    return {
      label,
      value: roundTo(value, 2),
    };
  });

const buildEtrUsoRecord = (sectorId: number): EtrUsoRecord => {
  const crop = usoCultivos[(sectorId - 1) % usoCultivos.length];
  const etrBase = 0.42 + ((sectorId * 11) % 7) * 0.08;
  const etmaxBase = etrBase + 0.52 + ((sectorId * 13) % 5) * 0.05;
  const kcBase = 0.28 + ((sectorId * 5) % 6) * 0.09;
  const laiBase = 0.9 + ((sectorId * 3) % 5) * 0.4;

  const etrSeries: LineSeries = {
    label: "ETR media",
    color: ETR_COLOR,
    points: buildUsageSeriesPoints(sectorId, {
      base: etrBase,
      clampMax: 2.2,
      wave: 0.19,
    }),
  };

  const etmaxSeries: LineSeries = {
    label: "ETMAX media",
    color: ETMAX_COLOR,
    points: buildUsageSeriesPoints(sectorId, {
      base: etmaxBase,
      clampMax: 2.8,
      wave: 0.21,
    }),
  };

  const kcSeries: LineSeries = {
    label: "Kc",
    color: chartPalette.chart1,
    points: buildUsageSeriesPoints(sectorId, {
      base: kcBase,
      clampMax: 1.35,
      clampMin: 0.15,
      wave: 0.11,
    }),
  };

  const laiSeries: LineSeries = {
    label: "LAI",
    color: chartPalette.chart5,
    points: buildUsageSeriesPoints(sectorId, {
      base: laiBase,
      clampMax: 4.4,
      clampMin: 0.1,
      wave: 0.4,
    }),
  };

  const lastDate = etrDates[etrDates.length - 1] ?? "2025-10-09";
  const etrValue = etrSeries.points[etrSeries.points.length - 1]?.value ?? 0;
  const etmaxValue = etmaxSeries.points[etmaxSeries.points.length - 1]?.value ?? 0;

  return {
    cultivo: crop,
    etmaxValue: roundTo(etmaxValue, 1),
    etrEtmaxSeries: [etrSeries, etmaxSeries],
    etrValue: roundTo(etrValue, 1),
    kcSeries: [kcSeries],
    laiSeries: [laiSeries],
    lastDate,
    sectorId: String(sectorId),
  };
};

export const etrUsoRecordsBySector: Record<string, EtrUsoRecord> = Array.from(
  { length: 22 },
  (_, index) => index + 1,
).reduce((accumulator, sectorId) => {
  accumulator[String(sectorId)] = buildEtrUsoRecord(sectorId);
  return accumulator;
}, {} as Record<string, EtrUsoRecord>);

export const getEtrUsoRecord = (sectorId: string): EtrUsoRecord =>
  etrUsoRecordsBySector[sectorId] ?? etrUsoRecordsBySector["1"];

export type EtrDownloadVariable = "ETR" | "ETMAX" | "KC" | "LAI";

export const etrDownloadVariables: { label: string; value: EtrDownloadVariable }[] = [
  { label: "ETR", value: "ETR" },
  { label: "ETMAX", value: "ETMAX" },
  { label: "Kc", value: "KC" },
  { label: "LAI", value: "LAI" },
];

export const etrDownloadMonthLabels = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

const getDownloadSeed = (quadrantId: string, variable: EtrDownloadVariable) => {
  const parsed = Number.parseInt(quadrantId, 10);
  const safeQuadrant = Number.isNaN(parsed) ? 1 : parsed;
  const variableOffset =
    etrDownloadVariables.findIndex((item) => item.value === variable) + 1;
  return safeQuadrant * 17 + variableOffset * 13;
};

const earliestYearByVariable: Record<EtrDownloadVariable, number> = {
  ETR: 2022,
  ETMAX: 2022,
  KC: 2023,
  LAI: 2023,
};

export const getEtrDownloadYears = (
  quadrantId: string,
  variable: EtrDownloadVariable,
): number[] => {
  const seed = getDownloadSeed(quadrantId, variable);
  const dynamicFloor = seed % 2 === 0 ? 2022 : 2023;
  const start = Math.max(earliestYearByVariable[variable], dynamicFloor);
  return Array.from({ length: 2025 - start + 1 }, (_, index) => start + index);
};

export const getEtrDownloadMonths = (
  quadrantId: string,
  variable: EtrDownloadVariable,
  year: number,
): number[] => {
  const seed = getDownloadSeed(quadrantId, variable) + year;
  const maxMonth = year === 2025 ? 10 : 12;
  const months = Array.from({ length: maxMonth }, (_, index) => index + 1).filter(
    (month) => {
      if (variable === "KC") {
        return month % 2 === 1;
      }
      if (variable === "LAI") {
        return month % 2 === 0 || month === maxMonth;
      }
      if ((month + seed) % 7 === 0 && month !== maxMonth) {
        return false;
      }
      return true;
    },
  );

  if (months.length > 0) {
    return months;
  }

  return [maxMonth];
};

export const getEtrDownloadDays = (
  quadrantId: string,
  variable: EtrDownloadVariable,
  year: number,
  month: number,
): number[] => {
  const seed = getDownloadSeed(quadrantId, variable) + year + month;
  const monthLength = new Date(year, month, 0).getDate();
  const cadence = [1, 9, 17, 25];
  const shift = seed % 2 === 0 ? 0 : 1;
  let days = cadence
    .map((day) => day + shift)
    .filter((day) => day <= monthLength);

  if (seed % 5 === 0 && days.length > 2) {
    days = days.slice(0, -1);
  }

  if (days.length > 0) {
    return days;
  }

  return [Math.min(1 + shift, monthLength)];
};

export const buildEtrDownloadFilename = ({
  day,
  month,
  quadrantId,
  variable,
  year,
}: {
  day: number;
  month: number;
  quadrantId: string;
  variable: EtrDownloadVariable;
  year: number;
}) =>
  `CAS_${variable}_Q${quadrantId}_${year}${String(month).padStart(2, "0")}${String(
    day,
  ).padStart(2, "0")}.tif`;

export const snowOverviewSeries: LineSeries[] = [
  {
    label: "2025",
    color: SNOW_CURRENT_COLOR,
    points: [
      { label: "Abr", value: 18 },
      { label: "May", value: 26 },
      { label: "Jun", value: 39 },
      { label: "Jul", value: 51 },
      { label: "Ago", value: 63 },
      { label: "Sep", value: 56 },
      { label: "Oct", value: 43 },
      { label: "Nov", value: 28 },
    ],
  },
  {
    label: "2024",
    color: SNOW_PREVIOUS_COLOR,
    points: [
      { label: "Abr", value: 14 },
      { label: "May", value: 21 },
      { label: "Jun", value: 33 },
      { label: "Jul", value: 42 },
      { label: "Ago", value: 48 },
      { label: "Sep", value: 37 },
      { label: "Oct", value: 24 },
      { label: "Nov", value: 15 },
    ],
  },
];

export const snowJorqueraSeries: LineSeries[] = [
  {
    label: "2025",
    color: SNOW_CURRENT_COLOR,
    points: [
      { label: "Abr", value: 20 },
      { label: "May", value: 31 },
      { label: "Jun", value: 47 },
      { label: "Jul", value: 59 },
      { label: "Ago", value: 72 },
      { label: "Sep", value: 64 },
      { label: "Oct", value: 47 },
      { label: "Nov", value: 30 },
    ],
  },
  {
    label: "2024",
    color: SNOW_PREVIOUS_COLOR,
    points: [
      { label: "Abr", value: 16 },
      { label: "May", value: 24 },
      { label: "Jun", value: 38 },
      { label: "Jul", value: 45 },
      { label: "Ago", value: 54 },
      { label: "Sep", value: 42 },
      { label: "Oct", value: 29 },
      { label: "Nov", value: 17 },
    ],
  },
];

export const snowPulidoSeries: LineSeries[] = [
  {
    label: "2025",
    color: SNOW_CURRENT_COLOR,
    points: [
      { label: "Abr", value: 17 },
      { label: "May", value: 27 },
      { label: "Jun", value: 41 },
      { label: "Jul", value: 54 },
      { label: "Ago", value: 66 },
      { label: "Sep", value: 58 },
      { label: "Oct", value: 39 },
      { label: "Nov", value: 23 },
    ],
  },
  {
    label: "2024",
    color: SNOW_PREVIOUS_COLOR,
    points: [
      { label: "Abr", value: 13 },
      { label: "May", value: 21 },
      { label: "Jun", value: 34 },
      { label: "Jul", value: 43 },
      { label: "Ago", value: 49 },
      { label: "Sep", value: 38 },
      { label: "Oct", value: 25 },
      { label: "Nov", value: 14 },
    ],
  },
];

export const snowManflasSeries: LineSeries[] = [
  {
    label: "2025",
    color: SNOW_CURRENT_COLOR,
    points: [
      { label: "Abr", value: 15 },
      { label: "May", value: 24 },
      { label: "Jun", value: 36 },
      { label: "Jul", value: 48 },
      { label: "Ago", value: 59 },
      { label: "Sep", value: 50 },
      { label: "Oct", value: 34 },
      { label: "Nov", value: 19 },
    ],
  },
  {
    label: "2024",
    color: SNOW_PREVIOUS_COLOR,
    points: [
      { label: "Abr", value: 11 },
      { label: "May", value: 18 },
      { label: "Jun", value: 29 },
      { label: "Jul", value: 38 },
      { label: "Ago", value: 44 },
      { label: "Sep", value: 34 },
      { label: "Oct", value: 21 },
      { label: "Nov", value: 12 },
    ],
  },
];

export type GeoPointStatus = "fresh" | "warning" | "stale";
export type TelemetrySourceType = "telemetry" | "manual";
export type WaterQualityStatus = "good" | "watch" | "alert";

type GeoPointBase = {
  id: string;
  lat: number;
  lng: number;
  lastUpdate: string;
  name: string;
  sourceType: TelemetrySourceType;
  status: GeoPointStatus;
};

export type WellMapPoint = GeoPointBase & {
  aquiferSector: string;
  levelSeries: LinePoint[];
  provider: string;
};

export type MeteoStationPoint = GeoPointBase & {
  humidityValue: number;
  pressureValue: number;
  temperatureValue: number;
  windValue: number;
};

export type WaterQualityRecord = {
  conductivity: number;
  lastSampleDate: string;
  pH: number;
  qualityStatus: WaterQualityStatus;
  turbidity: number;
  wellId: string;
};

export type ManualWellEntry = {
  date: string;
  id: string;
  level: number;
  note: string;
  operator: string;
  sourceDevice: "mobile/tablet";
  time: string;
  wellId: string;
};

export type OverviewCard = {
  id: string;
  lastUpdate: string;
  primaryKpi: string;
  secondaryKpi: string;
  status: GeoPointStatus;
  targetView: Exclude<ViewId, "overview">;
  title: string;
};

export type ComputeOverviewCardsInput = {
  etrLastDate: string;
  etrLastUpdate: string;
  etrMeanValue: number;
  now: Date;
  snowLastUpdate: string;
  snowSeries: LineSeries[];
  stations: MeteoStationPoint[];
  staleThresholdDays?: number;
  wells: WellMapPoint[];
};

export const staleThresholdDaysDefault = 2;
export const mockNowIso = "2026-03-22T12:00:00-03:00";

export const getFreshnessStatus = (
  lastUpdate: string,
  now: Date,
  staleThresholdDays = staleThresholdDaysDefault,
): GeoPointStatus => {
  const last = new Date(lastUpdate).getTime();
  const current = now.getTime();

  if (Number.isNaN(last) || Number.isNaN(current)) {
    return "stale";
  }

  const diffMs = Math.max(0, current - last);
  const staleMs = staleThresholdDays * 24 * 60 * 60 * 1000;

  if (diffMs > staleMs) {
    return "stale";
  }

  if (diffMs > staleMs / 2) {
    return "warning";
  }

  return "fresh";
};

const getNetworkStatus = (items: { status: GeoPointStatus }[]): GeoPointStatus => {
  if (items.some((item) => item.status === "stale")) {
    return "stale";
  }

  if (items.some((item) => item.status === "warning")) {
    return "warning";
  }

  return "fresh";
};

const getLatestUpdate = (items: { lastUpdate: string }[]) =>
  items.reduce((latest, item) => {
    if (!latest) {
      return item.lastUpdate;
    }

    return new Date(item.lastUpdate).getTime() > new Date(latest).getTime()
      ? item.lastUpdate
      : latest;
  }, "");

export const computeOverviewCards = ({
  etrLastDate,
  etrLastUpdate,
  etrMeanValue,
  now,
  snowLastUpdate,
  snowSeries,
  stations,
  staleThresholdDays = staleThresholdDaysDefault,
  wells,
}: ComputeOverviewCardsInput): OverviewCard[] => {
  const snowCurrent = snowSeries[0]?.points[snowSeries[0].points.length - 1]?.value ?? 0;
  const snowPrevious = snowSeries[1]?.points[snowSeries[1].points.length - 1]?.value ?? 0;
  const snowDelta = snowCurrent - snowPrevious;
  const stationsMeanTemp =
    stations.length > 0
      ? stations.reduce((total, station) => total + station.temperatureValue, 0) / stations.length
      : 0;
  const wellsOnTime = wells.filter((well) => well.status !== "stale").length;
  const wellsStale = wells.filter((well) => well.status === "stale").length;
  const stationsOnTime = stations.filter((station) => station.status !== "stale").length;
  const stationsStale = stations.filter((station) => station.status === "stale").length;

  return [
    {
      id: "overview-etr",
      title: "ETR",
      targetView: "etr",
      primaryKpi: `ETR media ${etrMeanValue.toFixed(1)} mm/día`,
      secondaryKpi: `Última fecha ${etrLastDate}`,
      status: getFreshnessStatus(etrLastUpdate, now, staleThresholdDays),
      lastUpdate: etrLastUpdate,
    },
    {
      id: "overview-snow",
      title: "Snow",
      targetView: "snow",
      primaryKpi: `FSCA área ${snowCurrent.toFixed(0)}%`,
      secondaryKpi: `Vs año pasado ${snowDelta >= 0 ? "+" : ""}${snowDelta.toFixed(0)} pp`,
      status: getFreshnessStatus(snowLastUpdate, now, staleThresholdDays),
      lastUpdate: snowLastUpdate,
    },
    {
      id: "overview-wells",
      title: "Pozos",
      targetView: "wells",
      primaryKpi: `${wellsOnTime}/${wells.length} al día`,
      secondaryKpi: `${wellsStale} sin reporte > 48 h`,
      status: getNetworkStatus(wells),
      lastUpdate: getLatestUpdate(wells),
    },
    {
      id: "overview-meteo",
      title: "Meteo",
      targetView: "meteo",
      primaryKpi: `Temp media red ${stationsMeanTemp.toFixed(1)} °C`,
      secondaryKpi: `${stationsStale} sin reporte > 48 h`,
      status: getNetworkStatus(stations),
      lastUpdate: getLatestUpdate(stations),
    },
  ];
};

const wellSeriesDates = [
  "Mar 12",
  "Mar 13",
  "Mar 14",
  "Mar 15",
  "Mar 16",
  "Mar 17",
  "Mar 18",
  "Mar 19",
  "Mar 20",
  "Mar 21",
];

const toWellSeries = (values: number[]): LinePoint[] =>
  wellSeriesDates.map((label, index) => ({
    label,
    value: values[index],
  }));

const wellSeedData: Omit<WellMapPoint, "status">[] = [
  {
    id: "guatulame",
    name: "Pozo Guatulame",
    lat: -27.281,
    lng: -70.361,
    lastUpdate: "2026-03-22T10:20:00-03:00",
    sourceType: "telemetry",
    provider: "Proveedor Norte",
    aquiferSector: "Acuífero 1",
    levelSeries: toWellSeries([3.6, 3.62, 3.65, 3.68, 3.7, 3.74, 3.78, 3.81, 3.87, 3.95]),
  },
  {
    id: "mal-paso",
    name: "Pozo Mal Paso",
    lat: -27.368,
    lng: -70.451,
    lastUpdate: "2026-03-21T07:40:00-03:00",
    sourceType: "telemetry",
    provider: "Proveedor Centro",
    aquiferSector: "Acuífero 2",
    levelSeries: toWellSeries([3.72, 3.7, 3.69, 3.68, 3.67, 3.66, 3.67, 3.7, 3.73, 3.76]),
  },
  {
    id: "las-juntas",
    name: "Pozo Las Juntas",
    lat: -27.14,
    lng: -70.211,
    lastUpdate: "2026-03-18T08:30:00-03:00",
    sourceType: "manual",
    provider: "Carga Manual",
    aquiferSector: "Acuífero 3",
    levelSeries: toWellSeries([3.55, 3.56, 3.58, 3.59, 3.6, 3.62, 3.61, 3.6, 3.58, 3.57]),
  },
  {
    id: "piedra-colgada",
    name: "Pozo Piedra Colgada",
    lat: -27.312,
    lng: -70.286,
    lastUpdate: "2026-03-20T16:15:00-03:00",
    sourceType: "manual",
    provider: "Carga Manual",
    aquiferSector: "Acuífero 4",
    levelSeries: toWellSeries([3.82, 3.81, 3.8, 3.79, 3.78, 3.79, 3.8, 3.83, 3.86, 3.9]),
  },
];

export const wellMapPoints: WellMapPoint[] = wellSeedData.map((well) => ({
  ...well,
  status: getFreshnessStatus(well.lastUpdate, new Date(mockNowIso)),
}));

export const waterQualityRecords: WaterQualityRecord[] = [
  {
    wellId: "guatulame",
    lastSampleDate: "2026-03-20",
    qualityStatus: "good",
    conductivity: 1.1,
    pH: 7.1,
    turbidity: 1.2,
  },
  {
    wellId: "mal-paso",
    lastSampleDate: "2026-03-19",
    qualityStatus: "watch",
    conductivity: 1.6,
    pH: 7.7,
    turbidity: 2.3,
  },
  {
    wellId: "las-juntas",
    lastSampleDate: "2026-03-15",
    qualityStatus: "alert",
    conductivity: 2.1,
    pH: 8.2,
    turbidity: 4.8,
  },
  {
    wellId: "piedra-colgada",
    lastSampleDate: "2026-03-21",
    qualityStatus: "good",
    conductivity: 1.3,
    pH: 7.3,
    turbidity: 1.5,
  },
];

const meteoSeedData: Omit<MeteoStationPoint, "status">[] = [
  {
    id: "meteo-copiapo",
    name: "Estación Copiapó",
    lat: -27.366,
    lng: -70.332,
    lastUpdate: "2026-03-22T09:10:00-03:00",
    sourceType: "telemetry",
    temperatureValue: 18.2,
    humidityValue: 42,
    windValue: 11.3,
    pressureValue: 1012,
  },
  {
    id: "meteo-tierra-amarilla",
    name: "Estación Tierra Amarilla",
    lat: -27.479,
    lng: -70.26,
    lastUpdate: "2026-03-19T06:20:00-03:00",
    sourceType: "telemetry",
    temperatureValue: 17.4,
    humidityValue: 47,
    windValue: 8.6,
    pressureValue: 1015,
  },
  {
    id: "meteo-jorquera",
    name: "Estación Jorquera",
    lat: -27.192,
    lng: -69.952,
    lastUpdate: "2026-03-21T08:05:00-03:00",
    sourceType: "telemetry",
    temperatureValue: 14.9,
    humidityValue: 53,
    windValue: 13.1,
    pressureValue: 1010,
  },
];

export const meteoStationPoints: MeteoStationPoint[] = meteoSeedData.map((station) => ({
  ...station,
  status: getFreshnessStatus(station.lastUpdate, new Date(mockNowIso)),
}));
