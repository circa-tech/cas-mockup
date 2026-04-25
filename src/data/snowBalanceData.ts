import { chartPalette } from "./mockupData";

export type SnowBalanceBasinId = "jorquera" | "pulido" | "manflas";
export type SnowBalanceComponentId = "perdidas" | "derretimiento" | "transporte";

export type SnowBalanceComponent = {
  value: number;
  max: number;
  min: number;
};

export type SnowBalanceRecord = {
  basin: SnowBalanceBasinId;
  year: number;
  components: Record<SnowBalanceComponentId, SnowBalanceComponent>;
  total: number;
};

type RawBalanceRecord = {
  basin: SnowBalanceBasinId;
  year: number;
  perdidas: number;
  derretimiento: number;
  transporte: number;
  mxPer: number;
  mnPer: number;
  mxDer: number;
  mnDer: number;
  mxTr: number;
  mnTr: number;
};

export const snowBalanceBasinLabels: Record<SnowBalanceBasinId, string> = {
  jorquera: "Jorquera",
  pulido: "Pulido",
  manflas: "Manflas",
};

export const snowBalanceComponentLabels: Record<SnowBalanceComponentId, string> = {
  perdidas: "Pérdidas",
  derretimiento: "Derretimiento",
  transporte: "Transporte",
};

export const snowBalanceComponentColors: Record<SnowBalanceComponentId, string> = {
  perdidas: chartPalette.chart1,
  derretimiento: chartPalette.chart2,
  transporte: chartPalette.chart4,
};

