import { LayerGroup, LayersControl, TileLayer } from "react-leaflet";
import { useOfflineState } from "../offline/state";
import { RegionalBasemap } from "./RegionalBasemap";

export function BasemapLayers() {
  const { online, networkUnavailable, session } = useOfflineState();
  const offline = !online || networkUnavailable || Boolean(session && !session.idToken);
  return <>
    <LayersControl.BaseLayer checked={offline} name="Mapa regional sin conexión">
      <LayerGroup><RegionalBasemap /></LayerGroup>
    </LayersControl.BaseLayer>
    {!offline && <>
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
    </>}
    {offline && <div className="offline-map-note">Mapa regional · Calles, ríos y localidades · Satélite requiere internet</div>}
  </>;
}
