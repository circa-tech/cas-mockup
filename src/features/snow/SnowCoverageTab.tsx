import { lazy } from "react";
import { Panel } from "../../components/Panel";
import { RemoteDataState } from "../../components/RemoteDataState";
import type { LineSeries } from "../../components/SimpleLineChart";
import type { ModisSnowBasinsGeoJson } from "../../services/modisSnowApi";
import { formatDate } from "../../utils/date";
import { SnowSeasonComparison } from "./SnowSeasonComparison";

const SnowCoverageMap = lazy(() =>
  import("./SnowCoverageMap").then((module) => ({
    default: module.SnowCoverageMap,
  })),
);

export function SnowCoverageTab({
  authIdToken,
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
}: {
  authIdToken: string | null;
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
                Compara la evolución diaria de la cobertura nival entre temporadas.
                Puedes cambiar los años para revisar períodos con datos disponibles.
              </p>
            </div>
            <SnowSeasonComparison
              authIdToken={authIdToken}
              demoSeriesByArea={{
                ae: overviewSeries,
                jorquera: jorqueraSeries,
                pulido: pulidoSeries,
                manflas: manflasSeries,
              }}
              isLoggedIn={isLoggedIn}
            />
          </div>
        </div>
  );
}
