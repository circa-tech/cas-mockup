import { BarGroup } from "../components/SimpleBarChart";
import { LinePoint, LineSeries } from "../components/SimpleLineChart";

export type ViewId = "etr" | "snow" | "wells" | "meteo";

export const views: { id: ViewId; label: string }[] = [
  { id: "etr", label: "ET-LAT" },
  { id: "snow", label: "MODIS Snow" },
  { id: "wells", label: "Pozos" },
  { id: "meteo", label: "Meteo" },
];

export const etrStats = [
  { label: "Ultima fecha disponible", value: "2025-10-09" },
  { label: "ETR media", value: "1.2 mm/dia" },
  { label: "ETMAX media", value: "1.8 mm/dia" },
];

export const etrOverviewBarGroups: BarGroup[] = [
  {
    label: "Frutales",
    series: [
      { label: "ETR", value: 9.0, color: "#8ff22a" },
      { label: "ETMAX", value: 18.8, color: "#ff6788" },
    ],
  },
  {
    label: "Hortalizas y Flores",
    series: [
      { label: "ETR", value: 8.1, color: "#8ff22a" },
      { label: "ETMAX", value: 16.0, color: "#ff6788" },
    ],
  },
  {
    label: "Praderas",
    series: [
      { label: "ETR", value: 10.3, color: "#8ff22a" },
      { label: "ETMAX", value: 17.4, color: "#ff6788" },
    ],
  },
  {
    label: "Sin Cultivo",
    series: [
      { label: "ETR", value: 5.9, color: "#8ff22a" },
      { label: "ETMAX", value: 14.1, color: "#ff6788" },
    ],
  },
  {
    label: "Vides y Parronales",
    series: [
      { label: "ETR", value: 16.7, color: "#8ff22a" },
      { label: "ETMAX", value: 20.8, color: "#ff6788" },
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
    color: "#8ff22a",
    points: toLinePoints(etr),
  },
  {
    label: "ETMAX media",
    color: "#ff6788",
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
    label: "Sectores acuifero 1 al 4",
    barGroups: [
      {
        label: "Frutales",
        series: [
          { label: "ETR", value: 31.2, color: "#8ff22a" },
          { label: "ETMAX", value: 28.0, color: "#ff6788" },
        ],
      },
      {
        label: "Praderas",
        series: [
          { label: "ETR", value: 5.0, color: "#8ff22a" },
          { label: "ETMAX", value: 13.2, color: "#ff6788" },
        ],
      },
      {
        label: "Sin Cultivo",
        series: [
          { label: "ETR", value: 5.2, color: "#8ff22a" },
          { label: "ETMAX", value: 12.7, color: "#ff6788" },
        ],
      },
      {
        label: "Vides y Parronales",
        series: [
          { label: "ETR", value: 15.4, color: "#8ff22a" },
          { label: "ETMAX", value: 19.8, color: "#ff6788" },
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
          { label: "ETR", value: 24.6, color: "#8ff22a" },
          { label: "ETMAX", value: 26.3, color: "#ff6788" },
        ],
      },
      {
        label: "Praderas",
        series: [
          { label: "ETR", value: 6.8, color: "#8ff22a" },
          { label: "ETMAX", value: 14.8, color: "#ff6788" },
        ],
      },
      {
        label: "Sin Cultivo",
        series: [
          { label: "ETR", value: 4.4, color: "#8ff22a" },
          { label: "ETMAX", value: 11.6, color: "#ff6788" },
        ],
      },
      {
        label: "Vides y Parronales",
        series: [
          { label: "ETR", value: 12.8, color: "#8ff22a" },
          { label: "ETMAX", value: 17.1, color: "#ff6788" },
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
          { label: "ETR", value: 28.4, color: "#8ff22a" },
          { label: "ETMAX", value: 30.1, color: "#ff6788" },
        ],
      },
      {
        label: "Praderas",
        series: [
          { label: "ETR", value: 7.6, color: "#8ff22a" },
          { label: "ETMAX", value: 15.8, color: "#ff6788" },
        ],
      },
      {
        label: "Sin Cultivo",
        series: [
          { label: "ETR", value: 6.2, color: "#8ff22a" },
          { label: "ETMAX", value: 13.9, color: "#ff6788" },
        ],
      },
      {
        label: "Vides y Parronales",
        series: [
          { label: "ETR", value: 17.3, color: "#8ff22a" },
          { label: "ETMAX", value: 21.6, color: "#ff6788" },
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

export const snowOverviewSeries: LineSeries[] = [
  {
    label: "Este ano",
    color: "#5a86d6",
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
    label: "Ano pasado",
    color: "#f16e43",
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
    label: "Este ano",
    color: "#5a86d6",
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
    label: "Ano pasado",
    color: "#f16e43",
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
    label: "Este ano",
    color: "#5a86d6",
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
    label: "Ano pasado",
    color: "#f16e43",
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
    label: "Este ano",
    color: "#5a86d6",
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
    label: "Ano pasado",
    color: "#f16e43",
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

type Well = {
  id: string;
  label: string;
  lastTransmission: string;
  points: LinePoint[];
  provider: string;
};

export const wells: Well[] = [
  {
    id: "guatulame",
    label: "Pozo Guatulame",
    lastTransmission: "Hace 12 min",
    points: [
      { label: "Feb 15", value: 3.62 },
      { label: "Feb 18", value: 3.74 },
      { label: "Feb 21", value: 3.85 },
      { label: "Feb 24", value: 3.61 },
      { label: "Feb 27", value: 3.51 },
      { label: "Mar 01", value: 3.6 },
      { label: "Mar 05", value: 3.73 },
      { label: "Mar 08", value: 3.85 },
      { label: "Mar 11", value: 3.97 },
      { label: "Mar 13", value: 4.06 },
      { label: "Mar 14", value: 3.95 },
    ],
    provider: "Proveedor Norte",
  },
  {
    id: "mal-paso",
    label: "Pozo Mal Paso",
    lastTransmission: "Hace 28 min",
    points: [
      { label: "Feb 15", value: 3.71 },
      { label: "Feb 18", value: 3.76 },
      { label: "Feb 21", value: 3.83 },
      { label: "Feb 24", value: 3.78 },
      { label: "Feb 27", value: 3.68 },
      { label: "Mar 01", value: 3.64 },
      { label: "Mar 05", value: 3.72 },
      { label: "Mar 08", value: 3.78 },
      { label: "Mar 11", value: 3.84 },
      { label: "Mar 13", value: 3.88 },
      { label: "Mar 14", value: 3.86 },
    ],
    provider: "Proveedor Centro",
  },
  {
    id: "las-juntas",
    label: "Pozo Las Juntas",
    lastTransmission: "Hace 41 min",
    points: [
      { label: "Feb 15", value: 3.58 },
      { label: "Feb 18", value: 3.62 },
      { label: "Feb 21", value: 3.68 },
      { label: "Feb 24", value: 3.66 },
      { label: "Feb 27", value: 3.59 },
      { label: "Mar 01", value: 3.57 },
      { label: "Mar 05", value: 3.63 },
      { label: "Mar 08", value: 3.67 },
      { label: "Mar 11", value: 3.7 },
      { label: "Mar 13", value: 3.72 },
      { label: "Mar 14", value: 3.69 },
    ],
    provider: "Proveedor Centro",
  },
  {
    id: "piedra-colgada",
    label: "Pozo Piedra Colgada",
    lastTransmission: "Hace 1 h 12 min",
    points: [
      { label: "Feb 15", value: 3.82 },
      { label: "Feb 18", value: 3.86 },
      { label: "Feb 21", value: 3.91 },
      { label: "Feb 24", value: 3.85 },
      { label: "Feb 27", value: 3.79 },
      { label: "Mar 01", value: 3.8 },
      { label: "Mar 05", value: 3.88 },
      { label: "Mar 08", value: 3.94 },
      { label: "Mar 11", value: 3.99 },
      { label: "Mar 13", value: 4.03 },
      { label: "Mar 14", value: 4.01 },
    ],
    provider: "Proveedor Sur",
  },
];

export const meteoStations = [
  {
    name: "Copiapo",
    temperature: "15.6°C",
    temperatureValue: 15.6,
    temperatureTrend: [13.8, 14.2, 14.6, 14.9, 15.1, 15.3, 15.6],
    humidity: "93%",
    humidityValue: 93,
    wind: "4.7 km/h",
    windValue: 4.7,
    status: "Parcial",
    signal: "Estable",
    updatedAt: "Actualizado hace 12 min",
  },
  {
    name: "Tierra Amarilla",
    temperature: "16.1°C",
    temperatureValue: 16.1,
    temperatureTrend: [14.0, 14.6, 15.0, 15.2, 15.7, 15.9, 16.1],
    humidity: "73%",
    humidityValue: 73,
    wind: "7.8 km/h",
    windValue: 7.8,
    status: "Despejado",
    signal: "Estable",
    updatedAt: "Actualizado hace 10 min",
  },
  {
    name: "Jorquera",
    temperature: "12.8°C",
    temperatureValue: 12.8,
    temperatureTrend: [10.2, 10.9, 11.1, 11.6, 12.0, 12.3, 12.8],
    humidity: "61%",
    humidityValue: 61,
    wind: "9.2 km/h",
    windValue: 9.2,
    status: "Despejado",
    signal: "Intermitente",
    updatedAt: "Actualizado hace 16 min",
  },
  {
    name: "Piedra Colgada",
    temperature: "17.4°C",
    temperatureValue: 17.4,
    temperatureTrend: [15.0, 15.6, 16.0, 16.3, 16.7, 17.0, 17.4],
    humidity: "58%",
    humidityValue: 58,
    wind: "6.2 km/h",
    windValue: 6.2,
    status: "Despejado",
    signal: "Estable",
    updatedAt: "Actualizado hace 8 min",
  },
];
