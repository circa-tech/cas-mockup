import type { ReactNode } from "react";

type PanelProps = {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  subtitle?: string;
  title: ReactNode;
};

export function Panel({ actions, children, className, title, subtitle }: PanelProps) {
  return (
    <section className={`panel ${className ?? ""}`.trim()}>
      <header className="panel-header">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions}
      </header>
      <div className="panel-content">{children}</div>
    </section>
  );
}
