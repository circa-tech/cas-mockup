import etrQuadrantsGeoJson from "../data/etrQuadrantsGeoJson.json";

const valleyBounds = {
  maxLat: -26.95,
  maxLon: -68.95,
  minLat: -28.75,
  minLon: -71.05,
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
const jpegExportQuality = 0.86;

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

type PixelPoint = {
  x: number;
  y: number;
};

type GeoPoint = {
  lat: number;
  lon: number;
};

type GeoBounds = {
  maxLat: number;
  maxLon: number;
  minLat: number;
  minLon: number;
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

const toPixelPoint = (
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

const getGeoBounds = (rings: GeoPoint[][]): GeoBounds => {
  const allPoints = rings.flat();
  const lonValues = allPoints.map((point) => point.lon);
  const latValues = allPoints.map((point) => point.lat);
  return {
    maxLat: Math.max(...latValues),
    maxLon: Math.max(...lonValues),
    minLat: Math.min(...latValues),
    minLon: Math.min(...lonValues),
  };
};

const expandGeoBounds = (bounds: GeoBounds): GeoBounds => {
  const lonSpan = Math.max(0.00015, bounds.maxLon - bounds.minLon);
  const latSpan = Math.max(0.00015, bounds.maxLat - bounds.minLat);
  const padLon = lonSpan * bboxPaddingRatio;
  const padLat = latSpan * bboxPaddingRatio;

  const minLon = clamp(bounds.minLon - padLon, valleyBounds.minLon, valleyBounds.maxLon);
  const maxLon = clamp(bounds.maxLon + padLon, valleyBounds.minLon, valleyBounds.maxLon);
  const minLat = clamp(bounds.minLat - padLat, valleyBounds.minLat, valleyBounds.maxLat);
  const maxLat = clamp(bounds.maxLat + padLat, valleyBounds.minLat, valleyBounds.maxLat);

  return {
    maxLat: Math.max(maxLat, minLat + 0.00015),
    maxLon: Math.max(maxLon, minLon + 0.00015),
    minLat,
    minLon,
  };
};

const buildEsriExportImageUrl = (bounds: GeoBounds) => {
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  const centerLon = (bounds.minLon + bounds.maxLon) / 2;
  const widthMeters = haversineMeters(centerLat, bounds.minLon, centerLat, bounds.maxLon);
  const heightMeters = haversineMeters(bounds.minLat, centerLon, bounds.maxLat, centerLon);
  const widthPx = clamp(
    Math.round(widthMeters / targetGroundResolutionMeters),
    minRequestDimensionPx,
    maxRequestDimensionPx,
  );
  const heightPx = clamp(
    Math.round(heightMeters / targetGroundResolutionMeters),
    minRequestDimensionPx,
    maxRequestDimensionPx,
  );

  const params = new URLSearchParams({
    bbox: `${bounds.minLon},${bounds.minLat},${bounds.maxLon},${bounds.maxLat}`,
    bboxSR: "4326",
    f: "image",
    format: "jpg",
    imageSR: "4326",
    size: `${widthPx},${heightPx}`,
  });

  return `${esriExportBaseUrl}?${params.toString()}`;
};

const toPixelRings = (
  geometry: QuadrantGeometry,
  width: number,
  height: number,
  bounds: GeoBounds,
): PixelPoint[][] =>
  toRings(geometry).map((ring) =>
    ring.map(([lon, lat]) => toPixelPoint(lon, lat, width, height, bounds)),
  );

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

export async function downloadMockQuadrantJpeg({
  filename,
  quadrantId,
}: {
  filename: string;
  quadrantId: string;
}) {
  const numericId = Number.parseInt(quadrantId, 10);
  const selectedFeature = quadrantFeatureById.get(numericId);

  if (!selectedFeature) {
    throw new Error(`No se encontró geometría para el cuadrante ${quadrantId}.`);
  }

  const geoRings = toGeoRings(selectedFeature.geometry);
  const paddedBounds = expandGeoBounds(getGeoBounds(geoRings));
  const dynamicExportUrl = buildEsriExportImageUrl(paddedBounds);

  let image: HTMLImageElement;
  let pixelProjectionBounds = paddedBounds;

  try {
    image = await loadImageCached(dynamicExportUrl);
  } catch {
    image = await loadImageCached(staticSatelliteImagePath);
    pixelProjectionBounds = valleyBounds;
  }

  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error("La imagen estática de referencia no tiene dimensiones válidas.");
  }

  const pixelRings = toPixelRings(
    selectedFeature.geometry,
    sourceWidth,
    sourceHeight,
    pixelProjectionBounds,
  );
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
  context.restore();

  context.save();
  context.scale(renderScale, renderScale);
  context.translate(-minX + outputPaddingPx, -minY + outputPaddingPx);
  traceRings(context, pixelRings);
  context.lineWidth = Math.max(0.8, 2 / renderScale);
  context.strokeStyle = "rgba(255, 255, 255, 0.95)";
  context.stroke();
  context.restore();

  const blob = await toBlob(canvas, "image/jpeg", jpegExportQuality);
  downloadBlob(blob, filename);
}
