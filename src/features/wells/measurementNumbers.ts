/** Normalize decimals as text so high-precision cell text never rounds through Number. */
export const normalizeMeasurementNumber = (input: string | number): string | null => {
  const raw = String(input).trim().replace(/,/g, ".");
  const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(raw);
  if (!match || !(match[2] || match[3])) return null;
  const exponent = Number(match[4] ?? 0);
  if (!Number.isInteger(exponent) || Math.abs(exponent) > 16383) return null;
  const digits = match[2] + (match[3] ?? "");
  const split = match[2].length + exponent;
  const whole = (split <= 0 ? "0" : digits.slice(0, split).padEnd(split, "0")).replace(/^0+(?=\d)/, "");
  const fraction = (split < 0 ? "0".repeat(-split) + digits : digits.slice(split)).replace(/0+$/, "");
  const sign = match[1] === "-" && /[1-9]/.test(whole + fraction) ? "-" : "";
  return sign + whole + (fraction ? `.${fraction}` : "");
};
export const measurementNumberOutOfRange = (value: string, maximum: number, inclusive: boolean) => {
  if (value.startsWith("-")) return true;
  const [whole, fraction = ""] = value.split(".");
  const limit = String(maximum);
  if (whole.length !== limit.length) return whole.length > limit.length;
  if (whole !== limit) return whole > limit;
  return !inclusive || /[1-9]/.test(fraction);
};
