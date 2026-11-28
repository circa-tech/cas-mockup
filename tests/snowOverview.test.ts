import assert from "node:assert/strict";
import test from "node:test";
import { buildSnowOverview } from "../src/features/overview/snowOverview.ts";
import type { HistoryResponse } from "../src/services/historyApi.ts";

const history = (dates: Array<[string, number | null]>): HistoryResponse => ({
  series_id: "ae",
  available_from: dates[0]?.[0] ?? null,
  available_to: dates.at(-1)?.[0] ?? null,
  start_date: "2021-01-01",
  end_date: "2026-11-28",
  resolution: "native",
  version: "test",
  generated_at: "2026-11-28T00:00:00Z",
  points: dates.map(([fecha, coverage]) => ({
    fecha,
    values: { coverage },
    minimum: {}, maximum: {}, count: {},
  })),
});

test("snow summary follows Nieve history beyond the older coverage snapshot", () => {
  const snapshot = [
    { fecha: "2026-09-30", esteano: 18, anopar: 12 },
  ];
  const first = buildSnowOverview(history([
    ["2025-11-20", 10], ["2026-11-20", 25],
  ]), snapshot);
  assert.equal(first.lastDate, "2026-11-20");
  assert.equal(first.series[0].points.at(-1)?.value, 25);
  assert.equal(first.series[1].points.at(-1)?.value, 10);

  const nextLoad = buildSnowOverview(history([
    ["2025-11-20", 10], ["2026-11-20", 25], ["2026-11-27", 30],
  ]), snapshot);
  assert.equal(nextLoad.lastDate, "2026-11-27");
  assert.equal(nextLoad.series[0].points.at(-1)?.value, 30);
  assert.equal(nextLoad.series[1].points.at(-1)?.label, "2026-11-20");
});

test("snow summary ignores null history and uses the available snapshot", () => {
  const result = buildSnowOverview(history([["2026-11-27", null]]), [
    { fecha: "2026-09-30", esteano: 18, anopar: null },
  ]);
  assert.equal(result.lastDate, "2026-09-30");
  assert.equal(result.series.length, 1);
});

test("snow history takes precedence when both sources contain the same date", () => {
  const result = buildSnowOverview(history([["2026-09-30", 24]]), [
    { fecha: "2026-09-30", esteano: 18, anopar: 12 },
  ]);
  assert.equal(result.series[0].points.at(-1)?.value, 24);
});
