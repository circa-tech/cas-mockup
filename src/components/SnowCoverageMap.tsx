import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import {
  LayersControl,
  MapContainer,
  Polygon,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import snowCoverageGeoJson from "../data/snowCoverageGeoJson.json";
import { ModifierWheelZoom } from "./ModifierWheelZoom";

type SnowGeometry = {
  coordinates: number[][][] | number[][][][];
  type: "Polygon" | "MultiPolygon";
};

type SnowFeature = {
  id?: number | string;
  geometry: SnowGeometry | null;
  properties?: {
    nombre?: string;
    name?: string;
    [key: string]: unknown;
  };
};

type SnowFeatureCollection = {
  features: SnowFeature[];
  type: "FeatureCollection";
};

type SnowPolygonItem = {
  id: string;
  name: string;
  positions: [number, number][][] | [number, number][][][];
};

const snowGeoJsonUrl = "http://200.89.72.25/vista/ccas_est.geojson";

const fallbackBounds: [[number, number], [number, number]] = [
  [-28.75, -71.05],
  [-26.95, -68.95],
];

const toLatLng = (position: number[]) => [position[1], position[0]] as [number, number];

const toPolygonPositions = (geometry: SnowGeometry) => {
  if (geometry.type === "Polygon") {
    return (geometry.coordinates as number[][][]).map((ring) => ring.map(toLatLng));
  }

  return (geometry.coordinates as number[][][][]).map((polygon) =>
    polygon.map((ring) => ring.map(toLatLng)),
  );
};

function FitSnowBounds({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();

  useEffect(() => {
    if (!bounds || !bounds.isValid()) {
      return;
    }

    map.fitBounds(bounds, { padding: [14, 14] });
  }, [bounds, map]);

  return null;
}

export function SnowCoverageMap() {
  const fallbackFeatureCollection = snowCoverageGeoJson as SnowFeatureCollection;
  const [featureCollection, setFeatureCollection] = useState<SnowFeatureCollection | null>(
    fallbackFeatureCollection,
  );

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch(snowGeoJsonUrl, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = (await response.json()) as SnowFeatureCollection;
        if (!payload || payload.type !== "FeatureCollection" || !Array.isArray(payload.features)) {
          throw new Error("Formato GeoJSON invalido");
        }

        setFeatureCollection(payload);
      } catch (caught) {
        if (controller.signal.aborted) {
          return;
        }

        const message = caught instanceof Error ? caught.message : "Error desconocido";
        // Keep silent fallback to local data for mockup UX.
        if (fallbackFeatureCollection?.type !== "FeatureCollection" || !fallbackFeatureCollection.features?.length) {
          // eslint-disable-next-line no-console
          console.warn("Snow GeoJSON unavailable and no local fallback:", message);
          setFeatureCollection(null);
        } else {
          // eslint-disable-next-line no-console
          console.warn("Snow GeoJSON remote unavailable, using local fallback:", message);
          setFeatureCollection(fallbackFeatureCollection);
        }
      }
    };

    load();

    return () => controller.abort();
  }, []);

  const polygons = useMemo<SnowPolygonItem[]>(() => {
    if (!featureCollection) {
      return [];
    }

    return featureCollection.features
      .filter((feature) => feature.geometry?.type === "Polygon" || feature.geometry?.type === "MultiPolygon")
      .map((feature, index) => ({
        id: String(feature.id ?? index),
        name:
          String(feature.properties?.nombre ?? feature.properties?.name ?? "").trim() ||
          `Area ${index + 1}`,
        positions: toPolygonPositions(feature.geometry as SnowGeometry),
      }));
  }, [featureCollection]);

  const fitBounds = useMemo(() => {
    if (polygons.length === 0) {
      return null;
    }

    const bounds = L.latLngBounds([]);
    polygons.forEach((item) => {
      const geometry = item.positions as [number, number][][] | [number, number][][][];
      const isMultiPolygon = Array.isArray(geometry[0]?.[0]?.[0]);

      if (isMultiPolygon) {
        (geometry as [number, number][][][]).forEach((polygon) => {
          polygon.forEach((ring) => {
            ring.forEach((coord) => bounds.extend(coord));
          });
        });
        return;
      }

      (geometry as [number, number][][]).forEach((ring) => {
        ring.forEach((coord) => bounds.extend(coord));
      });
    });

    return bounds.isValid() ? bounds : null;
  }, [polygons]);

  return (
    <div className="snow-coverage-map-shell">
      <MapContainer
        bounds={fallbackBounds}
        className="snow-coverage-map"
        scrollWheelZoom={false}
        zoomControl
      >
        <ModifierWheelZoom />
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

        <FitSnowBounds bounds={fitBounds} />

        {polygons.map((item) => (
          <Polygon
            key={item.id}
            pathOptions={{
              color: "#2d66c5",
              fillColor: "#5ea1ff",
              fillOpacity: 0.18,
              weight: 2,
            }}
            positions={item.positions}
          >
            <Tooltip sticky>{item.name}</Tooltip>
          </Polygon>
        ))}
      </MapContainer>
    </div>
  );
}
