import { useEffect, useRef } from "react";
import { LayersControl, MapContainer, Polygon, TileLayer, Tooltip, useMap } from "react-leaflet";
import etrSectorsGeoJson from "../data/etrSectorsGeoJson.json";
import { chartPalette } from "../data/mockupData";
import { ModifierWheelZoom } from "./ModifierWheelZoom";

export type EtrSectorSelection = {
  regionId: string;
  regionLabel: string;
  sectorId: string;
  sectorName: string;
};

type EtrMapProps = {
  selectedSectorId: string;
  selectedSummaryLabel: string;
  onSelect: (selection: EtrSectorSelection) => void;
};

const copiapoBounds: [[number, number], [number, number]] = [
  [-28.75, -71.05],
  [-26.95, -68.95],
];

type GeoJsonCoordinates = number[][][][] | number[][][];

type EtrSectorFeature = {
  id: number | string;
  geometry: {
    coordinates: GeoJsonCoordinates;
    type: "MultiPolygon" | "Polygon";
  };
  properties: {
    nombre: string;
    sector_id: number;
  };
};

type EtrSectorFeatureCollection = {
  features: EtrSectorFeature[];
  type: "FeatureCollection";
};

const etrFeatures = (etrSectorsGeoJson as EtrSectorFeatureCollection).features;

const sectorGroupById: Record<number, string> = {
  1: "acuifer-1-4",
  2: "acuifer-1-4",
  3: "acuifer-1-4",
  4: "acuifer-1-4",
  5: "tierra-amarilla",
  6: "tierra-amarilla",
  7: "tierra-amarilla",
  8: "tierra-amarilla",
  9: "tierra-amarilla",
  10: "tierra-amarilla",
  11: "tierra-amarilla",
  12: "tierra-amarilla",
  13: "tierra-amarilla",
  14: "tierra-amarilla",
  15: "tierra-amarilla",
  16: "tierra-amarilla",
  17: "tierra-amarilla",
  18: "tierra-amarilla",
  19: "valle-bajo",
  20: "valle-bajo",
  21: "valle-bajo",
  22: "valle-bajo",
};

const regionLabelById: Record<string, string> = {
  "acuifer-1-4": "Sectores acuífero 1 al 4",
  "tierra-amarilla": "Tierra Amarilla",
  "valle-bajo": "Valle bajo",
};

const toLatLng = (position: number[]) => [position[1], position[0]] as [number, number];

const toPolygonPositions = (geometry: EtrSectorFeature["geometry"]) => {
  if (geometry.type === "Polygon") {
    return (geometry.coordinates as number[][][]).map((ring) => ring.map(toLatLng));
  }

  return (geometry.coordinates as number[][][][]).map((polygon) =>
    polygon.map((ring) => ring.map(toLatLng)),
  );
};

function InitialEtrViewport() {
  const map = useMap();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) {
      return;
    }

    hasInitialized.current = true;
    map.fitBounds(copiapoBounds, { padding: [12, 12] });
    map.setZoom(map.getZoom() + 1);
  }, [map]);

  return null;
}

const sectorStyle = {
  default: {
    color: chartPalette.chart4,
    fillColor: chartPalette.chart7,
    fillOpacity: 0.3,
    weight: 2,
  },
  selected: {
    color: chartPalette.chart1,
    fillColor: chartPalette.chart3,
    fillOpacity: 0.55,
    weight: 3,
  },
} as const;

export function EtrMap({
  selectedSectorId,
  selectedSummaryLabel,
  onSelect,
}: EtrMapProps) {
  return (
    <div className="etr-map">
      <div className="etr-region-map-shell">
        <MapContainer
          bounds={copiapoBounds}
          className="etr-region-map"
          scrollWheelZoom={false}
          zoomControl
        >
          <ModifierWheelZoom />
          <InitialEtrViewport />
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

          {etrFeatures.map((feature) => {
            const sectorId = Number(feature.properties.sector_id ?? feature.id);
            const regionId = sectorGroupById[sectorId];
            if (!regionId) {
              return null;
            }

            const isSelected = selectedSectorId === String(sectorId);

            return (
              <Polygon
                key={String(feature.id)}
                eventHandlers={{
                  click: () =>
                    onSelect({
                      sectorId: String(sectorId),
                      sectorName: feature.properties.nombre,
                      regionId,
                      regionLabel: regionLabelById[regionId] ?? regionId,
                    }),
                }}
                pathOptions={{
                  color: isSelected ? sectorStyle.selected.color : sectorStyle.default.color,
                  fillColor: isSelected ? sectorStyle.selected.fillColor : sectorStyle.default.fillColor,
                  fillOpacity: isSelected ? sectorStyle.selected.fillOpacity : sectorStyle.default.fillOpacity,
                  weight: isSelected ? sectorStyle.selected.weight : sectorStyle.default.weight,
                }}
                positions={toPolygonPositions(feature.geometry)}
              >
                <Tooltip sticky>
                  {feature.properties.nombre}
                </Tooltip>
              </Polygon>
            );
          })}
        </MapContainer>

        <div className="etr-region-overlay">
          <strong>{selectedSummaryLabel}</strong>
          <span>Seleccione un polígono</span>
        </div>
      </div>
    </div>
  );
}
