import assert from "node:assert/strict";
import test from "node:test";
import { formatTrendTooltip, secondaryHasTrend, smoothTrendPath, trendSegments, validTrendPoints } from "../src/features/meteo/trends";
import type { MeteoTrend } from "../src/features/meteo/types";
const series: MeteoTrend = { daily: false, unit: "°C", points: [
  { timestamp: "2026-11-07T12:00Z", value: 20 }, { timestamp: "2026-11-07T12:05Z", value: 21 },
  { timestamp: "2026-11-07T12:10Z", value: null }, { timestamp: "2026-11-07T13:00Z", value: 30 },
] };

test("explicit gap markers split the line after server reduction", () => {
  assert.deepEqual(trendSegments(validTrendPoints(series)).map((segment) => segment.map((point) => point.value)), [[20, 21], [30]]);
  assert.deepEqual(trendSegments([]), []);
  assert.equal(trendSegments([{ timestamp: "2026-11-07", value: 0 }])[0].length, 1);
  assert.equal(validTrendPoints({ ...series, points: Array(151).fill(series.points[0]) }).length, 0);
});

test("tooltip uses Chile time through the daylight-saving gap and daily calendar dates", () => {
  const now = new Date("2026-09-06T15:00Z");
  assert.equal(formatTrendTooltip({ timestamp: "2026-09-06T03:55Z", value: 21.9 }, series, now), "5 sept, 23:55 · 21,9 °C");
  assert.equal(formatTrendTooltip({ timestamp: "2026-09-06T04:05Z", value: 22 }, series, now), "6 sept, 01:05 · 22 °C");
  const daily = { ...series, daily: true, unit: "MJ/m²" };
  assert.equal(formatTrendTooltip({ timestamp: "2026-09-05", value: 21.34 }, daily, now, 1), "5 sept · 21,3 MJ/m²");
  assert.equal(formatTrendTooltip({ timestamp: "2026-09-06", value: 0 }, daily, now, 1), "hoy (hasta ahora) · 0 MJ/m²");
});

test("secondary numeric sensors are eligible while technical and agro cards are excluded", () => {
  for (const name of ["Soil Temperature", "Water Content", "Saturation Extract EC", "NDVI", "Reference Pressure"]) assert.equal(secondaryHasTrend(name), true);
  for (const name of ["Battery Voltage", "Logger Temperature", "Lightning Activity", "Orientation", "X-axis Level", "degree_days_5", "Air Temperature"]) assert.equal(secondaryHasTrend(name), false);
});

test("smooth curve passes through retained peaks without adding extra points", () => {
  const points = [{ timestamp: "a", value: 0, x: 0, y: 58 }, { timestamp: "b", value: 10, x: 50, y: 6 }, { timestamp: "c", value: 0, x: 100, y: 58 }];
  const path = smoothTrendPath(points);
  assert.match(path, /50,6/);
  assert.match(path, /100,58$/);
  assert.equal((path.match(/C/g) ?? []).length, 2);
});
