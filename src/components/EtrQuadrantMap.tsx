import { useEffect, useRef } from "react";
import { GeoJSON, LayersControl, MapContainer, TileLayer, useMap } from "react-leaflet";
import etrQuadrantsGeoJson from "../data/etrQuadrantsGeoJson.json";
import { chartPalette } from "../data/mockupData";
import { ModifierWheelZoom } from "./ModifierWheelZoom";

export type EtrQuadrantSelection = {
  quadrantId: string;
  quadrantLabel: string;
};

type EtrQuadrantFeature = {
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
  selectedQuadrantId: string;
  selectedSummaryLabel: string;
  onSelect: (selection: EtrQuadrantSelection) => void;
};

const copiapoBounds: [[number, number], [number, number]] = [
  [-28.75, -71.05],
  [-26.95, -68.95],
];

const etrQuadrantFeatures = (etrQuadrantsGeoJson as EtrQuadrantFeatureCollection).features;

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

const preferredDefaultQuadrant = etrQuadrantFeatures.find(
  (feature) => getQuadrantId(feature) === 273,
);

export const defaultEtrQuadrantSelection: EtrQuadrantSelection = buildSelection(
  preferredDefaultQuadrant ?? etrQuadrantFeatures[0],
);

function InitialQuadrantViewport() {
  const map = useMap();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) {
      return;
    }

    hasInitialized.current = true;
    map.fitBounds(copiapoBounds, { padding: [12, 12] });
    map.setZoom(10);
  }, [map]);

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
  selectedQuadrantId,
  selectedSummaryLabel,
  onSelect,
}: EtrQuadrantMapProps) {
  useEffect(() => {
    if (selectedQuadrantId.trim().length > 0) {
      return;
    }

    onSelect(defaultEtrQuadrantSelection);
  }, [onSelect, selectedQuadrantId]);

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
          <InitialQuadrantViewport />
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
                data={etrQuadrantsGeoJson as GeoJSON.GeoJsonObject}
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
