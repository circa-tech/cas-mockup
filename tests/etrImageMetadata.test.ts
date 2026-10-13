import assert from "node:assert/strict";
import test from "node:test";

import { parseEtrImageBounds } from "../src/services/etrImageMetadata";
import {
  getNativeRasterRequest,
  getRasterPixelBounds,
} from "../src/utils/geoProjection";

test("parses valid raster bounds from the API header", () => {
  const bounds = parseEtrImageBounds(
    '{"east":383190,"north":6941890,"south":6936880,"west":378180}',
  );

  assert.deepEqual(bounds, {
    east: 383190,
    north: 6941890,
    south: 6936880,
    west: 378180,
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
    { east: 383190, north: 6941890, south: 6936880, west: 378180 },
    681,
    681,
    { maxX: 384090, maxY: 6942790, minX: 377280, minY: 6935980 },
  );

  const expected = { maxX: 591, maxY: 591, minX: 90, minY: 90 };
  for (const key of Object.keys(expected) as Array<keyof typeof expected>) {
    assert.ok(Math.abs(projected[key] - expected[key]) < 1e-9);
  }
});

test("expands native UTM bounds without changing the raster grid", () => {
  const raster = { east: 383190, north: 6941890, south: 6936880, west: 378180 };

  assert.deepEqual(getNativeRasterRequest(raster, { height: 501, width: 501 }, 0.18), {
    bounds: {
      maxX: 384090,
      maxY: 6942790,
      minX: 377280,
      minY: 6935980,
    },
    size: { height: 681, width: 681 },
  });
});
