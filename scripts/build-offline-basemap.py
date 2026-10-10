"""Build the bundled valley map from a Geofabrik Chile .osm.pbf extract.

Usage: python build-offline-basemap.py input.osm.pbf YYYY-MM-DD
Requires pyosmium (pip install osmium). Run manually, not during app builds.
OSM-derived output is © OpenStreetMap contributors, ODbL 1.0.
"""
import json
import sys
from pathlib import Path
import osmium

WEST, SOUTH, EAST, NORTH = -71.15, -28.85, -68.85, -26.85
roads = {"motorway", "trunk", "primary", "secondary", "tertiary", "unclassified", "residential", "service", "track"}
places = {"city", "town", "village", "hamlet"}
land = {"residential", "industrial", "farmland", "orchard", "vineyard"}
features = []

def simplify(points, tolerance=0.00005):
    """Douglas-Peucker simplification, about five metres at the valley latitude."""
    if len(points) <= 2:
        return points
    x, y = points[0]
    dx, dy = points[-1][0] - x, points[-1][1] - y
    length = dx * dx + dy * dy
    best, index = 0, 0
    for i, (px, py) in enumerate(points[1:-1], 1):
        t = max(0, min(1, ((px - x) * dx + (py - y) * dy) / length)) if length else 0
        distance = (px - x - t * dx) ** 2 + (py - y - t * dy) ** 2
        if distance > best:
            best, index = distance, i
    if best <= tolerance * tolerance:
        return [points[0], points[-1]]
    return simplify(points[:index + 1], tolerance)[:-1] + simplify(points[index:], tolerance)

def inside(lon, lat):
    return WEST <= lon <= EAST and SOUTH <= lat <= NORTH

for item in osmium.FileProcessor(sys.argv[1]).with_locations():
    tags = item.tags
    if isinstance(item, osmium.osm.Node):
        if tags.get("place") not in places or not inside(item.lon, item.lat):
            continue
        kind, category = "place", tags["place"]
        geometry = {"type": "Point", "coordinates": [item.lon, item.lat]}
    elif isinstance(item, osmium.osm.Way):
        highway = tags.get("highway", "")
        if highway.removesuffix("_link") in roads:
            kind, category = "road", highway
        elif tags.get("waterway") in {"river", "stream", "canal"}:
            kind, category = "river", tags["waterway"]
        elif tags.get("natural") == "water":
            kind, category = "water", "water"
        elif tags.get("landuse") in land:
            kind, category = "land", tags["landuse"]
        else:
            continue
        if not all(node.location.valid() for node in item.nodes):
            continue
        if not any(inside(node.lon, node.lat) for node in item.nodes):
            continue
        coordinates = [[round(node.lon, 5), round(node.lat, 5)] for node in item.nodes]
        if len(coordinates) < 2:
            continue
        polygon = kind in {"water", "land"} and len(coordinates) >= 4 and coordinates[0] == coordinates[-1]
        reduced = simplify(coordinates)
        coordinates = reduced if not polygon or len(reduced) >= 4 else coordinates
        geometry = {"type": "Polygon" if polygon else "LineString", "coordinates": [coordinates] if polygon else coordinates}
    else:
        continue
    properties = {"kind": kind, "class": category}
    if tags.get("name"):
        properties["name"] = tags["name"]
    features.append({"type": "Feature", "properties": properties, "geometry": geometry})

output = {"type": "FeatureCollection", "bbox": [WEST, SOUTH, EAST, NORTH], "sourceDate": sys.argv[2], "license": "ODbL-1.0", "features": features}
path = Path("public/offline/copiapo-basemap.geojson")
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps(output, separators=(",", ":"), ensure_ascii=False))
print(f"Saved {len(features)} features, {path.stat().st_size / 1024 / 1024:.1f} MiB")
