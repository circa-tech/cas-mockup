import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { GeoJSON, Pane, Rectangle, useMap, useMapEvents } from "react-leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";

type Properties = { kind: string; class: string; name?: string };
type MapData = FeatureCollection<Geometry, Properties>;
let request: Promise<MapData> | undefined;
const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · <a href="https://opendatacommons.org/licenses/odbl/">ODbL</a>';
const majorRoad = /^(motorway|trunk|primary|secondary|tertiary)/;

function style(feature?: Feature<Geometry, Properties>): L.PathOptions {
  const p = feature!.properties;
  if (p.kind === "river" || p.kind === "water") return { color: "#79abc4", weight: p.class === "river" ? 2 : 1, fillColor: "#add1df", fillOpacity: .8 };
  if (p.kind === "land") return { color: "#cfddbe", weight: .5, fillColor: ["residential", "industrial"].includes(p.class) ? "#dedbd4" : "#dce4c8", fillOpacity: .7 };
  return { color: majorRoad.test(p.class) ? "#c79f67" : "#ccc0ae", weight: majorRoad.test(p.class) ? 2.4 : 1.2, opacity: .95 };
}

export function RegionalBasemap() {
  const map = useMap();
  const [data, setData] = useState<MapData>();
  const [failed, setFailed] = useState(false);
  const [detail, setDetail] = useState(map.getZoom() >= 11);
  useMapEvents({ zoomend: () => setDetail(map.getZoom() >= 11) });
  useEffect(() => {
    let active = true;
    request ??= fetch(`${import.meta.env.BASE_URL}offline/copiapo-basemap.geojson`).then((response) => {
      if (!response.ok) throw new Error("Mapa regional no disponible");
      return response.json() as Promise<MapData>;
    }).catch((error) => { request = undefined; throw error; });
    void request.then((value) => { if (active) setData(value); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);
  const features = useMemo(() => data && ({ ...data, features: data.features.filter(({ properties: p }) =>
    detail || p.kind === "water" || (p.kind === "river" && p.class === "river") ||
    (p.kind === "road" && majorRoad.test(p.class)) || (p.kind === "place" && ["city", "town", "village"].includes(p.class))) }), [data, detail]);
  const renderer = useMemo(() => L.canvas({ pane: "regional-basemap" }), []);
  return <>
    <Pane name="regional-background" style={{ zIndex: 180, pointerEvents: "none" }}>
      <Rectangle bounds={[[-85, -180], [85, 180]]} pathOptions={{ stroke: false, fillColor: "#f1ede3", fillOpacity: 1 }} interactive={false} />
    </Pane>
    <Pane name="regional-basemap" style={{ zIndex: 190, pointerEvents: "none" }}>
      {features && <GeoJSON key={String(detail)} data={features} style={(feature) => ({ ...style(feature), renderer })} interactive={false} attribution={attribution}
        pointToLayer={(_feature, latlng) => L.circleMarker(latlng, { pane: "regional-basemap", radius: 2.5, color: "#657568", fillOpacity: 1, interactive: false })}
        onEachFeature={(feature, layer) => {
          if (feature.properties.kind === "place" && feature.properties.name) {
            const label = document.createElement("span");
            label.textContent = feature.properties.name;
            layer.bindTooltip(label, { permanent: true, direction: "right", className: "regional-place-label", pane: "regional-basemap" });
          }
        }} />}
    </Pane>
    {failed && <div className="offline-map-note">El mapa regional aún no está guardado. Abre la aplicación con internet.</div>}
  </>;
}
