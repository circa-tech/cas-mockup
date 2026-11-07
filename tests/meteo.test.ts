import assert from "node:assert/strict";
import test from "node:test";
import { currentDayMetric, formatMeteoValue, formatWindDirection } from "../src/features/meteo/metrics";
import type { MeteoDerivedData } from "../src/features/meteo/types";

const data: MeteoDerivedData = { date: "2026-08-31", partial: true, cadence_seconds: 300, available_from: "2026-05-09",
  metrics: { air_temperature: { current: 21.9, min: 11, max: 25 }, precipitation: { total: 0 } } };

test("daily statistics reset at Chile midnight while current observations remain", () => {
  assert.equal(currentDayMetric(data, "air_temperature", new Date("2026-09-01T03:59:59Z")).max, 25);
  assert.equal(currentDayMetric(data, "air_temperature", new Date("2026-09-01T04:00:00Z")).max, undefined);
  assert.equal(currentDayMetric(data, "air_temperature", new Date("2026-09-01T04:00:00Z")).current, 21.9);
  assert.equal(currentDayMetric(data, "precipitation", new Date("2026-08-31T12:00:00Z")).total, 0);
});

test("display distinguishes missing data, zero and compass directions", () => {
  assert.equal(formatMeteoValue(null), "Sin datos");
  assert.equal(formatMeteoValue(0, 2, "mm"), "0 mm");
  assert.equal(formatMeteoValue(62.4, 0, "%"), "62 %");
  assert.equal(formatMeteoValue(21.34, 1, "MJ/m²"), "21,3 MJ/m²");
  assert.equal(formatWindDirection(245, true), "245° (OSO)");
  assert.equal(formatWindDirection(360, true), "0° (N)");
  assert.equal(formatWindDirection(null, true), "Variable");
  assert.equal(formatWindDirection(null, false), "Sin datos");
});
