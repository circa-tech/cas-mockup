import assert from "node:assert/strict";
import test from "node:test";
import { frostMonthReading, seasonReading, seasonWindow } from "../src/features/meteo/seasons";
import type { MeteoAgrometeorology } from "../src/features/meteo/types";

const rules = {
  degree_days: { start_month: 9, start_day: 1, end_month: 4, end_day: 30 },
  chill_hours: { start_month: 5, start_day: 1, end_month: 8, end_day: 31 },
  frost_days: { start_month: 9, start_day: 1, end_month: 8, end_day: 31 },
};
const data: MeteoAgrometeorology = {
  daily_date: "2026-08-31", today: { chill_hours: 1.5, frost_days: 0 }, chill_hours_supported: true, rules,
  periods: { chill_hours: [{ start_date: "2026-05-01", end_date: "2026-08-31", total: 801.5, available_from: "2026-05-09", through_date: "2026-08-31" }],
    degree_days_5: [{ start_date: "2025-09-01", end_date: "2026-04-30", total: 0, available_from: "2026-04-29", through_date: "2026-04-30" }],
    frost_days_month: [{ start_date: "2026-08-01", end_date: "2026-08-31", total: 0, available_from: "2026-08-01", through_date: "2026-08-31" }] },
};

test("Chile September midnight resets degree days and closes chill hours without new data", () => {
  const before = new Date("2026-09-01T03:59:59Z"), after = new Date("2026-09-01T04:00:00Z");
  const winter = seasonReading(data, "chill_hours", "chill_hours", before)!;
  assert.equal(winter.today, 1.5);
  assert.equal(winter.total, 801.5);
  assert.equal(winter.includesToday, true);
  assert.equal(winter.availableFrom, "2026-05-09");
  const closed = seasonReading(data, "chill_hours", "chill_hours", after)!;
  assert.equal(closed.active, false);
  assert.equal(closed.today, null);
  assert.equal(closed.total, 801.5);
  assert.equal(closed.label, "2026");
  assert.equal(seasonReading(data, "degree_days_5", "degree_days", before)!.total, 0);
  const reset = seasonReading(data, "degree_days_5", "degree_days", after)!;
  assert.equal(reset.active, true);
  assert.equal(reset.total, null);
  assert.equal(reset.start, "2026-09-01");
  assert.equal(frostMonthReading(data, before), 0);
  assert.equal(frostMonthReading(data, after), null);
});

test("May closes the previous degree-day season and starts chill-hour season", () => {
  assert.deepEqual(seasonWindow(rules.degree_days, "2027-05-01"), { start: "2026-09-01", end: "2027-04-30", active: false, label: "2026–2027" });
  assert.equal(seasonWindow(rules.chill_hours, "2027-05-01").active, true);
  assert.equal(seasonWindow(rules.chill_hours, "2027-05-01").start, "2027-05-01");
  assert.equal(seasonWindow(rules.chill_hours, "2027-01-01").label, "2026");
  assert.equal(seasonWindow(rules.frost_days, "2027-08-31").start, "2026-09-01");
});

test("missing closed seasons stay missing rather than becoming zero", () => {
  const reading = seasonReading({ ...data, periods: {} }, "degree_days_5", "degree_days", new Date("2026-06-01T12:00Z"));
  assert.equal(reading!.active, false);
  assert.equal(reading!.total, null);
  assert.equal(reading!.today, null);
});
