import type { ReactNode } from "react";

type PanelProps = {
  children: ReactNode;
  className?: string;
  subtitle?: string;
  title: string;
};

export function Panel({ children, className, title, subtitle }: PanelProps) {
  return (
    <section className={`panel ${className ?? ""}`.trim()}>
      <header className="panel-header">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </header>
      <div className="panel-content">{children}</div>
    </section>
  );
}
