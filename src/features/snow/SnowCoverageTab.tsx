import { lazy } from "react";
import { Panel } from "../../components/Panel";
import { RemoteDataState } from "../../components/RemoteDataState";
import { SimpleLineChart, type LineSeries } from "../../components/SimpleLineChart";
import type { ModisSnowBasinsGeoJson } from "../../services/modisSnowApi";

const SnowCoverageMap = lazy(() =>
  import("./SnowCoverageMap").then((module) => ({
    default: module.SnowCoverageMap,
  })),
);

export function SnowCoverageTab({
  basinsGeoJson,
  basinsStatus,
  basinsTone,
  imageStatus,
  imageTone,
  isLoggedIn,
  jorqueraSeries,
  latestSnowImage,
  manflasSeries,
  overviewSeries,
  pulidoSeries,
  showSnowCharts,
  snowChartLabelEvery,
  snowChartsTone,
}: {
  basinsGeoJson: ModisSnowBasinsGeoJson | null;
  basinsStatus: "idle" | "loading" | "ready" | "error";
  basinsTone: "error" | "loading";
  imageStatus: "idle" | "loading" | "ready" | "error";
  imageTone: "error" | "loading";
  isLoggedIn: boolean;
  jorqueraSeries: LineSeries[];
  latestSnowImage: { date: string | null; url: string | null };
  manflasSeries: LineSeries[];
  overviewSeries: LineSeries[];
  pulidoSeries: LineSeries[];
  showSnowCharts: boolean;
  snowChartLabelEvery: number;
  snowChartsTone: "error" | "loading";
}) {
  const latestImageSubtitle = latestSnowImage.date
    ? `Última imagen disponible (${latestSnowImage.date})`
    : "Última imagen disponible";

  return (
        <div className="snow-grid">
          <Panel title="Cobertura nival" subtitle={latestImageSubtitle}>
            <div className="snow-copy">
              <p>
                La imagen de cobertura nival muestra la presencia o ausencia de nieve
                en la cuenca para una fecha dada.
              </p>
              <p>
                La vista usa la imagen MODIS publicada y las series de evolución anual
                por cuenca disponibles en el servicio.
              </p>
            </div>

            <div className="snow-image-card">
              {latestSnowImage.url ? (
                <div className="snow-latest-image-shell">
                  <img
                    alt="Cobertura nival MODIS"
                    className="snow-latest-image"
                    src={latestSnowImage.url}
                  />
                  {latestSnowImage.date && (
                    <span className="snow-latest-image-date">
                      {latestSnowImage.date}
                    </span>
                  )}
                </div>
              ) : isLoggedIn && imageStatus !== "ready" && basinsStatus !== "ready" ? (
                <RemoteDataState
                  className="is-snow-image"
                  title={
                    imageTone === "error" || basinsTone === "error"
                      ? "Imagen MODIS no disponible"
                      : "Cargando imagen MODIS"
                  }
                  message={
                    imageTone === "error" || basinsTone === "error"
                      ? "No se pudo obtener la imagen o la geometría real desde GCP."
                      : "Esperando la imagen real publicada por el servicio."
                  }
                  tone={imageTone === "error" || basinsTone === "error" ? "error" : "loading"}
                />
              ) : (
                <SnowCoverageMap
                  featureCollection={isLoggedIn ? basinsGeoJson : undefined}
                />
              )}
            </div>
          </Panel>

          <div className="snow-charts">
            <div className="snow-description">
              <h3>Gráficas de evolución diaria de FSCA.</h3>
              <p>
                Los gráficos de evolución diaria de cobertura de nieve (FSCA)
                muestran el porcentaje del área de estudio y de cada cuenca que
                está cubierta con nieve durante los días correspondientes al período
                húmedo (abril-septiembre) del año actual y el anterior.
              </p>
            </div>

            <Panel title="Evolución diaria de la cobertura de nieve en el área de estudio (%)">
              {showSnowCharts ? (
                <SimpleLineChart
                  labelEvery={snowChartLabelEvery}
                  maxValue={100}
                  minValue={0}
                  series={overviewSeries}
                  unit="Cobertura (%)"
                  xLabelAngle={-32}
                />
              ) : (
                <RemoteDataState
                  className="is-chart"
                  title={
                    snowChartsTone === "error"
                      ? "Cobertura no disponible"
                      : "Cargando cobertura"
                  }
                  message={
                    snowChartsTone === "error"
                      ? "El servicio no respondió con la serie real de cobertura."
                      : "Consultando serie real de cobertura MODIS."
                  }
                  tone={snowChartsTone}
                />
              )}
            </Panel>

            <Panel title="Evolución diaria de FSCA de la cuenca de Jorquera">
              {showSnowCharts ? (
                <SimpleLineChart
                  labelEvery={snowChartLabelEvery}
                  maxValue={100}
                  minValue={0}
                  series={jorqueraSeries}
                  unit="Cobertura (%)"
                  xLabelAngle={-32}
                />
              ) : (
                <RemoteDataState
                  className="is-chart"
                  title={
                    snowChartsTone === "error"
                      ? "Jorquera no disponible"
                      : "Cargando Jorquera"
                  }
                  message={
                    snowChartsTone === "error"
                      ? "El servicio no respondió con la serie real de Jorquera."
                      : "Esperando datos reales de FSCA para Jorquera."
                  }
                  tone={snowChartsTone}
                />
              )}
            </Panel>

            <Panel title="Evolución diaria de FSCA de la cuenca de Pulido">
              {showSnowCharts ? (
                <SimpleLineChart
                  labelEvery={snowChartLabelEvery}
                  maxValue={100}
                  minValue={0}
                  series={pulidoSeries}
                  unit="Cobertura (%)"
                  xLabelAngle={-32}
                />
              ) : (
                <RemoteDataState
                  className="is-chart"
                  title={
                    snowChartsTone === "error"
                      ? "Pulido no disponible"
                      : "Cargando Pulido"
                  }
                  message={
                    snowChartsTone === "error"
                      ? "El servicio no respondió con la serie real de Pulido."
                      : "Esperando datos reales de FSCA para Pulido."
                  }
                  tone={snowChartsTone}
                />
              )}
            </Panel>

            <Panel title="Evolución diaria de FSCA de la cuenca de Manflas">
              {showSnowCharts ? (
                <SimpleLineChart
                  labelEvery={snowChartLabelEvery}
                  maxValue={100}
                  minValue={0}
                  series={manflasSeries}
                  unit="Cobertura (%)"
                  xLabelAngle={-32}
                />
              ) : (
                <RemoteDataState
                  className="is-chart"
                  title={
                    snowChartsTone === "error"
                      ? "Manflas no disponible"
                      : "Cargando Manflas"
                  }
                  message={
                    snowChartsTone === "error"
                      ? "El servicio no respondió con la serie real de Manflas."
                      : "Esperando datos reales de FSCA para Manflas."
                  }
                  tone={snowChartsTone}
                />
              )}
            </Panel>
          </div>
        </div>
  );
}
