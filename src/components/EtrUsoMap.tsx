import { useEffect, useRef } from "react";
import { GeoJSON, LayersControl, MapContainer, TileLayer, useMap } from "react-leaflet";
import etrUsoGeoJson from "../data/etrUsoGeoJson.json";
import { chartPalette } from "../data/mockupData";
import { ModifierWheelZoom } from "./ModifierWheelZoom";

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

type EtrUsoFeatureCollection = {
  features: EtrUsoFeature[];
  type: "FeatureCollection";
};

type EtrUsoMapProps = {
  geoJson?: { features: unknown[]; type: "FeatureCollection" };
  selectedSummaryLabel: string;
  selectedUsoId: string;
  onSelect: (selection: EtrUsoSelection) => void;
};

const copiapoBounds: [[number, number], [number, number]] = [
  [-28.75, -71.05],
  [-26.95, -68.95],
];

const localEtrUsoGeoJson = etrUsoGeoJson as EtrUsoFeatureCollection;

const getFeatureBounds = (feature: EtrUsoFeature | undefined) => {
  if (!feature) {
    return null;
  }

  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let minLon = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;

  const rings =
    feature.geometry.type === "Polygon"
      ? (feature.geometry.coordinates as number[][][])
      : (feature.geometry.coordinates as number[][][][]).flatMap((polygon) => polygon);

  rings.forEach((ring) => {
    ring.forEach(([lon, lat]) => {
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
    });
  });

  if (
    !Number.isFinite(minLat) ||
    !Number.isFinite(maxLat) ||
    !Number.isFinite(minLon) ||
    !Number.isFinite(maxLon)
  ) {
    return null;
  }

  return [
    [minLat, minLon],
    [maxLat, maxLon],
  ] as [[number, number], [number, number]];
};

const getUsoId = (feature: EtrUsoFeature | undefined) => {
  const candidate = feature?.properties.uso_id ?? feature?.id;
  const parsed = Number.parseInt(String(candidate), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const buildEtrUsoSelection = (feature: EtrUsoFeature | undefined): EtrUsoSelection => ({
  cultivo: feature?.properties.cultivo ?? "Sin dato",
  date: feature?.properties.fecha ?? "",
  etmaxRaw: feature?.properties.etmax ?? 0,
  etrRaw: feature?.properties.etr ?? 0,
  usoId: String(getUsoId(feature)),
});

export const defaultEtrUsoMapSelection: EtrUsoSelection = buildEtrUsoSelection(
  localEtrUsoGeoJson.features.find((feature) => String(getUsoId(feature)) === "855") ??
    localEtrUsoGeoJson.features[0],
);

function InitialUsoViewport({
  features,
  selectedUsoId,
}: {
  features: EtrUsoFeature[];
  selectedUsoId: string;
}) {
  const map = useMap();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) {
      return;
    }

    hasInitialized.current = true;
    const selectedFeature =
      features.find((feature) => String(getUsoId(feature)) === selectedUsoId) ??
      features[0];
    const selectedBounds = getFeatureBounds(selectedFeature);

    if (selectedBounds) {
      map.fitBounds(selectedBounds, { maxZoom: 16, padding: [16, 16] });
      map.setZoom(Math.min(16, map.getZoom() + 1));
      return;
    }

    map.fitBounds(copiapoBounds, { padding: [12, 12] });
    map.setZoom(12);
  }, [features, map, selectedUsoId]);

  return null;
}

const usoStyle = {
  default: {
    color: chartPalette.chart4,
    fillColor: chartPalette.chart7,
    fillOpacity: 0.25,
    weight: 0.7,
  },
  selected: {
    color: chartPalette.chart1,
    fillColor: chartPalette.chart3,
    fillOpacity: 0.5,
    weight: 1.6,
  },
} as const;

export function EtrUsoMap({
  geoJson = localEtrUsoGeoJson,
  selectedSummaryLabel,
  selectedUsoId,
  onSelect,
}: EtrUsoMapProps) {
  const etrUsoFeatures = geoJson.features as EtrUsoFeature[];

  useEffect(() => {
    if (selectedUsoId.trim().length > 0) {
      return;
    }

    onSelect(buildEtrUsoSelection(etrUsoFeatures[0]));
  }, [etrUsoFeatures, onSelect, selectedUsoId]);

  return (
    <div className="etr-map">
      <div className="etr-region-map-shell">
        <MapContainer
          bounds={copiapoBounds}
          className="etr-region-map"
          preferCanvas
          scrollWheelZoom={false}
          zoomControl
        >
          <ModifierWheelZoom />
          <InitialUsoViewport features={etrUsoFeatures} selectedUsoId={selectedUsoId} />
          <LayersControl position="topright">
            <LayersControl.BaseLayer name="OpenStreetMap">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer checked name="Esri Satellite">
              <TileLayer
                attribution="Tiles &copy; Esri"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
            </LayersControl.BaseLayer>
          </LayersControl>

          <GeoJSON
            key={geoJson === localEtrUsoGeoJson ? "local-uso-map" : "remote-uso-map"}
            data={geoJson as GeoJSON.GeoJsonObject}
            onEachFeature={(feature, layer) => {
              const usoFeature = feature as unknown as EtrUsoFeature;
              const selection = buildEtrUsoSelection(usoFeature);
              layer.bindTooltip(`${selection.cultivo} · Uso ${selection.usoId}`, {
                opacity: 0.95,
                sticky: true,
              });
              layer.on({
                click: () => onSelect(selection),
              });
            }}
            style={(feature) => {
              const usoFeature = feature as unknown as EtrUsoFeature | undefined;
              const isSelected = selectedUsoId === String(getUsoId(usoFeature));
              return {
                color: isSelected ? usoStyle.selected.color : usoStyle.default.color,
                fillColor: isSelected ? usoStyle.selected.fillColor : usoStyle.default.fillColor,
                fillOpacity: isSelected ? usoStyle.selected.fillOpacity : usoStyle.default.fillOpacity,
                weight: isSelected ? usoStyle.selected.weight : usoStyle.default.weight,
              };
            }}
          />
        </MapContainer>

        <div className="etr-region-overlay">
          <strong>{selectedSummaryLabel}</strong>
          <span>Seleccione un polígono</span>
        </div>
      </div>
    </div>
  );
}
