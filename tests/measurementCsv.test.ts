import assert from "node:assert/strict";
import test from "node:test";

import { parseMeasurementCsv } from "../src/features/wells/measurementCsv";

const headers = "codigoObra,companyRut,userRut,flowRate,measurementDate,measurementTime,waterTableDepth,waterLevelCondition,totalizer,pressure,ph,conductivity,isOperating,observations";
const measurement = "77555666-7,20999888-7,1.00,2026-06-28,10:00:00,9.85,,1010,,,,,";
const wells = [
  { id: "well-1", codigoObra: "OB-0101-11" },
  { id: "well-2", codigoObra: null },
];

test("existing CSV work codes resolve to the internal well ID", () => {
  const [row] = parseMeasurementCsv(`${headers}\nOB-0101-11,${measurement}`, wells, "");
  assert.equal(row.wellId, "well-1");
});

test("CSV rows without a work code use the selected well", () => {
  const [row] = parseMeasurementCsv(`${headers}\n,${measurement}`, wells, "well-2");
  assert.equal(row.wellId, "well-2");
});

test("CSV rows without a work code require a selected well", () => {
  assert.throws(
    () => parseMeasurementCsv(`${headers}\n,${measurement}`, wells, ""),
    /selecciona un pozo/,
  );
});
