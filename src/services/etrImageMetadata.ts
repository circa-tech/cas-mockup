export type EtrImageBounds = {
  east: number;
  north: number;
  south: number;
  west: number;
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
