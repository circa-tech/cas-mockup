import { LucideIcon } from "lucide-react";

type KpiTone = "neutral" | "positive" | "negative";

type KpiCardProps = {
  delayMs?: number;
  icon: LucideIcon;
  note?: string;
  noteTone?: KpiTone;
  title: string;
  unit?: string;
  value: string;
};

const toneClassMap: Record<KpiTone, string> = {
  neutral: "kpi-note-neutral",
  positive: "kpi-note-positive",
  negative: "kpi-note-negative",
};

export function KpiCard({
  delayMs = 0,
  icon: Icon,
  note,
  noteTone = "neutral",
  title,
  unit,
  value,
}: KpiCardProps) {
  return (
    <article className="kpi-card" style={{ animationDelay: `${delayMs}ms` }}>
      <div className="kpi-card-head">
        <p>{title}</p>
        <span className="kpi-card-icon" aria-hidden="true">
          <Icon size={16} />
        </span>
      </div>
      <div className="kpi-card-value">
        <strong>{value}</strong>
        {unit && <span>{unit}</span>}
      </div>
      {note && <small className={toneClassMap[noteTone]}>{note}</small>}
    </article>
  );
}

