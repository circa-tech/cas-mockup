import type { LineSeries } from "../../components/SimpleLineChart";
import { chartPalette } from "../../data/mockupData";
import type { HistoryResponse } from "../../services/historyApi";
import type { ModisSnowCoveragePoint } from "../../services/modisSnowApi";

export function buildSnowOverview(
  history: HistoryResponse | undefined,
  snapshot: ModisSnowCoveragePoint[] = [],
): { lastDate: string; series: LineSeries[] } {
  const coverageByDate = new Map<string, number>();
  for (const point of snapshot) {
    if (point.esteano !== null && Number.isFinite(point.esteano)) {
      coverageByDate.set(point.fecha, point.esteano);
    }
    if (point.anopar !== null && Number.isFinite(point.anopar)) {
      const previousDate = `${Number(point.fecha.slice(0, 4)) - 1}${point.fecha.slice(4)}`;
      coverageByDate.set(previousDate, point.anopar);
    }
  }
  // Nieve gives the historical series precedence over the coverage snapshot.
  for (const point of history?.points ?? []) {
    const coverage = point.values.coverage;
    if (coverage !== null && coverage !== undefined && Number.isFinite(coverage)) {
      coverageByDate.set(point.fecha, coverage);
    }
  }

  const lastDate = [...coverageByDate.keys()].sort().at(-1) ?? "";
  if (!lastDate) return { lastDate, series: [] };

  const latestYear = Number(lastDate.slice(0, 4));
  const dates = [...coverageByDate.keys()]
    .filter((date) => Number(date.slice(0, 4)) === latestYear)
    .sort()
    .slice(-12);
  const current: LineSeries = {
    label: "Este año",
    color: chartPalette.chart1,
    points: dates.map((date) => ({ label: date, value: coverageByDate.get(date)! })),
  };
  const previous: LineSeries = {
    label: "Año anterior",
    color: chartPalette.chart3,
    points: dates.flatMap((date) => {
      const value = coverageByDate.get(`${latestYear - 1}${date.slice(4)}`);
      return value === undefined ? [] : [{ label: date, value }];
    }),
  };
  return { lastDate, series: previous.points.length ? [current, previous] : [current] };
}
