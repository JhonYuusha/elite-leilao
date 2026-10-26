const MAX_BIGINT_CENTS = 9223372036854775807n;

export function toCents(value: string): string | null {
  const normalized = value.trim();

  if (!/^\d+(?:[.,]\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const [reais, centavos = ""] = normalized
    .replace(",", ".")
    .split(".");

  const cents =
    BigInt(reais) * 100n +
    BigInt(centavos.padEnd(2, "0"));

  if (cents <= 0n || cents > MAX_BIGINT_CENTS) {
    return null;
  }

  return cents.toString();
}

export function formatCents(cents: string | null): string {
  if (cents === null) {
    return "R$ 0,00";
  }

  const value = BigInt(cents);
  const whole = value / 100n;
  const fraction = (value % 100n)
    .toString()
    .padStart(2, "0");

  return `R$ ${whole.toLocaleString("pt-BR")},${fraction}`;
}