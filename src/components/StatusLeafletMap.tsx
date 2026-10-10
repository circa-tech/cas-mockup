import { BasemapLayers } from "./BasemapLayers";
import L from "leaflet";
import { useEffect } from "react";
import {
  LayersControl,
  MapContainer,
  Marker,
  Tooltip,
  useMap,
} from "react-leaflet";
import {
  GeoPointStatus,
  TelemetrySourceType,
  WaterQualityStatus,
} from "../data/mockupData";
import { ModifierWheelZoom } from "./ModifierWheelZoom";

export type StatusLeafletPoint = {
  id: string;
  iconType?: "weather-station";
  lat: number;
  lastUpdate: string;
  lng: number;
  name: string;
  qualityStatus?: WaterQualityStatus;
  sourceType: TelemetrySourceType;
  status: GeoPointStatus;
};

type StatusLeafletMapProps = {
  className?: string;
  initialCenter?: L.LatLngTuple;
  initialZoom?: number;
  points: StatusLeafletPoint[];
  selectedPointId?: string;
  selectedPointZoom?: number;
  onSelect?: (pointId: string) => void;
};

const statusClassMap: Record<GeoPointStatus, string> = {
  fresh: "is-fresh",
  warning: "is-warning",
  stale: "is-stale",
};

const sourceClassMap: Record<TelemetrySourceType, string> = {
  telemetry: "is-telemetry",
  manual: "is-manual",
};

const qualityClassMap: Record<WaterQualityStatus, string> = {
  good: "is-quality-good",
  watch: "is-quality-watch",
  alert: "is-quality-alert",
};

/*
  Popup desactivado temporalmente para simplificar la interacción en el mapa.
  Para reactivar:
  1) Importar `Popup` desde react-leaflet.
  2) Descomentar los mapas de etiquetas y el bloque JSX dentro de <Marker>.

const statusLabelMap: Record<GeoPointStatus, string> = {
  fresh: "Actualizado < 24 h",
  warning: "Actualizado 24-48 h",
  stale: "Sin reporte > 48 h",
};

const sourceLabelMap: Record<TelemetrySourceType, string> = {
  telemetry: "Telemetría",
  manual: "Carga manual",
};

const qualityLabelMap: Record<WaterQualityStatus, string> = {
  good: "Buena",
  watch: "Atención",
  alert: "Alerta",
};
*/

const copiapoBounds = L.latLngBounds(
  L.latLng(-27.75, -71.05),
  L.latLng(-26.9, -69.75),
);

const buildMarkerIcon = (
  point: StatusLeafletPoint,
  isSelected: boolean,
  hasSelection: boolean,
) =>
  L.divIcon({
    className: "status-map-marker-shell",
    html: `<span class="status-map-marker ${statusClassMap[point.status]} ${
      sourceClassMap[point.sourceType]
    } ${point.qualityStatus ? qualityClassMap[point.qualityStatus] : ""} ${
      isSelected ? "is-selected" : ""
    } ${
      hasSelection && !isSelected ? "is-dim" : ""
    } ${point.iconType === "weather-station" ? "is-weather-station" : ""}">${
      point.iconType === "weather-station"
        ? '<svg viewBox="0 0 24 32" aria-hidden="true"><path class="status-map-marker-pin" d="M12 1.5A9.5 9.5 0 0 0 2.5 11c0 7.1 9.5 19.5 9.5 19.5S21.5 18.1 21.5 11A9.5 9.5 0 0 0 12 1.5Z"/><path class="status-map-marker-sensor" d="M7.8 12h8.4M12 7.8v8.4M9.1 9.1l5.8 5.8M14.9 9.1l-5.8 5.8"/></svg>'
        : ""
    }</span>`,
    iconAnchor: point.iconType === "weather-station" ? [12, 31] : [11, 11],
    iconSize: point.iconType === "weather-station" ? [24, 32] : [22, 22],
  });

function FocusSelectedPoint({
  fallbackCenter,
  fallbackZoom,
  point,
  zoom,
}: {
  fallbackCenter?: L.LatLngTuple;
  fallbackZoom?: number;
  point?: StatusLeafletPoint;
  zoom?: number;
}) {
  const map = useMap();
  const pointLat = point?.lat;
  const pointLng = point?.lng;

  useEffect(() => {
    if (pointLat !== undefined && pointLng !== undefined && zoom !== undefined) {
      map.setView([pointLat, pointLng], zoom);
    } else if (fallbackCenter && fallbackZoom !== undefined) {
      map.setView(fallbackCenter, fallbackZoom);
    }
  }, [fallbackCenter, fallbackZoom, map, pointLat, pointLng, zoom]);

  return null;
}

export function StatusLeafletMap({
  className,
  initialCenter,
  initialZoom,
  onSelect,
  points,
  selectedPointId,
  selectedPointZoom,
}: StatusLeafletMapProps) {
  const hasSelection = Boolean(selectedPointId);
  const selectedPoint = points.find((point) => point.id === selectedPointId);

  return (
    <MapContainer
        zoomAnimation={false}
      bounds={initialCenter ? undefined : copiapoBounds}
      center={initialCenter}
      className={`status-leaflet-map ${className ?? ""}`.trim()}
      scrollWheelZoom={false}
      zoom={initialZoom}
      zoomControl
    >
      <ModifierWheelZoom />
      <FocusSelectedPoint
        fallbackCenter={initialCenter}
        fallbackZoom={initialZoom}
        point={selectedPoint}
        zoom={selectedPointZoom}
      />
      <LayersControl position="topright">
        <BasemapLayers />
      </LayersControl>

      {points.map((point) => {
        const isSelected = point.id === selectedPointId;

        return (
          <Marker
            key={point.id}
            eventHandlers={{
              click: () => onSelect?.(point.id),
            }}
            icon={buildMarkerIcon(point, isSelected, hasSelection)}
            position={[point.lat, point.lng]}
            zIndexOffset={isSelected ? 1000 : 0}
          >
            <Tooltip>{point.name}</Tooltip>
            {/*
            <Popup>
              <div className="status-map-popup">
                <strong>{point.name}</strong>
                <span>Estado: {statusLabelMap[point.status]}</span>
                <span>Fuente: {sourceLabelMap[point.sourceType]}</span>
                {point.qualityStatus && (
                  <span>Calidad de agua: {qualityLabelMap[point.qualityStatus]}</span>
                )}
              </div>
            </Popup>
            */}
          </Marker>
        );
      })}
    </MapContainer>
  );
}
