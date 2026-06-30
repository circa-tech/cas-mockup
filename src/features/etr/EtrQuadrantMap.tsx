import { useEffect, useMemo } from "react";
import { GeoJSON, LayersControl, MapContainer, TileLayer, useMap } from "react-leaflet";
import etrQuadrantsGeoJson from "../../data/etrQuadrantsGeoJson.json";
import { chartPalette } from "../../data/mockupData";
import { ModifierWheelZoom } from "../../components/ModifierWheelZoom";
import type { EtrQuadrantSelection } from "./mapSelections";

type EtrQuadrantFeature = {
  geometry: {
    coordinates: number[][][] | number[][][][];
    type: "MultiPolygon" | "Polygon";
  };
  id: number | string;
  properties: {
    id: number;
  };
};

type EtrQuadrantFeatureCollection = {
  features: EtrQuadrantFeature[];
  type: "FeatureCollection";
};

type EtrQuadrantMapProps = {
  geoJson?: { features: unknown[]; type: "FeatureCollection" };
  selectedQuadrantId: string;
  selectedSummaryLabel: string;
  onSelect: (selection: EtrQuadrantSelection) => void;
};

const copiapoBounds: [[number, number], [number, number]] = [
  [-28.75, -71.05],
  [-26.95, -68.95],
];

const localEtrQuadrantsGeoJson = etrQuadrantsGeoJson as EtrQuadrantFeatureCollection;

const getQuadrantId = (feature: EtrQuadrantFeature | undefined) => {
  const value = feature?.properties.id ?? feature?.id;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? 1 : parsed;
};

const buildSelection = (feature: EtrQuadrantFeature | undefined): EtrQuadrantSelection => {
  const quadrantId = String(getQuadrantId(feature));
  return {
    quadrantId,
    quadrantLabel: `Cuadrante ${quadrantId}`,
  };
};

const toGeometryRings = (feature: EtrQuadrantFeature | undefined): number[][][] => {
  if (!feature) {
    return [];
  }

  if (feature.geometry.type === "Polygon") {
    return feature.geometry.coordinates as number[][][];
  }

  return (feature.geometry.coordinates as number[][][][]).flatMap((polygon) => polygon);
};

const getFeatureBounds = (
  feature: EtrQuadrantFeature | undefined,
): [[number, number], [number, number]] | null => {
  const points = toGeometryRings(feature).flat();
  if (points.length === 0) {
    return null;
  }

  const longitudes = points.map(([lon]) => lon);
  const latitudes = points.map(([, lat]) => lat);
  return [
    [Math.min(...latitudes), Math.min(...longitudes)],
    [Math.max(...latitudes), Math.max(...longitudes)],
  ];
};

function QuadrantViewport({
  bounds,
}: {
  bounds: [[number, number], [number, number]];
}) {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(bounds, { maxZoom: 12, padding: [36, 36] });
  }, [bounds, map]);

  return null;
}

const quadrantStyle = {
  default: {
    color: "rgba(255, 255, 255, 0.92)",
    dashArray: "1",
    fillColor: "rgba(255, 255, 255, 0.18)",
    fillOpacity: 0,
    weight: 1,
  },
  selected: {
    color: chartPalette.chart8,
    dashArray: "",
    fillColor: chartPalette.chart8,
    fillOpacity: 0.26,
    weight: 1.8,
  },
} as const;

export function EtrQuadrantMap({
  geoJson = localEtrQuadrantsGeoJson,
  selectedQuadrantId,
  selectedSummaryLabel,
  onSelect,
}: EtrQuadrantMapProps) {
  const etrQuadrantFeatures = geoJson.features as EtrQuadrantFeature[];
  const selectedFeature =
    etrQuadrantFeatures.find(
      (feature) => selectedQuadrantId === String(getQuadrantId(feature)),
    ) ?? etrQuadrantFeatures[0];
  const selectedBounds = useMemo(
    () => getFeatureBounds(selectedFeature) ?? copiapoBounds,
    [selectedFeature],
  );

  useEffect(() => {
    if (selectedQuadrantId.trim().length > 0) {
      return;
    }

    onSelect(buildSelection(etrQuadrantFeatures[0]));
  }, [etrQuadrantFeatures, onSelect, selectedQuadrantId]);

  return (
    <div className="etr-map etr-quadrant-map">
      <div className="etr-region-map-shell">
        <MapContainer
          bounds={copiapoBounds}
          className="etr-region-map"
          preferCanvas
          scrollWheelZoom={false}
          zoomControl
        >
          <ModifierWheelZoom />
          <QuadrantViewport bounds={selectedBounds} />
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
            <LayersControl.Overlay checked name="Cuadrantes">
              <GeoJSON
                key={geoJson === localEtrQuadrantsGeoJson ? "local-quadrants" : "remote-quadrants"}
                data={geoJson as GeoJSON.GeoJsonObject}
                onEachFeature={(feature, layer) => {
                  const quadrantFeature = feature as unknown as EtrQuadrantFeature;
                  const selection = buildSelection(quadrantFeature);
                  layer.bindTooltip(selection.quadrantLabel, {
                    opacity: 0.95,
                    sticky: true,
                  });
                  layer.on({
                    click: () => onSelect(selection),
                  });
                }}
                style={(feature) => {
                  const quadrantFeature = feature as unknown as
                    | EtrQuadrantFeature
                    | undefined;
                  const isSelected =
                    selectedQuadrantId === String(getQuadrantId(quadrantFeature));
                  return {
                    color: isSelected
                      ? quadrantStyle.selected.color
                      : quadrantStyle.default.color,
                    dashArray: isSelected
                      ? quadrantStyle.selected.dashArray
                      : quadrantStyle.default.dashArray,
                    fillColor: isSelected
                      ? quadrantStyle.selected.fillColor
                      : quadrantStyle.default.fillColor,
                    fillOpacity: isSelected
                      ? quadrantStyle.selected.fillOpacity
                      : quadrantStyle.default.fillOpacity,
                    weight: isSelected
                      ? quadrantStyle.selected.weight
                      : quadrantStyle.default.weight,
                  };
                }}
              />
            </LayersControl.Overlay>
          </LayersControl>
        </MapContainer>

        <div className="etr-region-overlay">
          <strong>{selectedSummaryLabel}</strong>
          <span>Seleccione un cuadrante</span>
        </div>
      </div>
    </div>
  );
}
