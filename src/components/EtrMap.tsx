export type EtrMapRegion = {
  id: string;
  label: string;
};

type EtrMapProps = {
  regions: EtrMapRegion[];
  selectedRegionId: string;
  onSelect: (regionId: string) => void;
};

export function EtrMap({
  regions,
  selectedRegionId,
  onSelect,
}: EtrMapProps) {
  const selectedRegion =
    regions.find((region) => region.id === selectedRegionId) ?? regions[0];

  return (
    <div className="etr-map">
      <div className="etr-map-surface">
        <div className="etr-map-ocean" aria-hidden="true" />
        <div className="etr-map-grid" aria-hidden="true" />

        <div className="etr-map-controls" aria-hidden="true">
          <button type="button">+</button>
          <button type="button">−</button>
        </div>

        <button type="button" className="etr-map-layers" aria-label="Layers">
          <span />
          <span />
          <span />
        </button>

        {regions.map((region) => (
          <button
            key={region.id}
            type="button"
            className={`etr-map-region ${
              selectedRegionId === region.id ? "is-active" : ""
            }`}
            data-region={region.id}
            onClick={() => onSelect(region.id)}
            aria-label={region.label}
          />
        ))}

        <div className="etr-map-overlay-copy">
          <strong>{selectedRegion.label}</strong>
          <span>Seleccione un poligono</span>
        </div>

        <div className="etr-map-attribution">
          Leaflet | Esri, i-cubed, USDA, USGS
        </div>
      </div>

      <div className="etr-map-footer">
        {regions.map((region) => (
          <button
            key={region.id}
            type="button"
            className={selectedRegionId === region.id ? "is-active" : ""}
            onClick={() => onSelect(region.id)}
          >
            {region.label}
          </button>
        ))}
      </div>
    </div>
  );
}
