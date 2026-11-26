export type EtrImageBounds = {
  east: number;
  north: number;
  south: number;
  west: number;
};

export type EtrColorStop = { value: number; color: string };

export const parseEtrColorStops = (rawStops: string | null): EtrColorStop[] | null => {
  if (!rawStops) return null;
  try {
    const stops: unknown = JSON.parse(rawStops);
    if (
      !Array.isArray(stops) || stops.length !== 4 ||
      !stops.every((stop) =>
        typeof stop === "object" && stop !== null &&
        typeof stop.value === "number" && Number.isFinite(stop.value) &&
        typeof stop.color === "string" && /^#[0-9a-fA-F]{6}$/.test(stop.color),
      )
    ) return null;
    const parsed = stops as EtrColorStop[];
    return parsed.every((stop, index) => index === 0 || stop.value > parsed[index - 1].value)
      ? parsed : null;
  } catch {
    return null;
  }
};

export const parseEtrImageBounds = (rawBounds: string | null): EtrImageBounds | null => {
  if (!rawBounds) {
    return null;
  }

  try {
    const bounds: unknown = JSON.parse(rawBounds);
    if (typeof bounds !== "object" || bounds === null || Array.isArray(bounds)) {
      return null;
    }

    const values = bounds as Record<string, unknown>;
    if (
      !["south", "west", "north", "east"].every(
        (key) => typeof values[key] === "number" && Number.isFinite(values[key]),
      )
    ) {
      return null;
    }

    const parsed = values as EtrImageBounds;
    if (parsed.west >= parsed.east || parsed.south >= parsed.north) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};