const RAW_BALANCE_RECORDS: RawBalanceRecord[] = [
  { basin: "pulido", year: 2001, perdidas: 3.48, derretimiento: 1.87, transporte: 0.75, mxPer: 17.09, mnPer: 0, mxDer: 5.76, mnDer: 0, mxTr: 8.9, mnTr: 0 },
  { basin: "pulido", year: 2002, perdidas: 147.29, derretimiento: 45.35, transporte: 21.99, mxPer: 172.93, mnPer: 121.65, mxDer: 52.69, mnDer: 38.01, mxTr: 37.36, mnTr: 6.63 },
  { basin: "pulido", year: 2003, perdidas: 1.04, derretimiento: 1.44, transporte: 2.19, mxPer: 14.79, mnPer: 0, mxDer: 5.37, mnDer: 0, mxTr: 10.43, mnTr: 0 },
  { basin: "pulido", year: 2004, perdidas: 50.85, derretimiento: 9.58, transporte: 6.4, mxPer: 60.03, mnPer: 41.68, mxDer: 12.21, mnDer: 6.96, mxTr: 11.9, mnTr: 0.9 },
  { basin: "pulido", year: 2005, perdidas: 60.01, derretimiento: 11.6, transporte: 8.04, mxPer: 69.47, mnPer: 50.56, mxDer: 14.31, mnDer: 8.89, mxTr: 13.7, mnTr: 2.37 },
  { basin: "pulido", year: 2006, perdidas: 4.91, derretimiento: 2.08, transporte: 0.37, mxPer: 18.37, mnPer: 0, mxDer: 5.94, mnDer: 0, mxTr: 8.44, mnTr: 0 },
  { basin: "pulido", year: 2007, perdidas: 16.6, derretimiento: 3.71, transporte: 0.48, mxPer: 28.56, mnPer: 4.65, mxDer: 7.13, mnDer: 0.29, mxTr: 7.64, mnTr: 0 },
  { basin: "pulido", year: 2008, perdidas: 47.49, derretimiento: 8.89, transporte: 5.79, mxPer: 56.69, mnPer: 38.29, mxDer: 11.53, mnDer: 6.26, mxTr: 11.3, mnTr: 0.27 },
  { basin: "pulido", year: 2009, perdidas: 29.41, derretimiento: 5.64, transporte: 2.45, mxPer: 39.8, mnPer: 19.02, mxDer: 8.61, mnDer: 2.66, mxTr: 8.68, mnTr: 0 },
  { basin: "pulido", year: 2010, perdidas: 103.79, derretimiento: 24.76, transporte: 15.28, mxPer: 119.71, mnPer: 87.87, mxDer: 29.32, mnDer: 20.2, mxTr: 24.82, mnTr: 5.73 },
  { basin: "pulido", year: 2011, perdidas: 68.74, derretimiento: 13.74, transporte: 9.55, mxPer: 78.91, mnPer: 58.57, mxDer: 16.65, mnDer: 10.83, mxTr: 15.64, mnTr: 3.45 },
  { basin: "pulido", year: 2012, perdidas: 32.05, derretimiento: 6.07, transporte: 2.93, mxPer: 42.18, mnPer: 21.92, mxDer: 8.97, mnDer: 3.17, mxTr: 9, mnTr: 0 },
  { basin: "pulido", year: 2013, perdidas: 59.18, derretimiento: 11.41, transporte: 7.89, mxPer: 68.59, mnPer: 49.78, mxDer: 14.1, mnDer: 8.72, mxTr: 13.53, mnTr: 2.25 },
  { basin: "pulido", year: 2014, perdidas: 58.36, derretimiento: 11.22, transporte: 7.75, mxPer: 67.72, mnPer: 48.99, mxDer: 13.9, mnDer: 8.54, mxTr: 13.36, mnTr: 2.13 },
  { basin: "manflas", year: 2001, perdidas: 4.73, derretimiento: 2.22, transporte: 0, mxPer: 5.76, mnPer: 0, mxDer: 10.24, mnDer: 0, mxTr: 3.76, mnTr: 0 },
  { basin: "manflas", year: 2002, perdidas: 204.69, derretimiento: 81.15, transporte: 20.66, mxPer: 52.69, mnPer: 38.01, mxDer: 96.26, mnDer: 66.04, mxTr: 27.74, mnTr: 13.59 },
  { basin: "manflas", year: 2003, perdidas: 1.38, derretimiento: 1.47, transporte: 0.15, mxPer: 5.37, mnPer: 0, mxDer: 9.57, mnDer: 0, mxTr: 3.95, mnTr: 0 },
  { basin: "manflas", year: 2004, perdidas: 70.47, derretimiento: 15.96, transporte: 5.4, mxPer: 12.21, mnPer: 6.96, mxDer: 21.36, mnDer: 10.55, mxTr: 7.94, mnTr: 2.87 },
  { basin: "manflas", year: 2005, perdidas: 83.21, derretimiento: 19.59, transporte: 6.75, mxPer: 14.31, mnPer: 8.89, mxDer: 25.16, mnDer: 14.01, mxTr: 9.36, mnTr: 4.14 },
  { basin: "manflas", year: 2006, perdidas: 6.7, derretimiento: 2.6, transporte: 0.02, mxPer: 5.94, mnPer: 0, mxDer: 10.53, mnDer: 0, mxTr: 3.74, mnTr: 0 },
  { basin: "manflas", year: 2007, perdidas: 22.88, derretimiento: 5.47, transporte: 0.94, mxPer: 7.13, mnPer: 0.29, mxDer: 12.51, mnDer: 0, mxTr: 4.24, mnTr: 0 },
  { basin: "manflas", year: 2008, perdidas: 65.79, derretimiento: 14.72, transporte: 4.92, mxPer: 11.53, mnPer: 6.26, mxDer: 20.15, mnDer: 9.3, mxTr: 7.46, mnTr: 0 },
  { basin: "manflas", year: 2009, perdidas: 40.66, derretimiento: 8.9, transporte: 2.45, mxPer: 8.61, mnPer: 2.66, mxDer: 15.02, mnDer: 2.77, mxTr: 5.32, mnTr: 0 },
  { basin: "manflas", year: 2010, perdidas: 144.13, derretimiento: 43.45, transporte: 13.55, mxPer: 29.32, mnPer: 20.2, mxDer: 52.83, mnDer: 34.06, mxTr: 17.94, mnTr: 9.15 },
  { basin: "manflas", year: 2011, perdidas: 95.34, derretimiento: 23.44, transporte: 8.06, mxPer: 16.65, mnPer: 10.83, mxDer: 29.43, mnDer: 17.45, mxTr: 10.87, mnTr: 5.25 },
  { basin: "manflas", year: 2012, perdidas: 44.33, derretimiento: 9.67, transporte: 2.8, mxPer: 8.97, mnPer: 3.17, mxDer: 15.64, mnDer: 3.7, mxTr: 5.59, mnTr: 0 },
  { basin: "manflas", year: 2013, perdidas: 82.05, derretimiento: 19.24, transporte: 6.62, mxPer: 14.1, mnPer: 8.72, mxDer: 24.79, mnDer: 13.7, mxTr: 9.22, mnTr: 4.03 },
  { basin: "manflas", year: 2014, perdidas: 80.9, derretimiento: 18.9, transporte: 6.5, mxPer: 13.9, mnPer: 8.54, mxDer: 24.42, mnDer: 13.38, mxTr: 9.09, mnTr: 3.92 },
  { basin: "jorquera", year: 2001, perdidas: 23.42, derretimiento: 6.01, transporte: 1.67, mxPer: 3.76, mnPer: 0, mxDer: 8.92, mnDer: 3.1, mxTr: 8.26, mnTr: 0 },
  { basin: "jorquera", year: 2002, perdidas: 192.9, derretimiento: 30.97, transporte: 50.95, mxPer: 27.74, mnPer: 13.59, mxDer: 36.84, mnDer: 25.1, mxTr: 64.23, mnTr: 37.67 },
  { basin: "jorquera", year: 2003, perdidas: 17.7, derretimiento: 5.35, transporte: 0.75, mxPer: 3.95, mnPer: 0, mxDer: 8.28, mnDer: 2.43, mxTr: 7.36, mnTr: 0 },
  { basin: "jorquera", year: 2004, perdidas: 29.09, derretimiento: 6.97, transporte: 5.53, mxPer: 7.94, mnPer: 2.87, mxDer: 10.12, mnDer: 3.83, mxTr: 12.65, mnTr: 0 },
  { basin: "jorquera", year: 2005, perdidas: 72.55, derretimiento: 11.91, transporte: 15.42, mxPer: 9.36, mnPer: 4.14, mxDer: 13.92, mnDer: 9.91, mxTr: 19.96, mnTr: 10.88 },
  { basin: "jorquera", year: 2006, perdidas: 19.18, derretimiento: 5.58, transporte: 1.27, mxPer: 3.74, mnPer: 0, mxDer: 8.45, mnDer: 2.72, mxTr: 7.75, mnTr: 0 },
  { basin: "jorquera", year: 2007, perdidas: 88.5, derretimiento: 13.33, transporte: 14.38, mxPer: 4.24, mnPer: 0, mxDer: 18.81, mnDer: 7.85, mxTr: 26.78, mnTr: 1.98 },
  { basin: "jorquera", year: 2008, perdidas: 43.87, derretimiento: 8.57, transporte: 8.4, mxPer: 7.46, mnPer: 2.38, mxDer: 10.91, mnDer: 6.23, mxTr: 13.7, mnTr: 3.11 },
  { basin: "jorquera", year: 2009, perdidas: 41.22, derretimiento: 8.15, transporte: 6.66, mxPer: 5.32, mnPer: 0, mxDer: 10.38, mnDer: 5.93, mxTr: 11.69, mnTr: 1.63 },
  { basin: "jorquera", year: 2010, perdidas: 92.5, derretimiento: 14.72, transporte: 23.21, mxPer: 17.94, mnPer: 9.15, mxDer: 18.42, mnDer: 11.02, mxTr: 31.59, mnTr: 14.84 },
  { basin: "jorquera", year: 2011, perdidas: 87.49, derretimiento: 13.8, transporte: 19.41, mxPer: 10.87, mnPer: 5.25, mxDer: 16, mnDer: 11.61, mxTr: 24.37, mnTr: 14.45 },
  { basin: "jorquera", year: 2012, perdidas: 31.33, derretimiento: 7.11, transporte: 4.96, mxPer: 5.59, mnPer: 0, mxDer: 9.59, mnDer: 4.64, mxTr: 10.56, mnTr: 0 },
  { basin: "jorquera", year: 2013, perdidas: 99.68, derretimiento: 15.26, transporte: 21.29, mxPer: 9.22, mnPer: 4.03, mxDer: 18.05, mnDer: 12.47, mxTr: 27.6, mnTr: 14.97 },
  { basin: "jorquera", year: 2014, perdidas: 27.97, derretimiento: 6.89, transporte: 5.66, mxPer: 9.09, mnPer: 3.92, mxDer: 10.43, mnDer: 3.35, mxTr: 13.68, mnTr: 0 },
  { basin: "pulido", year: 2015, perdidas: 10.37, derretimiento: 26.92, transporte: 25.16, mxPer: 126.44, mnPer: 92.3, mxDer: 51.81, mnDer: 22.04, mxTr: 35.38, mnTr: 14.93 },
  { basin: "manflas", year: 2015, perdidas: 151.9, derretimiento: 47.4, transporte: 14.45, mxPer: 173.61, mnPer: 130.2, mxDer: 57.46, mnDer: 37.34, mxTr: 24.67, mnTr: 4.22 },
  { basin: "jorquera", year: 2015, perdidas: 123.41, derretimiento: 19, transporte: 30.98, mxPer: 145.12, mnPer: 101.71, mxDer: 29.07, mnDer: 8.94, mxTr: 41.21, mnTr: 20.75 },
  { basin: "pulido", year: 2016, perdidas: 19.99, derretimiento: 4.19, transporte: 2.69, mxPer: 31.51, mnPer: 8.48, mxDer: 7.49, mnDer: 0.89, mxTr: 9.59, mnTr: 0 },
  { basin: "manflas", year: 2016, perdidas: 27.6, derretimiento: 6.33, transporte: 1.31, mxPer: 42.24, mnPer: 12.95, mxDer: 13.12, mnDer: 0, mxTr: 13.21, mnTr: 0 },
  { basin: "jorquera", year: 2016, perdidas: 68.85, derretimiento: 11.09, transporte: 11.06, mxPer: 83.5, mnPer: 54.21, mxDer: 17.88, mnDer: 4.17, mxTr: 17.96, mnTr: 4.17 },
  { basin: "pulido", year: 2017, perdidas: 156.99, derretimiento: 51.23, transporte: 38.24, mxPer: 184.94, mnPer: 129.04, mxDer: 59.22, mnDer: 43.23, mxTr: 54.88, mnTr: 21.5 },
  { basin: "manflas", year: 2017, perdidas: 218.22, derretimiento: 92, transporte: 22.3, mxPer: 253.76, mnPer: 182.68, mxDer: 108.48, mnDer: 75.53, mxTr: 39.02, mnTr: 5.53 },
  { basin: "jorquera", year: 2017, perdidas: 172.48, derretimiento: 27.36, transporte: 46.78, mxPer: 187.94, mnPer: 116.86, mxDer: 40.41, mnDer: 7.46, mxTr: 58.55, mnTr: 25.07 },
];

