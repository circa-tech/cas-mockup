import { dateInChile } from "../../utils/date";
import type { MeteoAgrometeorology, MeteoSeasonRule } from "./types";

const isoDate = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export const seasonWindow = (rule: MeteoSeasonRule, today: string) => {
  const year = Number(today.slice(0, 4));
  const startThisYear = isoDate(year, rule.start_month, rule.start_day);
  const startYear = today >= startThisYear ? year : year - 1;
  const crossesYear = rule.end_month * 100 + rule.end_day < rule.start_month * 100 + rule.start_day;
  const start = isoDate(startYear, rule.start_month, rule.start_day);
  const end = isoDate(startYear + Number(crossesYear), rule.end_month, rule.end_day);
  return { start, end, active: today <= end, label: crossesYear ? `${startYear}–${startYear + 1}` : `${startYear}` };
};

export const seasonReading = (data: MeteoAgrometeorology, key: string, ruleKey: string, now: Date) => {
  const day = dateInChile(now);
  const rule = data.rules[ruleKey];
  if (!rule) return null;
  const window = seasonWindow(rule, day);
  const period = (data.periods[key] ?? []).find((candidate) => candidate.start_date === window.start && candidate.end_date === window.end);
  const today = window.active && data.daily_date === day ? data.today[key] ?? null : null;
  return { ...window, total: period?.total ?? null, today,
    includesToday: today != null && period?.through_date === day,
    availableFrom: period?.available_from && period.available_from > window.start ? period.available_from : null };
};

export const frostMonthReading = (data: MeteoAgrometeorology, now: Date) => {
  const start = `${dateInChile(now).slice(0, 7)}-01`;
  return (data.periods.frost_days_month ?? []).find((period) => period.start_date === start)?.total ?? null;
};
