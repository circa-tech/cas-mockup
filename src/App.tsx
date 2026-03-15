import { ReactNode, useMemo, useState } from "react";
import { EtrMap } from "./components/EtrMap";
import { MiniSparkline } from "./components/MiniSparkline";
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

const getCurrentValue = (points: { value: number }[]) =>
  points[points.length - 1]?.value ?? 0;

const getDailyChangeValue = (points: { value: number }[]) => {
  const last = points[points.length - 1]?.value ?? 0;
  const reference = points[Math.max(0, points.length - 2)]?.value ?? last;
  return last - reference;
};

const getRangeValue = (points: { value: number }[]) => {
  const values = points.map((point) => point.value);
  return Math.max(...values) - Math.min(...values);
};

const getTrendLabel = (delta: number) => {
  if (delta > 0.08) {
    return "Alza diaria";
  }

  if (delta < -0.08) {
    return "Baja diaria";
  }

  return "Estable";
};

const getToneClass = (label: string) => {
  if (label === "Alza diaria") {
    return "is-warning";
  }

  if (label === "Baja diaria") {
    return "is-danger";
  }

  return "is-neutral";
};

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
  const wellRows = wells.map((well) => {
    const current = getCurrentValue(well.points);
    const change = getDailyChangeValue(well.points);
    const dailyTrend = getTrendLabel(getDailyChangeValue(well.points));

    return {
      ...well,
      change,
      current,
      dailyTrend,
    };
  });
  const monitoredCount = wells.length;
  const recentUpdates = wells.filter((well) => !well.lastTransmission.includes("h")).length;
  const averageLevel =
    wellRows.reduce((total, well) => total + well.current, 0) / wellRows.length;
  const averageDailyChange =
    wellRows.reduce((total, well) => total + well.change, 0) / wellRows.length;
  const previousDay =
    selectedWell.points[Math.max(0, selectedWell.points.length - 2)]?.label ?? "-";
  const currentDay = selectedWell.points[selectedWell.points.length - 1]?.label ?? "-";

  return (
    <div className="view-stack">
      <div className="view-intro">
        <h2>Nivel de Pozo (m)</h2>
        <p>Resumen general de la red y detalle por pozo seleccionado.</p>
      </div>

      <div className="stat-grid">
        <article className="stat-card">
          <span>Pozos monitoreados</span>
          <strong>{monitoredCount}</strong>
          <small>Red visible en el dashboard</small>
        </article>
        <article className="stat-card">
          <span>Nivel medio actual</span>
          <strong>
            {averageLevel.toFixed(2)} m
          </strong>
          <small>Promedio simple de la red</small>
        </article>
        <article className="stat-card">
          <span>Cambio diario medio</span>
          <strong>
            {averageDailyChange >= 0 ? "+" : ""}
            {averageDailyChange.toFixed(2)} m
          </strong>
          <small>{recentUpdates}/{monitoredCount} sin atraso mayor a 1 hora</small>
        </article>
      </div>

      <div className="detail-grid">
        <Panel
          title="Comparacion rapida de pozos"
          subtitle="Nivel actual, cambio diario y tendencia diaria"
        >
          <div className="comparison-list">
            {wellRows.map((well) => (
              <button
                key={well.id}
                type="button"
                className={`comparison-row ${
                  selectedWellId === well.id ? "is-selected" : ""
                }`}
                onClick={() => setSelectedWellId(well.id)}
              >
                <div className="comparison-main">
                  <strong>{well.label}</strong>
                  <span>{well.provider}</span>
                </div>
                <div className="comparison-metrics">
                  <div>
                    <span>Nivel</span>
                    <strong>{well.current.toFixed(2)} m</strong>
                  </div>
                  <div>
                    <span>Cambio diario</span>
                    <strong>
                      {well.change >= 0 ? "+" : ""}
                      {well.change.toFixed(2)} m
                    </strong>
                  </div>
                </div>
                <MiniSparkline
                  color="#ff6a00"
                  points={well.points.map((point) => point.value)}
                />
                <span className={`status-pill ${getToneClass(well.dailyTrend)}`}>
                  {well.dailyTrend}
                </span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel
          title="Estado de red"
          subtitle="Continuidad de telemetria y ultima transmision"
        >
          <div className="table-wrap">
            <table className="compact-table">
              <thead>
                <tr>
                  <th>Pozo</th>
                  <th>Proveedor</th>
                  <th>Ultima lectura</th>
                  <th>Tendencia diaria</th>
                </tr>
              </thead>
              <tbody>
                {wellRows.map((well) => (
                  <tr
                    key={well.id}
                    className={selectedWellId === well.id ? "is-selected" : ""}
                    onClick={() => setSelectedWellId(well.id)}
                  >
                    <td>{well.label}</td>
                    <td>{well.provider}</td>
                    <td>{well.lastTransmission}</td>
                    <td>
                      <span className={`status-pill ${getToneClass(well.dailyTrend)}`}>
                        {well.dailyTrend}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel
        title={`Serie reciente: ${selectedWell.label}`}
        subtitle={`${selectedWell.provider} · Cambio diario ${getDailyChangeValue(selectedWell.points) >= 0 ? "+" : ""}${getDailyChangeValue(selectedWell.points).toFixed(2)} m · ${previousDay} a ${currentDay}`}
      >
        <div className="panel-inline-toolbar">
          <div className="panel-inline-copy">
            <strong>Pozo seleccionado</strong>
            <span>Tambien puede seleccionarlo desde la comparacion o la tabla.</span>
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
  const averageTemperature =
    meteoStations.reduce((total, station) => total + station.temperatureValue, 0) /
    meteoStations.length;
  const maxWind = Math.max(...meteoStations.map((station) => station.windValue));
  const activeSignals = meteoStations.filter((station) => station.signal === "Estable").length;
  const temperatureGroups = meteoStations.map((station) => ({
    label: station.name,
    series: [
      {
        label: "Temp",
        value: station.temperatureValue,
        color: "#2d6ea3",
      },
    ],
  }));

  return (
    <div className="view-stack">
      <div className="view-intro">
        <h2>Estaciones meteorologicas</h2>
        <p>
          Mockup minimo con el mismo lenguaje del ejemplo actual: tarjetas de
          condiciones presentes, sin sobreprometer variables adicionales.
        </p>
      </div>

      <div className="stat-grid">
        <article className="stat-card">
          <span>Estaciones activas</span>
          <strong>{activeSignals}/{meteoStations.length}</strong>
          <small>Senal operativa reciente</small>
        </article>
        <article className="stat-card">
          <span>Temperatura media</span>
          <strong>{averageTemperature.toFixed(1)}°C</strong>
          <small>Promedio simple de la red</small>
        </article>
        <article className="stat-card">
          <span>Viento maximo</span>
          <strong>{maxWind.toFixed(1)} km/h</strong>
          <small>Entre estaciones visibles</small>
        </article>
      </div>

      <div className="weather-grid">
        {meteoStations.map((station) => (
          <article key={station.name} className="weather-card">
            <header className="weather-card-header">{station.name}</header>
            <div className="weather-card-body">
              <span className="weather-card-now">AHORA</span>
              <div className="weather-status">{station.status}</div>
              <div className="weather-card-chip-row">
                <span className={`status-pill ${station.signal === "Estable" ? "is-good" : "is-warning"}`}>
                  {station.signal}
                </span>
                <small>{station.updatedAt}</small>
              </div>
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
              <div className="weather-trend">
                <span>Ultimas 24 h</span>
                <MiniSparkline points={station.temperatureTrend} />
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="detail-grid">
        <Panel
          title="Temperatura actual por estacion"
          subtitle="Comparacion simple de la red"
        >
          <SimpleBarChart
            groups={temperatureGroups}
            maxValue={20}
            tickStep={5}
            unit="°C"
            xLabelAngle={-10}
          />
        </Panel>

        <Panel
          title="Estado de estaciones"
          subtitle="Lectura rapida de humedad, viento y continuidad"
        >
          <div className="table-wrap">
            <table className="compact-table">
              <thead>
                <tr>
                  <th>Estacion</th>
                  <th>Senal</th>
                  <th>HR</th>
                  <th>Viento</th>
                  <th>Actualizacion</th>
                </tr>
              </thead>
              <tbody>
                {meteoStations.map((station) => (
                  <tr key={station.name}>
                    <td>{station.name}</td>
                    <td>
                      <span className={`status-pill ${station.signal === "Estable" ? "is-good" : "is-warning"}`}>
                        {station.signal}
                      </span>
                    </td>
                    <td>{station.humidity}</td>
                    <td>{station.wind}</td>
                    <td>{station.updatedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
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