const DEMO_YEAR_OFFSET = 8;
const DEMO_YEAR_START = 2018;
const DEMO_YEAR_END = 2025;

// Preserve the original mock years for docs and derive the demo range in-memory.
const DEMO_BALANCE_RECORDS: RawBalanceRecord[] = RAW_BALANCE_RECORDS
  .map((record) => ({ ...record, year: record.year + DEMO_YEAR_OFFSET }))
  .filter((record) => record.year >= DEMO_YEAR_START && record.year <= DEMO_YEAR_END);

function toBalanceRecord(raw: RawBalanceRecord): SnowBalanceRecord {
  const total = raw.perdidas + raw.derretimiento + raw.transporte;

  return {
    basin: raw.basin,
    year: raw.year,
    total,
    components: {
      perdidas: { value: raw.perdidas, max: raw.mxPer, min: raw.mnPer },
      derretimiento: { value: raw.derretimiento, max: raw.mxDer, min: raw.mnDer },
      transporte: { value: raw.transporte, max: raw.mxTr, min: raw.mnTr },
    },
  };
}

export const snowBalanceRecordsByBasin: Record<SnowBalanceBasinId, SnowBalanceRecord[]> = {
  jorquera: [],
  pulido: [],
  manflas: [],
};

for (const record of DEMO_BALANCE_RECORDS) {
  snowBalanceRecordsByBasin[record.basin].push(toBalanceRecord(record));
}

