export type EtrSectorSelection = {
  regionId: string;
  regionLabel: string;
  sectorId: string;
  sectorName: string;
};

export type EtrQuadrantSelection = {
  quadrantId: string;
  quadrantLabel: string;
};

export type EtrUsoSelection = {
  cultivo: string;
  date: string;
  etmaxRaw: number;
  etrRaw: number;
  usoId: string;
};

export type EtrUsoFeature = {
  geometry: {
    coordinates: number[][][][] | number[][][];
    type: "MultiPolygon" | "Polygon";
  };
  id: number | string;
  properties: {
    cultivo: string;
    etmax: number;
    etr: number;
    fecha: string;
    uso_id: number;
  };
};

export const buildEtrUsoSelection = (
  feature: EtrUsoFeature | undefined,
): EtrUsoSelection => {
  const candidate = feature?.properties.uso_id ?? feature?.id;
  const parsedId = Number.parseInt(String(candidate), 10);
  return {
    cultivo: feature?.properties.cultivo ?? "Sin dato",
    date: feature?.properties.fecha ?? "",
    etmaxRaw: feature?.properties.etmax ?? 0,
    etrRaw: feature?.properties.etr ?? 0,
    usoId: String(Number.isNaN(parsedId) ? 0 : parsedId),
  };
};

export const defaultEtrUsoMapSelection: EtrUsoSelection = {
  cultivo: "Parronales",
  date: "2026-04-12",
  etmaxRaw: 9.073684,
  etrRaw: 1.4036843,
  usoId: "855",
};

export const defaultEtrQuadrantSelection: EtrQuadrantSelection = {
  quadrantId: "273",
  quadrantLabel: "Cuadrante 273",
};
