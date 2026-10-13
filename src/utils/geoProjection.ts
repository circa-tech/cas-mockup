export type ProjectionBounds = {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
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

export type PixelSize = {
  height: number;
  width: number;
};

export const toPixelPoint = (
  x: number,
  y: number,
  width: number,
  height: number,
  bounds: ProjectionBounds,
): PixelPoint => {
  const xRatio = (x - bounds.minX) / (bounds.maxX - bounds.minX);
  const yRatio = (bounds.maxY - y) / (bounds.maxY - bounds.minY);
  return {
    x: xRatio * width,
    y: yRatio * height,
  };
};

export const getRasterPixelBounds = (
  rasterBounds: RasterBounds,
  width: number,
  height: number,
  projectionBounds: ProjectionBounds,
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

export const getNativeRasterRequest = (
  bounds: RasterBounds,
  imageSize: PixelSize,
  paddingRatio: number,
): { bounds: ProjectionBounds; size: PixelSize } => {
  const paddingX = Math.round(imageSize.width * paddingRatio);
  const paddingY = Math.round(imageSize.height * paddingRatio);
  const resolutionX = (bounds.east - bounds.west) / imageSize.width;
  const resolutionY = (bounds.north - bounds.south) / imageSize.height;
  return {
    bounds: {
      maxX: bounds.east + paddingX * resolutionX,
      maxY: bounds.north + paddingY * resolutionY,
      minX: bounds.west - paddingX * resolutionX,
      minY: bounds.south - paddingY * resolutionY,
    },
    size: {
      height: imageSize.height + paddingY * 2,
      width: imageSize.width + paddingX * 2,
    },
  };
};
