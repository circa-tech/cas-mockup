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
