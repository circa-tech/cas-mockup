import { BarGroup } from "../components/SimpleBarChart";
import { LinePoint, LineSeries } from "../components/SimpleLineChart";

export type ViewId = "etr" | "snow" | "wells" | "meteo";

export const views: { id: ViewId; label: string }[] = [
  { id: "etr", label: "ET-LAT" },
  { id: "snow", label: "MODIS Snow" },
  { id: "wells", label: "Wells" },
  { id: "meteo", label: "Meteo" },
];

export const etrStats = [
  { label: "Ultima fecha disponible", value: "2025-10-09" },
  { label: "ETR media", value: "1.2 mm/dia" },
  { label: "ETMAX media", value: "1.8 mm/dia" },
];

export const etrBarGroups: BarGroup[] = [
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

export const etrSeasonSeries: LineSeries[] = [
  {
    label: "ETR media",
    color: "#8ff22a",
    points: [
      { label: "2025-05-02", value: 0.4 },
      { label: "2025-05-12", value: 0.3 },
      { label: "2025-05-22", value: 0.3 },
      { label: "2025-06-01", value: 0.2 },
      { label: "2025-06-11", value: 0.2 },
      { label: "2025-06-26", value: 0.2 },
      { label: "2025-07-11", value: 0.2 },
      { label: "2025-07-28", value: 0.2 },
      { label: "2025-08-17", value: 0.3 },
      { label: "2025-09-04", value: 0.4 },
      { label: "2025-09-19", value: 0.5 },
      { label: "2025-10-06", value: 0.8 },
    ],
  },
  {
    label: "ETMAX media",
    color: "#ff6788",
    points: [
      { label: "2025-05-02", value: 0.9 },
      { label: "2025-05-12", value: 0.8 },
      { label: "2025-05-22", value: 0.8 },
      { label: "2025-06-01", value: 0.7 },
      { label: "2025-06-11", value: 0.6 },
      { label: "2025-06-26", value: 0.5 },
      { label: "2025-07-11", value: 0.6 },
      { label: "2025-07-28", value: 0.6 },
      { label: "2025-08-17", value: 0.9 },
      { label: "2025-09-04", value: 1.1 },
      { label: "2025-09-19", value: 1.3 },
      { label: "2025-10-06", value: 1.6 },
    ],
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

type Well = {
  id: string;
  label: string;
  points: LinePoint[];
};

export const wells: Well[] = [
  {
    id: "guatulame",
    label: "Pozo Guatulame",
    points: [
      { label: "Feb 15", value: 3.62 },
      { label: "Feb 18", value: 3.74 },
      { label: "Feb 21", value: 3.85 },
      { label: "Feb 24", value: 3.61 },
      { label: "Feb 27", value: 3.51 },
      { label: "Mar 01", value: 3.60 },
      { label: "Mar 05", value: 3.73 },
      { label: "Mar 08", value: 3.85 },
      { label: "Mar 11", value: 3.97 },
      { label: "Mar 13", value: 4.06 },
      { label: "Mar 14", value: 3.95 },
    ],
  },
  {
    id: "mal-paso",
    label: "Pozo Mal Paso",
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
  },
];

export const meteoStations = [
  {
    name: "Copiapo",
    temperature: "15.6°C",
    humidity: "93%",
    wind: "4.7 km/h",
    status: "Parcial",
    updatedAt: "Actualizado hace 12 min",
  },
  {
    name: "Tierra Amarilla",
    temperature: "16.1°C",
    humidity: "73%",
    wind: "7.8 km/h",
    status: "Despejado",
    updatedAt: "Actualizado hace 10 min",
  },
  {
    name: "Jorquera",
    temperature: "12.8°C",
    humidity: "61%",
    wind: "9.2 km/h",
    status: "Despejado",
    updatedAt: "Actualizado hace 16 min",
  },
];
