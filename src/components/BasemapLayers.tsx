import { LayersControl, TileLayer } from "react-leaflet";
import { useOfflineState } from "../offline/state";

export function BasemapLayers() {
  const { online, networkUnavailable, session } = useOfflineState();
  if (!online || networkUnavailable || (session && !session.idToken)) {
    return <div className="offline-map-note">Sin mapa base · Puedes explorar los datos guardados</div>;
  }
  return <>
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
  </>;
}
