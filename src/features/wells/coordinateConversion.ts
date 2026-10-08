const SEMI_MAJOR_AXIS = 6378137;
const ECCENTRICITY_SQUARED = 0.00669438;
const SCALE_FACTOR = 0.9996;

export type UtmCoordinates = {
  easting: number;
  northing: number;
  zone: number;
  hemisphere: "N" | "S";
};

export type GeographicCoordinates = {
  latitude: number;
  longitude: number;
};

export function geographicToUtm(latitude: number, longitude: number, fixedZone?: number): UtmCoordinates | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -80 || latitude > 84 || longitude < -180 || longitude > 180) return null;
  if (fixedZone !== undefined && (!Number.isInteger(fixedZone) || fixedZone < 1 || fixedZone > 60)) return null;

  const zone = fixedZone ?? (longitude === 180 ? 60 : Math.floor((longitude + 180) / 6) + 1);
  const latitudeRadians = degreesToRadians(latitude);
  const longitudeRadians = degreesToRadians(longitude);
  const centralMeridian = degreesToRadians((zone - 1) * 6 - 180 + 3);
  const eccentricityPrimeSquared = ECCENTRICITY_SQUARED / (1 - ECCENTRICITY_SQUARED);
  const sinLatitude = Math.sin(latitudeRadians);
  const cosLatitude = Math.cos(latitudeRadians);
  const tanLatitude = Math.tan(latitudeRadians);
  const radius = SEMI_MAJOR_AXIS / Math.sqrt(1 - ECCENTRICITY_SQUARED * sinLatitude ** 2);
  const t = tanLatitude ** 2;
  const c = eccentricityPrimeSquared * cosLatitude ** 2;
  const a = cosLatitude * (longitudeRadians - centralMeridian);
  const meridionalArc = meridianArc(latitudeRadians);

  const easting =
    SCALE_FACTOR *
      radius *
      (a + ((1 - t + c) * a ** 3) / 6 + ((5 - 18 * t + t ** 2 + 72 * c - 58 * eccentricityPrimeSquared) * a ** 5) / 120) +
    500000;
  let northing =
    SCALE_FACTOR *
    (meridionalArc +
      radius *
        tanLatitude *
        (a ** 2 / 2 + ((5 - t + 9 * c + 4 * c ** 2) * a ** 4) / 24 + ((61 - 58 * t + t ** 2 + 600 * c - 330 * eccentricityPrimeSquared) * a ** 6) / 720));
  const hemisphere = latitude < 0 ? "S" : "N";
  if (hemisphere === "S") northing += 10000000;

  return { easting, northing, zone, hemisphere };
}

export function utmToGeographic(
  easting: number,
  northing: number,
  zone: number,
  hemisphere: "N" | "S",
): GeographicCoordinates | null {
  if (!Number.isFinite(easting) || !Number.isFinite(northing) || !Number.isInteger(zone)) return null;
  if (zone < 1 || zone > 60 || easting < 100000 || easting > 900000 || northing < 0 || northing > 10000000) {
    return null;
  }

  const x = easting - 500000;
  const y = hemisphere === "S" ? northing - 10000000 : northing;
  const eccentricityPrimeSquared = ECCENTRICITY_SQUARED / (1 - ECCENTRICITY_SQUARED);
  const meridionalArc = y / SCALE_FACTOR;
  const mu =
    meridionalArc /
    (SEMI_MAJOR_AXIS *
      (1 -
        ECCENTRICITY_SQUARED / 4 -
        (3 * ECCENTRICITY_SQUARED ** 2) / 64 -
        (5 * ECCENTRICITY_SQUARED ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - ECCENTRICITY_SQUARED)) / (1 + Math.sqrt(1 - ECCENTRICITY_SQUARED));
  const footprintLatitude =
    mu +
    (3 * e1) / 2 * Math.sin(2 * mu) +
    (21 * e1 ** 2) / 16 * Math.sin(4 * mu) +
    (151 * e1 ** 3) / 96 * Math.sin(6 * mu) +
    (1097 * e1 ** 4) / 512 * Math.sin(8 * mu);
  const sinFootprint = Math.sin(footprintLatitude);
  const cosFootprint = Math.cos(footprintLatitude);
  const tanFootprint = Math.tan(footprintLatitude);
  const c1 = eccentricityPrimeSquared * cosFootprint ** 2;
  const t1 = tanFootprint ** 2;
  const n1 = SEMI_MAJOR_AXIS / Math.sqrt(1 - ECCENTRICITY_SQUARED * sinFootprint ** 2);
  const r1 = (SEMI_MAJOR_AXIS * (1 - ECCENTRICITY_SQUARED)) /
    (1 - ECCENTRICITY_SQUARED * sinFootprint ** 2) ** 1.5;
  const d = x / (n1 * SCALE_FACTOR);
  const latitude =
    footprintLatitude -
    ((n1 * tanFootprint) / r1) *
      (d ** 2 / 2 - ((5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * eccentricityPrimeSquared) * d ** 4) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * eccentricityPrimeSquared - 3 * c1 ** 2) * d ** 6) / 720);
  const centralMeridian = degreesToRadians((zone - 1) * 6 - 180 + 3);
  const longitude =
    centralMeridian +
    (d - ((1 + 2 * t1 + c1) * d ** 3) / 6 +
      ((5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * eccentricityPrimeSquared + 24 * t1 ** 2) * d ** 5) / 120) /
      cosFootprint;
  const latitudeDegrees = radiansToDegrees(latitude);
  const longitudeDegrees = radiansToDegrees(longitude);

  if (latitudeDegrees < -80 || latitudeDegrees > 84 || longitudeDegrees < -180 || longitudeDegrees > 180) return null;
  return { latitude: latitudeDegrees, longitude: longitudeDegrees };
}

export function parseUtmZone(value: string): { zone: number; hemisphere: "N" | "S" } | null {
  const match = value.trim().toUpperCase().match(/^(\d{1,2})\s*[- ]?\s*([NS])$/);
  if (!match) return null;
  const zone = Number(match[1]);
  if (zone < 1 || zone > 60) return null;
  return { zone, hemisphere: match[2] as "N" | "S" };
}

const degreesToRadians = (degrees: number) => (degrees * Math.PI) / 180;
const radiansToDegrees = (radians: number) => (radians * 180) / Math.PI;

function meridianArc(latitude: number): number {
  const e2 = ECCENTRICITY_SQUARED;
  const e4 = e2 ** 2;
  const e6 = e2 ** 3;
  return (
    SEMI_MAJOR_AXIS *
    ((1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * latitude -
      ((3 * e2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * latitude) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * latitude) -
      ((35 * e6) / 3072) * Math.sin(6 * latitude))
  );
}
