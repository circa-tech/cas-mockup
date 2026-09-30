import { useEffect, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { EtrDownloadsTab } from "./EtrDownloadsTab";
import { EtrSectorTab } from "./EtrSectorTab";
import { EtrUsageTab } from "./EtrUsageTab";

type EtrSubTabId = "sector" | "usage" | "downloads";

export function EtrView({
  authIdToken,
  canDownloadImages,
  isLoggedIn,
  onLogin,
}: {
  authIdToken: string | null;
  canDownloadImages: boolean;
  isLoggedIn: boolean;
  onLogin: () => void;
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
        <h2>Consumo de agua de los cultivos</h2>
        <p>
          Estimamos con imágenes satelitales cuánta agua consumen los cultivos
          (ETR) y cuánta consumirían sin falta de agua (ETmax). Fuente: modelo
          ET-LAT.
        </p>
      </div>

      <div className="etr-subnav" role="tablist" aria-label="Secciones de ETR">
        <button
          type="button"
          role="tab"
          aria-selected={activeEtrTab === "sector"}
          className={activeEtrTab === "sector" ? "is-active" : ""}
          onClick={() => setActiveEtrTab("sector")}
        >
          Por sector
        </button>
        {isLoggedIn ? (
          <button
            type="button"
            role="tab"
            aria-selected={activeEtrTab === "usage"}
            className={activeEtrTab === "usage" ? "is-active" : ""}
            onClick={() => setActiveEtrTab("usage")}
          >
            Por parcela
          </button>
        ) : (
          <button type="button" role="tab" aria-selected="false" onClick={onLogin}>
            <LockKeyhole aria-hidden="true" size={14} />
            Por parcela
          </button>
        )}
        {canDownloadImages ? (
          <button
            type="button"
            role="tab"
            aria-selected={activeEtrTab === "downloads"}
            className={activeEtrTab === "downloads" ? "is-active" : ""}
            onClick={() => setActiveEtrTab("downloads")}
          >
            Descargar imágenes
          </button>
        ) : !isLoggedIn ? (
          <button type="button" role="tab" aria-selected="false" onClick={onLogin}>
            <LockKeyhole aria-hidden="true" size={14} />
            Descargar imágenes
          </button>
        ) : null}
      </div>

      {!isLoggedIn && (
        <p className="etr-access-note">
          Disponible al iniciar sesión.{" "}
          <button type="button" onClick={onLogin}>
            Iniciar sesión
          </button>
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
