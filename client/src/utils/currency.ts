import { Decimal } from 'decimal.js';

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export type MoneyLike = string | Decimal | null | undefined;

/** Valid API money string: up to 13 integer digits and at most 2 decimals. */
export const MONEY_PATTERN = /^\d{1,13}(\.\d{1,2})?$/;

const THOUSANDS_PATTERN = /^\d{1,3}(\.\d{3})+$/;
const MAX_INTEGER_DIGITS = 13;

/** Safely converts any money-like value into Decimal (invalid or empty becomes 0). */
export function toDecimal(value: MoneyLike): Decimal {
  if (value === null || value === undefined || value === '') {
    return new Decimal(0);
  }
  try {
    return new Decimal(value);
  } catch {
    return new Decimal(0);
  }
}

/** Formats a money value as Indonesian Rupiah, e.g. "Rp1.500.000" or "-Rp125.000,50". */
export function formatRupiah(value: MoneyLike): string {
  const amount = toDecimal(value);
  const [integerPart = '0', fraction = '00'] = amount.abs().toFixed(2).split('.');
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = amount.isNegative() && !amount.isZero() ? '-' : '';
  return fraction === '00' ? `${sign}Rp${grouped}` : `${sign}Rp${grouped},${fraction}`;
}

/** Formats a percentage string such as "36.00" into "36,00%". */
export function formatPercent(value: MoneyLike): string {
  return `${toDecimal(value).toFixed(2).replace('.', ',')}%`;
}

/**
 * Cleans raw keyboard/paste input into a money-safe string:
 * rejects letters and minus signs, accepts "," as decimal separator, understands "1.000.000"
 * thousands grouping, limits to 13 integer digits / 2 decimals and removes pointless leading zeros.
 */
export function sanitizeMoneyInput(raw: string): string {
  let text = raw.trim().replace(/[^\d.,]/g, '');

  if (THOUSANDS_PATTERN.test(text)) {
    text = text.replace(/\./g, '');
  }

  text = text.replace(/,/g, '.');

  const firstDot = text.indexOf('.');
  let integerPart: string;
  let fractionPart: string | null = null;

  if (firstDot === -1) {
    integerPart = text;
  } else {
    integerPart = text.slice(0, firstDot);
    fractionPart = text.slice(firstDot + 1).replace(/\./g, '').slice(0, 2);
  }

  integerPart = integerPart.replace(/^0+(?=\d)/, '').slice(0, MAX_INTEGER_DIGITS);

  if (fractionPart !== null) {
    return `${integerPart === '' ? '0' : integerPart}.${fractionPart}`;
  }
  return integerPart;
}

/** Removes an unfinished trailing "." (e.g. "25." becomes "25") so the value can be sent to the API. */
export function finalizeMoneyInput(value: string): string {
  return value.endsWith('.') ? value.slice(0, -1) : value;
}

export function isValidNonNegativeMoney(value: string): boolean {
  return MONEY_PATTERN.test(value);
}

export function isValidPositiveMoney(value: string): boolean {
  return MONEY_PATTERN.test(value) && new Decimal(value).gt(0);
}

/** Sums money-like values with decimal.js and returns a 2-decimal string. */
export function sumMoney(values: readonly MoneyLike[]): string {
  return values.reduce<Decimal>((total, value) => total.plus(toDecimal(value)), new Decimal(0)).toFixed(2);
}

export function subtractMoney(a: MoneyLike, b: MoneyLike): string {
  return toDecimal(a).minus(toDecimal(b)).toFixed(2);
}

/** Returns -1, 0 or 1 as `a` is lower than, equal to, or greater than `b`. */
export function compareMoney(a: MoneyLike, b: MoneyLike): -1 | 0 | 1 {
  const result = toDecimal(a).comparedTo(toDecimal(b));
  if (result < 0) return -1;
  if (result > 0) return 1;
  return 0;
}

export function isNegativeMoney(value: MoneyLike): boolean {
  return toDecimal(value).isNegative() && !toDecimal(value).isZero();
}

/** Clamps a percentage string into [0, 100] using decimal.js for CSS progress bar widths. */
export function clampPercentBarWidth(value: MoneyLike): string {
  return Decimal.max(0, Decimal.min(100, toDecimal(value))).toFixed(2);
}

/** Computes (part / whole) * 100 as a 2-decimal string using decimal.js (returns "0.00" when whole <= 0). */
export function calculatePercentage(part: MoneyLike, whole: MoneyLike): string {
  const denominator = toDecimal(whole);
  if (denominator.lte(0)) {
    return '0.00';
  }
  return toDecimal(part).div(denominator).times(100).toFixed(2);
}

/** Multiplies a money value by a decimal factor (e.g. "0.50") and divides evenly across `count` items using decimal.js. */
export function allocateProportionalShare(total: MoneyLike, factor: string, count: number): string {
  if (count <= 0) {
    return '0';
  }
  const pool = toDecimal(total).times(new Decimal(factor));
  if (pool.lte(0)) {
    return '0';
  }
  return pool.div(new Decimal(count)).toDecimalPlaces(0, Decimal.ROUND_FLOOR).toFixed(0);
}
