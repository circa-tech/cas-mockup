import etrQuadrantsGeoJson from "../data/etrQuadrantsGeoJson.json";
import {
  getNativeRasterRequest,
  getRasterPixelBounds,
  toPixelPoint,
  type PixelPoint,
  type PixelSize,
  type ProjectionBounds,
  type RasterBounds,
} from "./geoProjection";

const valleyBounds = {
  maxX: -68.95,
  maxY: -26.95,
  minX: -71.05,
  minY: -28.75,
} as const;

const staticSatelliteImagePath = `${import.meta.env.BASE_URL}mock/copiapo-satellite-static.jpg`;
const esriExportBaseUrl =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export";
const outputPaddingPx = 14;
const bboxPaddingRatio = 0.18;
const targetGroundResolutionMeters = 10;
const minRequestDimensionPx = 320;
const maxRequestDimensionPx = 900;
const maxOutputDimensionPx = 900;
const overlayOpacity = 0.72;
const geographicCrs = "EPSG:4326";
const nativeRasterCrs = "EPSG:32719";

type QuadrantGeometry = {
  coordinates: number[][][][] | number[][][];
  type: "MultiPolygon" | "Polygon";
};

type QuadrantFeature = {
  geometry: QuadrantGeometry;
  properties: {
    id: number;
  };
};

type QuadrantFeatureCollection = {
  features: QuadrantFeature[];
  type: "FeatureCollection";
};

type GeoPoint = {
  lat: number;
  lon: number;
};

type EsriExportResponse = {
  extent?: {
    xmax?: number;
    xmin?: number;
    ymax?: number;
    ymin?: number;
  };
  href?: string;
};

const quadrantFeatures = (etrQuadrantsGeoJson as QuadrantFeatureCollection).features;
const quadrantFeatureById = new Map<number, QuadrantFeature>(
  quadrantFeatures.map((feature) => [feature.properties.id, feature]),
);
const imageCache = new Map<string, Promise<HTMLImageElement>>();

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo cargar la imagen satelital base."));
    image.src = src;
  });

const loadImageCached = (src: string) => {
  const cached = imageCache.get(src);
  if (cached) {
    return cached;
  }

  const pending = loadImage(src).catch((error) => {
    imageCache.delete(src);
    throw error;
  });
  imageCache.set(src, pending);
  return pending;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const earthRadiusMeters = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRad(lat2 - lat1);
  const deltaLon = toRad(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(a));
};

const toRings = (geometry: QuadrantGeometry): number[][][] => {
  if (geometry.type === "Polygon") {
    return geometry.coordinates as number[][][];
  }

  return (geometry.coordinates as number[][][][]).flatMap((polygon) => polygon);
};

const toGeoRings = (geometry: QuadrantGeometry): GeoPoint[][] =>
  toRings(geometry).map((ring) =>
    ring.map(([lon, lat]) => ({
      lat,
      lon,
    })),
  );

const getGeoBounds = (rings: GeoPoint[][]): ProjectionBounds => {
  const allPoints = rings.flat();
  const lonValues = allPoints.map((point) => point.lon);
  const latValues = allPoints.map((point) => point.lat);
  return {
    maxX: Math.max(...lonValues),
    maxY: Math.max(...latValues),
    minX: Math.min(...lonValues),
    minY: Math.min(...latValues),
  };
};

const expandGeoBounds = (bounds: ProjectionBounds): ProjectionBounds => {
  const lonSpan = Math.max(0.00015, bounds.maxX - bounds.minX);
  const latSpan = Math.max(0.00015, bounds.maxY - bounds.minY);
  const padLon = lonSpan * bboxPaddingRatio;
  const padLat = latSpan * bboxPaddingRatio;

  const minX = clamp(bounds.minX - padLon, valleyBounds.minX, valleyBounds.maxX);
  const maxX = clamp(bounds.maxX + padLon, valleyBounds.minX, valleyBounds.maxX);
  const minY = clamp(bounds.minY - padLat, valleyBounds.minY, valleyBounds.maxY);
  const maxY = clamp(bounds.maxY + padLat, valleyBounds.minY, valleyBounds.maxY);

  return {
    maxX: Math.max(maxX, minX + 0.00015),
    maxY: Math.max(maxY, minY + 0.00015),
    minX,
    minY,
  };
};

