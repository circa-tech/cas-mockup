import { lazy } from "react";
import { Panel } from "../../components/Panel";
import { RemoteDataState } from "../../components/RemoteDataState";
import { SimpleLineChart, type LineSeries } from "../../components/SimpleLineChart";
import type { ModisSnowBasinsGeoJson } from "../../services/modisSnowApi";
import { formatDate } from "../../utils/date";

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
  latestSnowImage: {
    bounds: { east: number; north: number; south: number; west: number } | null;
    crs: string | null;
    date: string | null;
    url: string | null;
  };
  manflasSeries: LineSeries[];
  overviewSeries: LineSeries[];
  pulidoSeries: LineSeries[];
  showSnowCharts: boolean;
  snowChartLabelEvery: number;
  snowChartsTone: "error" | "loading";
}) {
  const latestImageSubtitle = latestSnowImage.date
    ? `imagen del ${formatDate(latestSnowImage.date)}`
    : undefined;

  return (
        <div className="snow-grid">
          <Panel title="Mapa de nieve" subtitle={latestImageSubtitle}>
            <div className="snow-copy">
              <p>
                El mapa muestra dónde hay nieve el día de la imagen.
              </p>
            </div>

            <div className="snow-image-card">
              {isLoggedIn && imageStatus !== "ready" && basinsStatus !== "ready" ? (
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
                  imageBounds={latestSnowImage.bounds}
                  imageCrs={latestSnowImage.crs}
                  imageUrl={latestSnowImage.url}
                />
              )}
            </div>
          </Panel>

          <div className="snow-charts">
            <div className="snow-description">
              <h3>Cobertura de nieve día a día (% del área)</h3>
              <p>
                Estos gráficos muestran qué porcentaje del área tiene nieve cada día.
                Si la línea de este año va sobre la del año anterior, hay más nieve
                que el año pasado a la misma fecha.
              </p>
            </div>

            <Panel title="Toda el área de estudio">
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

            <Panel title="Cuenca del río Jorquera">
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

            <Panel title="Cuenca del río Pulido">
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

            <Panel title="Cuenca del río Manflas">
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
