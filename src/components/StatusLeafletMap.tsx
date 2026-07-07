import L from "leaflet";
import { useEffect } from "react";
import {
  LayersControl,
  MapContainer,
  Marker,
  TileLayer,
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
    }"></span>`,
    iconAnchor: [11, 11],
    iconSize: [22, 22],
  });

function FocusSelectedPoint({
  point,
  zoom,
}: {
  point?: StatusLeafletPoint;
  zoom?: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!point || zoom === undefined) return;
    map.setView([point.lat, point.lng], zoom);
  }, [map, point, zoom]);

  return null;
}

export function StatusLeafletMap({
  className,
  onSelect,
  points,
  selectedPointId,
  selectedPointZoom,
}: StatusLeafletMapProps) {
  const hasSelection = Boolean(selectedPointId);
  const selectedPoint = points.find((point) => point.id === selectedPointId);

  return (
    <MapContainer
      bounds={copiapoBounds}
      className={`status-leaflet-map ${className ?? ""}`.trim()}
      scrollWheelZoom={false}
      zoomControl
    >
      <ModifierWheelZoom />
      <FocusSelectedPoint point={selectedPoint} zoom={selectedPointZoom} />
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
