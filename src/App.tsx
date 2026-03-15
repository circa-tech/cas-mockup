import { ReactNode, useMemo, useState } from "react";
import { SimpleBarChart } from "./components/SimpleBarChart";
import { SimpleLineChart } from "./components/SimpleLineChart";
import {
  etrBarGroups,
  etrSeasonSeries,
  etrStats,
  meteoStations,
  snowJorqueraSeries,
  snowOverviewSeries,
  views,
  ViewId,
  wells,
} from "./data/mockupData";

function Panel({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <section className="panel">
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

function EtrView() {
  return (
    <div className="view-stack">
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

      <div className="two-column-grid">
        <Panel
          title="Distribucion de ETR (mm) por clase de cultivo"
          subtitle="Ultima fecha disponible"
        >
          <SimpleBarChart groups={etrBarGroups} maxValue={25} unit="mm" />
        </Panel>

        <Panel
          title="Comportamiento de ETR y ETmax en la temporada (mm)"
        >
          <SimpleLineChart
            maxValue={1.8}
            minValue={0}
            series={etrSeasonSeries}
            unit="mm"
          />
        </Panel>
      </div>
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
          <Panel
            title="Graficas de evolucion diaria de FSCA"
            subtitle="Area de estudio"
          >
            <SimpleLineChart
              maxValue={100}
              minValue={0}
              series={snowOverviewSeries}
              unit="Cobertura (%)"
            />
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
