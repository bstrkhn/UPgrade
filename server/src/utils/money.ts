import { Decimal } from 'decimal.js';
import { z } from 'zod';

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export const ZERO = new Decimal(0);

const MONEY_PATTERN = /^\d{1,13}(\.\d{1,2})?$/;
const RATE_PATTERN = /^\d{1,3}(\.\d{1,2})?$/;

/** Strictly positive monetary string (e.g. "20000" or "20000.50") converted immediately to Decimal. */
export const positiveMoney = z
  .string({ error: 'Nominal wajib diisi dalam bentuk angka.' })
  .trim()
  .regex(MONEY_PATTERN, 'Nominal harus berupa angka positif dengan maksimal 2 digit desimal.')
  .transform((value) => new Decimal(value))
  .refine((value) => value.gt(0), 'Nominal harus lebih besar dari Rp0.');

/** Non-negative monetary string (zero allowed) converted immediately to Decimal. */
export const nonNegativeMoney = z
  .string({ error: 'Nominal wajib diisi dalam bentuk angka.' })
  .trim()
  .regex(MONEY_PATTERN, 'Nominal tidak boleh negatif dan maksimal 2 digit desimal.')
  .transform((value) => new Decimal(value));

/** Percentage / rate string between 0 and 100 (inclusive) converted to Decimal. */
export const percentageRate = z
  .string({ error: 'Persentase wajib diisi dalam bentuk angka.' })
  .trim()
  .regex(RATE_PATTERN, 'Persentase harus berupa angka dengan maksimal 2 digit desimal.')
  .transform((value) => new Decimal(value))
  .refine((value) => value.lte(100), 'Persentase tidak boleh lebih dari 100.');

/** Serialises any Decimal-like value to a fixed 2-decimal string for API responses. */
export function toMoneyString(value: Decimal.Value): string {
  return new Decimal(value).toFixed(2);
}

export function toDecimal(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

export function formatRupiah(value: Decimal.Value): string {
  const amount = new Decimal(value);
  const [integerPart = '0', fraction = '00'] = amount.abs().toFixed(2).split('.');
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = amount.isNegative() && !amount.isZero() ? '-' : '';
  return fraction === '00' ? `${sign}Rp${grouped}` : `${sign}Rp${grouped},${fraction}`;
}
