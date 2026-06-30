import { AlertTriangle, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

type RemoteDataStateProps = {
  className?: string;
  icon?: ReactNode;
  message: string;
  title: string;
  tone?: "loading" | "error";
};

export function RemoteDataState({
  className,
  icon,
  message,
  title,
  tone = "loading",
}: RemoteDataStateProps) {
  const Icon = tone === "loading" ? LoaderCircle : AlertTriangle;
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
      <p>{message}</p>
    </div>
  );
}
