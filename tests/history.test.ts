import assert from "node:assert/strict";
import test from "node:test";
import { historyPreset, validHistoryRange, zoomHistoryRange } from "../src/utils/history.ts";
import { canSaveResponse, canonicalUrl } from "../src/offline/apiFetch.ts";

test("presets include full history and handle leap years without skipping February", () => {
  const today = new Date("2024-02-29T12:00:00Z");
  assert.deepEqual(historyPreset(1, today), { start_date: "2023-02-28", end_date: "2024-02-29" });
  assert.equal(historyPreset(2, today).start_date, "2022-02-28");
  assert.equal(historyPreset("all", today).start_date, "2021-01-01");
});

test("custom ranges reject reversed, invalid, pre-2021 and future dates", () => {
  const today = new Date("2026-10-13T12:00:00Z");
  for (const [start_date, end_date] of [["2022-02-01", "2021-01-01"], ["2021-02-29", "2021-03-01"], ["2020-12-31", "2021-01-01"], ["2021-01-01", "2026-10-14"], ["", "2022-01-01"]]) {
    assert.equal(validHistoryRange({ start_date, end_date }, today), false);
  }
  assert.equal(validHistoryRange({ start_date: "2021-01-01", end_date: "2021-01-01" }, today), true);
});

test("monthly zoom includes the selected final month and respects requested bounds", () => {
  const current = { start_date: "2024-01-15", end_date: "2024-03-17" };
  assert.deepEqual(zoomHistoryRange("2024-01-01", "2024-02-01", true, current), { start_date: "2024-01-15", end_date: "2024-02-29" });
  assert.equal(zoomHistoryRange("2024-01-01", "2024-03-01", true, current).end_date, "2024-03-17");
  assert.equal(zoomHistoryRange("2024-01-16", "2024-01-20", false, current).end_date, "2024-01-20");
});

test("history offline entries remain distinct by range and selected entity", () => {
  Object.assign(globalThis, { window: { location: { origin: "https://example.test" } } });
  const first = canonicalUrl("https://example.test/api/v1/et-lat/history?sector_id=7&start_date=2021-01-01");
  const second = canonicalUrl("https://example.test/api/v1/et-lat/history?sector_id=8&start_date=2021-01-01");
  assert.notEqual(first, second);
  assert.equal(canSaveResponse(first), true);
  assert.equal(canSaveResponse("https://example.test/api/v1/modis-snow/history?area=ae"), true);
  assert.equal(canSaveResponse("https://example.test/api/v1/admin/history"), false);
});
