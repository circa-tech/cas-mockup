import type { Workbook } from "exceljs";
import { chileTimeZone } from "./date";

export type { Workbook, Worksheet, CellValue } from "exceljs";
export const excelDateFormat = "dd-mm-yyyy hh:mm";
export const createWorkbook = async (): Promise<Workbook> => {
  const { default: ExcelJS } = await import("exceljs");
  return new ExcelJS.Workbook();
};
export const readWorkbook = async (bytes: ArrayBuffer): Promise<Workbook> => {
  const workbook = await createWorkbook();
  await workbook.xlsx.load(bytes);
  return workbook;
};
export const writeWorkbook = async (workbook: Workbook): Promise<Uint8Array> =>
  new Uint8Array(await workbook.xlsx.writeBuffer());
export const downloadWorkbook = async (workbook: Workbook, filename: string) => {
  const bytes = await writeWorkbook(workbook);
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Excel dates have no time zone: encode Chilean wall-clock fields in the UTC serial. */
export const excelDateInChile = (timestamp: number): Date => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: chileTimeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hourCycle: "h23", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(timestamp)).filter((part) => part.type !== "literal")
    .map((part) => [part.type, Number(part.value)]));
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
};