export const buildEsriExportRequestUrl = (
  bounds: ProjectionBounds,
  crs: string,
  requestedSize?: PixelSize,
) => {
  const isGeographic = crs === geographicCrs;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const widthMeters = isGeographic
    ? haversineMeters(centerY, bounds.minX, centerY, bounds.maxX)
    : bounds.maxX - bounds.minX;
  const heightMeters = isGeographic
    ? haversineMeters(bounds.minY, centerX, bounds.maxY, centerX)
    : bounds.maxY - bounds.minY;
  const widthPx = requestedSize?.width ??
    clamp(
      Math.round(widthMeters / targetGroundResolutionMeters),
      minRequestDimensionPx,
      maxRequestDimensionPx,
    );
  const heightPx = requestedSize?.height ??
    clamp(
      Math.round(heightMeters / targetGroundResolutionMeters),
      minRequestDimensionPx,
      maxRequestDimensionPx,
    );

  const spatialReference = crs.replace(/^EPSG:/i, "");
  const params = new URLSearchParams({
    bbox: `${bounds.minX},${bounds.minY},${bounds.maxX},${bounds.maxY}`,
    bboxSR: spatialReference,
    f: "json",
    format: "jpg",
    imageSR: spatialReference,
    size: `${widthPx},${heightPx}`,
  });

  return `${esriExportBaseUrl}?${params.toString()}`;
};

const loadEsriExport = async (
  bounds: ProjectionBounds,
  crs: string,
  requestedSize?: PixelSize,
) => {
  const response = await fetch(buildEsriExportRequestUrl(bounds, crs, requestedSize));
  if (!response.ok) {
    throw new Error(`Esri export request failed: ${response.status}`);
  }

  const payload = (await response.json()) as EsriExportResponse;
  const extent = payload.extent;
  if (
    !payload.href ||
    !extent ||
    typeof extent.xmin !== "number" ||
    typeof extent.ymin !== "number" ||
    typeof extent.xmax !== "number" ||
    typeof extent.ymax !== "number"
  ) {
    throw new Error("Esri export response did not include an image extent.");
  }

  return {
    bounds: {
      maxX: extent.xmax,
      maxY: extent.ymax,
      minX: extent.xmin,
      minY: extent.ymin,
    },
    image: await loadImageCached(payload.href),
  };
};

const toPixelRings = (
  geometry: QuadrantGeometry,
  width: number,
  height: number,
  bounds: ProjectionBounds,
): PixelPoint[][] =>
  toRings(geometry).map((ring) =>
    ring.map(([lon, lat]) => toPixelPoint(lon, lat, width, height, bounds)),
  );

const pixelBoundsToRings = (bounds: ReturnType<typeof getRasterPixelBounds>): PixelPoint[][] => [
  [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.minY },
  ],
];

const getPixelBounds = (rings: PixelPoint[][]) => {
  const allPoints = rings.flat();
  const xValues = allPoints.map((point) => point.x);
  const yValues = allPoints.map((point) => point.y);
  return {
    maxX: Math.max(...xValues),
    maxY: Math.max(...yValues),
    minX: Math.min(...xValues),
    minY: Math.min(...yValues),
  };
};

const getScaledOutputSize = (width: number, height: number) => {
  const longestEdge = Math.max(width, height);

  if (longestEdge <= 0) {
    return {
      height: 1,
      scale: 1,
      width: 1,
    };
  }

  const scale = longestEdge > maxOutputDimensionPx ? maxOutputDimensionPx / longestEdge : 1;

  return {
    height: Math.max(1, Math.round(height * scale)),
    scale,
    width: Math.max(1, Math.round(width * scale)),
  };
};

