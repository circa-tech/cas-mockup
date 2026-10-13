export type GeoBounds = {
  maxLat: number;
  maxLon: number;
  minLat: number;
  minLon: number;
};

export type RasterBounds = {
  east: number;
  north: number;
  south: number;
  west: number;
};

export type PixelPoint = {
  x: number;
  y: number;
};

export const toPixelPoint = (
  lon: number,
  lat: number,
  width: number,
  height: number,
  bounds: GeoBounds,
): PixelPoint => {
  const xRatio = (lon - bounds.minLon) / (bounds.maxLon - bounds.minLon);
  const yRatio = (bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat);
  return {
    x: xRatio * width,
    y: yRatio * height,
  };
};

export const getRasterPixelBounds = (
  rasterBounds: RasterBounds,
  width: number,
  height: number,
  projectionBounds: GeoBounds,
) => {
  const northWest = toPixelPoint(
    rasterBounds.west,
    rasterBounds.north,
    width,
    height,
    projectionBounds,
  );
  const southEast = toPixelPoint(
    rasterBounds.east,
    rasterBounds.south,
    width,
    height,
    projectionBounds,
  );
  return {
    maxX: southEast.x,
    maxY: southEast.y,
    minX: northWest.x,
    minY: northWest.y,
  };
};
