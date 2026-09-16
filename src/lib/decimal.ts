import Decimal from "decimal.js";

Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
});

export { Decimal };

export function d(value: string | number | Decimal): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

/** Serialize Decimal for JSON/API — always string. */
export function decimalToString(value: Decimal | null | undefined): string | null {
  if (value == null) return null;
  return value.toFixed();
}

export function assertDecimalString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "" || Number.isNaN(Number(value))) {
    throw new Error(`Invalid decimal string for ${field}`);
  }
  return value;
}
