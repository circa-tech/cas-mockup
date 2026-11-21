import { AlertTriangle, Info, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useOfflineState } from "../offline/state";

type RemoteDataStateProps = {
  className?: string;
  icon?: ReactNode;
  message?: string;
  title: string;
  tone?: "loading" | "error" | "empty";
};

export function RemoteDataState({
  className,
  icon,
  message,
  title,
  tone = "loading",
}: RemoteDataStateProps) {
  const offline = useOfflineState();
  const missingOfflineData = tone === "error" && Boolean(offline.session) &&
    !offline.online;
  if (missingOfflineData) {
    title = "Datos no disponibles sin conexión";
    message = "Esta selección no está en la copia guardada.";
  }
  const Icon = tone === "loading" ? LoaderCircle : tone === "empty" ? Info : AlertTriangle;
  const stateClassName = [
    "data-state",
    `is-${tone}`,
    icon ? "has-custom-icon" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={stateClassName}
      role={tone === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      <span className="data-state-icon" aria-hidden="true">
        {icon ?? <Icon size={18} />}
      </span>
      <strong>{title}</strong>
      {message && <p>{message}</p>}
    </div>
  );
}
