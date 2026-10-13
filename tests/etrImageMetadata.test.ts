import assert from "node:assert/strict";
import test from "node:test";

import { parseEtrImageBounds } from "../src/services/etrImageMetadata";
import { getRasterPixelBounds } from "../src/utils/geoProjection";

test("parses valid geographic bounds from the API header", () => {
  const bounds = parseEtrImageBounds(
    '{"east":-70.1840845146931,"north":-27.641593660123362,"south":-27.68722819980631,"west":-70.23537543639557}',
  );

  assert.deepEqual(bounds, {
    east: -70.1840845146931,
    north: -27.641593660123362,
    south: -27.68722819980631,
    west: -70.23537543639557,
  });
});

test("rejects incomplete, non-finite, or inverted bounds", () => {
  assert.equal(parseEtrImageBounds('{"west":-70,"east":-69}'), null);
  assert.equal(
    parseEtrImageBounds('{"west":-70,"east":-69,"south":null,"north":-27}'),
    null,
  );
  assert.equal(
    parseEtrImageBounds('{"west":-69,"east":-70,"south":-28,"north":-27}'),
    null,
  );
});

test("projects raster bounds against the actual background extent", () => {
  const projected = getRasterPixelBounds(
    { east: -70.18, north: -27.64, south: -27.69, west: -70.24 },
    800,
    600,
    { maxLat: -27.6, maxLon: -70.1, minLat: -27.75, minLon: -70.3 },
  );

  const expected = { maxX: 480, maxY: 360, minX: 240, minY: 160 };
  for (const key of Object.keys(expected) as Array<keyof typeof expected>) {
    assert.ok(Math.abs(projected[key] - expected[key]) < 1e-9);
  }
});