const traceRings = (context: CanvasRenderingContext2D, rings: PixelPoint[][]) => {
  context.beginPath();
  rings.forEach((ring) => {
    if (ring.length === 0) {
      return;
    }
    context.moveTo(ring[0].x, ring[0].y);
    for (let index = 1; index < ring.length; index += 1) {
      context.lineTo(ring[index].x, ring[index].y);
    }
    context.closePath();
  });
};

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("No fue posible generar la descarga en el navegador."));
      },
      type,
      quality,
    );
  });

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export async function downloadMockQuadrantPng({
  filename,
  overlayBounds,
  overlayCrs,
  overlayUrl,
  quadrantId,
}: {
  filename: string;
  overlayBounds?: RasterBounds;
  overlayCrs?: string;
  overlayUrl?: string;
  quadrantId: string;
}) {
  const numericId = Number.parseInt(quadrantId, 10);
  const selectedFeature = quadrantFeatureById.get(numericId);

  if (!selectedFeature) {
    throw new Error(`No se encontró geometría para el cuadrante ${quadrantId}.`);
  }

  const geoRings = toGeoRings(selectedFeature.geometry);
  const paddedGeoBounds = expandGeoBounds(getGeoBounds(geoRings));
  const normalizedOverlayCrs = overlayCrs?.trim().toUpperCase();

  let overlayImage: HTMLImageElement | null = null;
  if (overlayUrl) {
    overlayImage = await loadImageCached(overlayUrl);
  }

  const useNativeRasterGrid = Boolean(
    overlayBounds && overlayImage && normalizedOverlayCrs === nativeRasterCrs,
  );
  const requestedCrs = useNativeRasterGrid ? nativeRasterCrs : geographicCrs;
  const nativeRequest = useNativeRasterGrid
    ? getNativeRasterRequest(
        overlayBounds!,
        {
          height: overlayImage!.naturalHeight || overlayImage!.height,
          width: overlayImage!.naturalWidth || overlayImage!.width,
        },
        bboxPaddingRatio,
      )
    : null;
  const requestedBounds = nativeRequest?.bounds ?? paddedGeoBounds;

  let image: HTMLImageElement;
  let pixelProjectionBounds = requestedBounds;
  let renderInNativeGrid = useNativeRasterGrid;

  try {
    const satelliteExport = await loadEsriExport(
      requestedBounds,
      requestedCrs,
      nativeRequest?.size,
    );
    image = satelliteExport.image;
    pixelProjectionBounds = satelliteExport.bounds;
  } catch {
    image = await loadImageCached(staticSatelliteImagePath);
    pixelProjectionBounds = valleyBounds;
    renderInNativeGrid = false;
  }

  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error("La imagen estática de referencia no tiene dimensiones válidas.");
  }

  let pixelRings: PixelPoint[][];
  let overlayPixelBounds: ReturnType<typeof getRasterPixelBounds>;
  if (renderInNativeGrid && overlayBounds) {
    overlayPixelBounds = getRasterPixelBounds(
      overlayBounds,
      sourceWidth,
      sourceHeight,
      pixelProjectionBounds,
    );
    pixelRings = pixelBoundsToRings(overlayPixelBounds);
  } else {
    pixelRings = toPixelRings(
      selectedFeature.geometry,
      sourceWidth,
      sourceHeight,
      pixelProjectionBounds,
    );
    const geographicPixelBounds = getPixelBounds(pixelRings);
    overlayPixelBounds =
      overlayBounds && normalizedOverlayCrs === geographicCrs
        ? getRasterPixelBounds(
            overlayBounds,
            sourceWidth,
            sourceHeight,
            pixelProjectionBounds,
          )
        : geographicPixelBounds;
  }
  const { maxX, maxY, minX, minY } = getPixelBounds(pixelRings);
  const cropWidth = Math.max(1, Math.ceil(maxX - minX + outputPaddingPx * 2));
  const cropHeight = Math.max(1, Math.ceil(maxY - minY + outputPaddingPx * 2));
  const {
    height: outputHeight,
    scale: renderScale,
    width: outputWidth,
  } = getScaledOutputSize(cropWidth, cropHeight);

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("El navegador no permitió crear un contexto de dibujo.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  context.save();
  context.scale(renderScale, renderScale);
  context.translate(-minX + outputPaddingPx, -minY + outputPaddingPx);
  traceRings(context, pixelRings);
  context.clip("evenodd");
  context.drawImage(image, 0, 0, sourceWidth, sourceHeight);

  if (overlayImage) {
    context.imageSmoothingEnabled = false;
    context.globalAlpha = overlayOpacity;
    context.drawImage(
      overlayImage,
      overlayPixelBounds.minX,
      overlayPixelBounds.minY,
      Math.max(1, overlayPixelBounds.maxX - overlayPixelBounds.minX),
      Math.max(1, overlayPixelBounds.maxY - overlayPixelBounds.minY),
    );
    context.globalAlpha = 1;
    context.imageSmoothingEnabled = true;
  }
  context.restore();

  context.save();
  context.scale(renderScale, renderScale);
  context.translate(-minX + outputPaddingPx, -minY + outputPaddingPx);
  traceRings(context, pixelRings);
  context.lineWidth = Math.max(0.8, 2 / renderScale);
  context.strokeStyle = "rgba(255, 255, 255, 0.95)";
  context.stroke();
  context.restore();

  const blob = await toBlob(canvas, "image/png");
  downloadBlob(blob, filename);
}
