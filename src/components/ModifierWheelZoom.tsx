import { useEffect } from "react";
import { useMap } from "react-leaflet";

export function ModifierWheelZoom() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();

    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (event.deltaY < 0) {
        map.zoomIn(1);
      } else if (event.deltaY > 0) {
        map.zoomOut(1);
      }
    };

    container.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", onWheel);
    };
  }, [map]);

  return null;
}

