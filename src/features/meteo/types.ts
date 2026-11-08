export type MeteoDerivedMetric = {
  current?: number | null;
  mean?: number | null;
  min?: number | null;
  max?: number | null;
  total?: number | null;
  direction?: number | null;
  gust?: number | null;
  unit?: string | null;
  recorded_at?: string | null;
};

export type MeteoDerivedData = {
  date: string | null;
  partial: boolean;
  metrics: Record<string, MeteoDerivedMetric>;
  cadence_seconds: number | null;
  available_from: string | null;
};

export type MeteoSeasonRule = { start_month: number; start_day: number; end_month: number; end_day: number };
export type MeteoSeasonTotal = { start_date: string; end_date: string; total: number | null; available_from: string | null; through_date: string | null };
export type MeteoAgrometeorology = {
  daily_date: string | null;
  today: Record<string, number | null>;
  chill_hours_supported: boolean;
  rules: Record<string, MeteoSeasonRule>;
  periods: Record<string, MeteoSeasonTotal[]>;
};
