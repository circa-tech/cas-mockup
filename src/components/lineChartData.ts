import type { LineSeries } from "./SimpleLineChart";

export type LineChartBrushRange = { startIndex: number; endIndex: number };

export type ChartRow = {
  label: string;
  timestamp?: number;
  [key: string]: number | string | undefined;
};

export const buildLineChartRows = (series: LineSeries[]): ChartRow[] => {
  if (series.length === 0) {
    return [];
  }

  const rowsByKey = new Map<string, ChartRow>();
  const insertionOrder = new Map<string, number>();
  series.forEach((item) => {
    item.points.forEach((point) => {
      const key = point.timestamp === undefined ? `label:${point.label}` : `time:${point.timestamp}`;
      let row = rowsByKey.get(key);
      if (!row) {
        row = { label: point.label, ...(point.timestamp === undefined ? {} : { timestamp: point.timestamp }) };
        rowsByKey.set(key, row);
        insertionOrder.set(key, insertionOrder.size);
      }
      row[item.label] = point.value;
      if (point.condition) row[`${item.label}__condition`] = point.condition;
    });
  });

  return [...rowsByKey.entries()]
    .sort(([leftKey, left], [rightKey, right]) => {
      if (left.timestamp !== undefined && right.timestamp !== undefined) {
        return left.timestamp - right.timestamp;
      }
      return (insertionOrder.get(leftKey) ?? 0) - (insertionOrder.get(rightKey) ?? 0);
    })
    .map(([, row]) => row);
};

