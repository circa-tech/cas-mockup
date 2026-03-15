import { ReactNode, useMemo, useState } from "react";
import { EtrMap } from "./components/EtrMap";
import { SimpleBarChart } from "./components/SimpleBarChart";
import { SimpleLineChart } from "./components/SimpleLineChart";
import {
  etrOverviewBarGroups,
  etrOverviewSeasonSeries,
  etrRegions,
  etrStats,
  meteoStations,
  snowJorqueraSeries,
  snowManflasSeries,
  snowOverviewSeries,
  snowPulidoSeries,
  views,
  ViewId,
  wells,
} from "./data/mockupData";

function Panel({
  children,
  className,
  title,
  subtitle,
}: {
  children: ReactNode;
  className?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <section className={`panel ${className ?? ""}`.trim()}>
      <header className="panel-header">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function SnowChartSummary({ series }: { series: { points: { label: string; value: number }[]; label: string }[] }) {
  const latestIndex = series[0]?.points.length ? series[0].points.length - 1 : 0;
  const latestDate = series[0]?.points[latestIndex]?.label ?? "-";
  const currentValue = series[0]?.points[latestIndex]?.value ?? 0;
  const previousValue = series[1]?.points[latestIndex]?.value ?? 0;

  return (
    <div className="snow-chart-summary">
      <div>
        <span>Fecha</span>
        <strong>{latestDate}</strong>
      </div>
      <div>
        <span>Este ano</span>
        <strong>{currentValue}%</strong>
      </div>
      <div>
        <span>Ano pasado</span>
        <strong>{previousValue}%</strong>
      </div>
    </div>
  );
}

function EtrView() {
  const [selectedRegionId, setSelectedRegionId] = useState(etrRegions[0].id);
  const selectedRegion = useMemo(
    () => etrRegions.find((region) => region.id === selectedRegionId) ?? etrRegions[0],
    [selectedRegionId],
  );

  return (
    <div className="view-stack etr-page">
      <div className="view-intro">
        <h2>Monitoreo de Evapotranspiracion en el Valle de Copiapo</h2>
      </div>

      <div className="stat-grid">
        {etrStats.map((item) => (
          <article key={item.label} className="stat-card">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </div>

      <div className="etr-summary-grid">
        <Panel
          title="Distribucion de ETR (mm) por clase de cultivo en la ultima fecha disponible"
        >
          <SimpleBarChart
            groups={etrOverviewBarGroups}
            maxValue={25}
            tickStep={5}
            unit="mm"
            xLabelAngle={-18}
          />
        </Panel>

        <Panel
          title="Comportamiento de ETR y ETmax en la temporada (mm)"
        >
          <SimpleLineChart
            labelEvery={3}
            maxValue={1.8}
            minValue={0}
            series={etrOverviewSeasonSeries}
            unit="mm"
            xLabelAngle={-45}
          />
        </Panel>
      </div>

      <div className="etr-top-grid">
        <Panel
          title="Mapa sectores y areas de gestion CAS Copiapo"
        >
          <EtrMap
            regions={etrRegions.map((region) => ({
              id: region.id,
              label: region.label,
            }))}
            selectedRegionId={selectedRegionId}
            onSelect={(regionId) => setSelectedRegionId(regionId as typeof selectedRegionId)}
          />
        </Panel>

        <Panel
          title="Distribucion de ETR (mm) por clase de cultivo en la ultima fecha disponible"
          subtitle={selectedRegion.label}
        >
          <SimpleBarChart
            groups={selectedRegion.barGroups}
            maxValue={35}
            tickStep={5}
            unit="mm"
            xLabelAngle={-16}
          />
        </Panel>
      </div>

      <Panel
        title="Variacion temporal de la ETR y ETmax"
        className="panel-accent-blue"
      >
        <SimpleLineChart
          labelEvery={2}
          maxValue={1.8}
          minValue={0}
          series={selectedRegion.seasonSeries}
          unit="mm"
          xLabelAngle={-45}
        />
      </Panel>
    </div>
  );
}

function SnowView() {
  return (
    <div className="view-stack">
      <div className="view-intro">
        <h2>Sistema de Monitoreo de Cobertura Nival</h2>
      </div>

      <div className="snow-grid">
        <Panel
          title="Cobertura nival"
          subtitle="Ultima imagen disponible (2024-08-19)"
        >
          <div className="snow-copy">
            <p>
              La imagen de cobertura nival muestra la presencia o ausencia de nieve
              en la cuenca para una fecha dada.
            </p>
            <p>
              El mockup mantiene solo lo esencial: imagen disponible y series de
              evolucion anual por area de estudio.
            </p>
          </div>

          <div className="snow-image-card">
            <div className="snow-image-placeholder">
              <div className="snow-map-core" />
              <span>Imagen visible / MODIS</span>
            </div>
          </div>
        </Panel>

        <div className="snow-charts">
          <div className="snow-description">
            <h3>Graficas de evolucion diaria de FSCA.</h3>
            <p>
              Los graficos de evolucion diaria de cobertura de nieve (FSCA)
              muestran el porcentaje del area de estudio y de cada cuenca que
              esta cubierta con nieve durante los dias correspondientes al periodo
              humedo (abril-septiembre) del ano actual y el anterior.
            </p>
          </div>

          <Panel
            title="Evolucion diaria de la cobertura de nieve en el area de estudio (%)"
          >
            <SimpleLineChart
              maxValue={100}
              minValue={0}
              series={snowOverviewSeries}
              unit="Cobertura (%)"
            />
            <SnowChartSummary series={snowOverviewSeries} />
          </Panel>

          <Panel
            title="Evolucion diaria de FSCA de la cuenca de Jorquera"
          >
            <SimpleLineChart
              maxValue={100}
              minValue={0}
              series={snowJorqueraSeries}
              unit="Cobertura (%)"
            />
            <SnowChartSummary series={snowJorqueraSeries} />
          </Panel>

          <Panel
            title="Evolucion diaria de FSCA de la cuenca de Pulido"
          >
            <SimpleLineChart
              maxValue={100}
              minValue={0}
              series={snowPulidoSeries}
              unit="Cobertura (%)"
            />
            <SnowChartSummary series={snowPulidoSeries} />
          </Panel>

          <Panel
            title="Evolucion diaria de FSCA de la cuenca de Manflas"
          >
            <SimpleLineChart
              maxValue={100}
              minValue={0}
              series={snowManflasSeries}
              unit="Cobertura (%)"
            />
            <SnowChartSummary series={snowManflasSeries} />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function WellsView() {
  const [selectedWellId, setSelectedWellId] = useState(wells[0].id);
  const selectedWell = useMemo(
    () => wells.find((item) => item.id === selectedWellId) ?? wells[0],
    [selectedWellId],
  );

  return (
    <div className="view-stack">
      <div className="view-header-row">
        <div className="view-intro">
          <h2>Nivel de Pozo (m)</h2>
        </div>

        <label className="simple-filter">
          <span>Pozo</span>
          <select
            value={selectedWellId}
            onChange={(event) => setSelectedWellId(event.target.value)}
          >
            {wells.map((well) => (
              <option key={well.id} value={well.id}>
                {well.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Panel
        title="Serie reciente"
        subtitle="Vista simplificada basada en el grafico actual de pozos"
      >
        <SimpleLineChart
          maxValue={4.1}
          minValue={3.5}
          mode="step"
          series={[
            {
              color: "#ff6a00",
              label: selectedWell.label,
              points: selectedWell.points,
            },
          ]}
          unit="m"
          labelEvery={1}
        />
      </Panel>
    </div>
  );
}

function MeteoView() {
  return (
    <div className="view-stack">
      <div className="view-intro">
        <h2>Estaciones meteorologicas</h2>
        <p>
          Mockup minimo con el mismo lenguaje del ejemplo actual: tarjetas de
          condiciones presentes, sin sobreprometer variables adicionales.
        </p>
      </div>

      <div className="weather-grid">
        {meteoStations.map((station) => (
          <article key={station.name} className="weather-card">
            <header className="weather-card-header">{station.name}</header>
            <div className="weather-card-body">
              <span className="weather-card-now">AHORA</span>
              <div className="weather-status">{station.status}</div>
              <div className="weather-metrics">
                <div>
                  <span>Temp</span>
                  <strong>{station.temperature}</strong>
                </div>
                <div>
                  <span>HR</span>
                  <strong>{station.humidity}</strong>
                </div>
                <div>
                  <span>Viento</span>
                  <strong>{station.wind}</strong>
                </div>
              </div>
              <small>{station.updatedAt}</small>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [activeView, setActiveView] = useState<ViewId>("etr");

  return (
    <div className="page-shell">
      <header className="site-header">
        <div>
          <h1>Agua con Dato</h1>
          <p>
            Mockup simplificado, alineado a la estructura visual de ET-LAT, MODIS
            Snow, pozos y meteo ya existentes.
          </p>
        </div>
        <div className="site-tag">
          Dummy data minima. Solo componentes que hoy tienen sentido operacional.
        </div>
      </header>

      <nav className="top-nav" aria-label="Views">
        {views.map((view) => (
          <button
            key={view.id}
            type="button"
            className={view.id === activeView ? "is-active" : ""}
            onClick={() => setActiveView(view.id)}
          >
            {view.label}
          </button>
        ))}
      </nav>

      <main className="content-shell">
        {activeView === "etr" && <EtrView />}
        {activeView === "snow" && <SnowView />}
        {activeView === "wells" && <WellsView />}
        {activeView === "meteo" && <MeteoView />}
      </main>
    </div>
  );
}