for (const basin of Object.keys(snowBalanceRecordsByBasin) as SnowBalanceBasinId[]) {
  snowBalanceRecordsByBasin[basin].sort((a, b) => a.year - b.year);
}

export const snowBalanceLatestYear = Math.max(
  ...DEMO_BALANCE_RECORDS.map((record) => record.year),
);

export function getSnowBalanceYears(basin: SnowBalanceBasinId): number[] {
  return snowBalanceRecordsByBasin[basin].map((record) => record.year);
}

export function getSnowBalanceRecord(
  basin: SnowBalanceBasinId,
  year: number,
): SnowBalanceRecord {
  const records = snowBalanceRecordsByBasin[basin];
  const fallback = records[records.length - 1];
  return records.find((record) => record.year === year) ?? fallback;
}

export type SnowBalanceDisplayRow = {
  componentId: SnowBalanceComponentId;
  label: string;
  value: number;
  max: number;
  min: number;
  percent: number;
  color: string;
};

const round = (value: number, decimals = 1) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export function getSnowBalanceDisplayRows(
  record: SnowBalanceRecord,
): SnowBalanceDisplayRow[] {
  const total = record.total || 1;

  return (Object.keys(record.components) as SnowBalanceComponentId[]).map((componentId) => {
    const component = record.components[componentId];

    return {
      componentId,
      label: snowBalanceComponentLabels[componentId],
      value: component.value,
      max: component.max,
      min: component.min,
      percent: round((component.value / total) * 100, 1),
      color: snowBalanceComponentColors[componentId],
    };
  });
}
