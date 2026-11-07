import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTitularRut } from "../src/features/wells/titular";

test("titular RUT accepts formatting variants and validates the check digit", () => {
  for (const value of ["12.345.678-5", "123456785", " 12 345 678 - 5 "]) {
    assert.equal(normalizeTitularRut(value), "12345678-5");
  }
  for (const value of ["", "12345678-9", "abc", "00000000-0"]) assert.equal(normalizeTitularRut(value), null);
});
