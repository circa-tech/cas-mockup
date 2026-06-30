export const getCurrentValue = (points: { value: number }[]) =>
  points[points.length - 1]?.value ?? 0;

export const getDailyChangeValue = (points: { value: number }[]) => {
  const last = points[points.length - 1]?.value ?? 0;
  const reference = points[Math.max(0, points.length - 2)]?.value ?? last;
  return last - reference;
};

export const getRangeValue = (points: { value: number }[]) => {
  if (points.length === 0) {
    return 0;
  }

  const values = points.map((point) => point.value);
  return Math.max(...values) - Math.min(...values);
};
