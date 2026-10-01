export const freshnessClassMap = {
  fresh: "is-good",
  warning: "is-warning",
  stale: "is-danger",
} as const;

export const freshnessLabelMap = {
  fresh: "Al día (menos de 24 h)",
  warning: "Atrasado (1 a 2 días)",
  stale: "Sin datos (más de 2 días)",
} as const;
