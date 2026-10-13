export const HISTORY_START = "2021-01-01";
export type HistoryPreset = 1 | 2 | "all";
export type HistoryRange = { start_date: string; end_date: string };

export function historyPreset(years: HistoryPreset, today = new Date()): HistoryRange {
  const end_date = today.toISOString().slice(0, 10);
  if (years === "all") return { start_date: HISTORY_START, end_date };
  const start = new Date(`${end_date}T00:00:00Z`);
  const month = start.getUTCMonth();
  start.setUTCFullYear(start.getUTCFullYear() - years);
  if (start.getUTCMonth() !== month) start.setUTCDate(0); // February 29 -> February 28.
  return { start_date: [HISTORY_START, start.toISOString().slice(0, 10)].sort().at(-1)!, end_date };
}

export function validHistoryRange(range: HistoryRange, today = new Date()): boolean {
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value;
  return validDate(range.start_date) && validDate(range.end_date)
    && range.start_date >= HISTORY_START && range.start_date <= range.end_date
    && range.end_date <= today.toISOString().slice(0, 10);
}

export function zoomHistoryRange(start: string, end: string, monthly: boolean, current: HistoryRange): HistoryRange {
  const endOfBucket = new Date(`${end}T00:00:00Z`);
  if (monthly) endOfBucket.setUTCMonth(endOfBucket.getUTCMonth() + 1, 0);
  return {
    start_date: start < current.start_date ? current.start_date : start,
    end_date: [endOfBucket.toISOString().slice(0, 10), current.end_date].sort()[0],
  };
}
