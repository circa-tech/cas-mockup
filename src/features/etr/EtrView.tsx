import { useEffect, useState } from "react";
import { EtrDownloadsTab } from "./EtrDownloadsTab";
import { EtrSectorTab } from "./EtrSectorTab";
import { EtrUsageTab } from "./EtrUsageTab";

type EtrSubTabId = "sector" | "usage" | "downloads";

export function EtrView({
  authIdToken,
  canDownloadImages,
  isLoggedIn,
}: {
  authIdToken: string | null;
  canDownloadImages: boolean;
  isLoggedIn: boolean;
}) {
  const [activeEtrTab, setActiveEtrTab] = useState<EtrSubTabId>("sector");

  useEffect(() => {
    if (
      (!isLoggedIn && activeEtrTab !== "sector") ||
      (!canDownloadImages && activeEtrTab === "downloads")
    ) {
      setActiveEtrTab("sector");
    }
  }, [activeEtrTab, canDownloadImages, isLoggedIn]);

  return (
    <div className="view-stack etr-page">
      <div className="view-intro">
        <h2>Monitoreo de Evapotranspiración en el Valle de Copiapó</h2>
      </div>

      <div className="etr-subnav" role="tablist" aria-label="Secciones de ETR">
        <button
          type="button"
          role="tab"
          aria-selected={activeEtrTab === "sector"}
          className={activeEtrTab === "sector" ? "is-active" : ""}
          onClick={() => setActiveEtrTab("sector")}
        >
          Indicadores por sector
        </button>
        {isLoggedIn && (
          <button
            type="button"
            role="tab"
            aria-selected={activeEtrTab === "usage"}
            className={activeEtrTab === "usage" ? "is-active" : ""}
            onClick={() => setActiveEtrTab("usage")}
          >
            Indicadores por uso
          </button>
        )}
        {canDownloadImages && (
          <button
            type="button"
            role="tab"
            aria-selected={activeEtrTab === "downloads"}
            className={activeEtrTab === "downloads" ? "is-active" : ""}
            onClick={() => setActiveEtrTab("downloads")}
          >
            Descarga de imágenes
          </button>
        )}
      </div>

      {!isLoggedIn && (
        <p className="etr-access-note">
          Inicia sesión para habilitar <strong>Indicadores por uso</strong> y{" "}
          <strong>Descarga de imágenes</strong>.
        </p>
      )}

      {activeEtrTab === "sector" && (
        <EtrSectorTab authIdToken={authIdToken} isLoggedIn={isLoggedIn} />
      )}
      {isLoggedIn && activeEtrTab === "usage" && (
        <EtrUsageTab authIdToken={authIdToken} isLoggedIn={isLoggedIn} />
      )}
      {canDownloadImages && activeEtrTab === "downloads" && (
        <EtrDownloadsTab authIdToken={authIdToken} isLoggedIn={isLoggedIn} />
      )}
    </div>
  );
}
