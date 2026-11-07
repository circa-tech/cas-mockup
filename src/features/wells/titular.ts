export const invalidTitularRutMessage = "El RUT ingresado no es válido. Revisa el número y el dígito verificador.";

/** Chilean modulus-11 check; formatting is normalized only after validation. */
export const normalizeTitularRut = (input: string): string | null => {
  const compact = input.trim().replace(/[.\s-]/g, "").toUpperCase();
  if (!/^\d{1,8}[0-9K]$/.test(compact)) return null;
  const body = compact.slice(0, -1);
  if (Number(body) === 0) return null;
  let sum = 0;
  let weight = 2;
  for (const digit of [...body].reverse()) {
    sum += Number(digit) * weight;
    weight = weight === 7 ? 2 : weight + 1;
  }
  const remainder = 11 - sum % 11;
  const expected = remainder === 11 ? "0" : remainder === 10 ? "K" : String(remainder);
  return compact.endsWith(expected) ? `${Number(body)}-${expected}` : null;
};
