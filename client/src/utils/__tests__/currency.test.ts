import { describe, expect, it } from 'vitest';
import {
  allocateProportionalShare,
  calculatePercentage,
  clampPercentBarWidth,
  compareMoney,
  finalizeMoneyInput,
  formatPercent,
  formatRupiah,
  isValidNonNegativeMoney,
  isValidPositiveMoney,
  sanitizeMoneyInput,
  subtractMoney,
  sumMoney,
} from '../currency';
import {
  dateInputToTransactionDate,
  formatDateId,
  getCurrentWibPeriod,
  monthNameId,
  shiftPeriod,
  toDateInputValue,
} from '../date';

describe('formatRupiah', () => {
  it('formats integers with Indonesian thousand separators', () => {
    expect(formatRupiah('1500000.00')).toBe('Rp1.500.000');
    expect(formatRupiah('25000')).toBe('Rp25.000');
    expect(formatRupiah('0')).toBe('Rp0');
  });

  it('keeps non-zero decimals with a comma', () => {
    expect(formatRupiah('12500.50')).toBe('Rp12.500,50');
  });

  it('formats negative balances', () => {
    expect(formatRupiah('-125000.00')).toBe('-Rp125.000');
  });

  it('treats empty and invalid values as zero', () => {
    expect(formatRupiah(null)).toBe('Rp0');
    expect(formatRupiah(undefined)).toBe('Rp0');
    expect(formatRupiah('abc')).toBe('Rp0');
  });

  it('does not show a negative sign for -0', () => {
    expect(formatRupiah('-0.00')).toBe('Rp0');
  });
});

describe('formatPercent', () => {
  it('uses a decimal comma', () => {
    expect(formatPercent('36.00')).toBe('36,00%');
    expect(formatPercent('-12.5')).toBe('-12,50%');
  });

  it('clamps percentage bar width between 0 and 100 as a string without JS number math', () => {
    expect(clampPercentBarWidth('36.00')).toBe('36.00');
    expect(clampPercentBarWidth('-15.00')).toBe('0.00');
    expect(clampPercentBarWidth('140.00')).toBe('100.00');
  });

  it('calculates percentages and proportional allocations via decimal.js', () => {
    expect(calculatePercentage('150000', '500000')).toBe('30.00');
    expect(calculatePercentage('150000', '0')).toBe('0.00');
    expect(allocateProportionalShare('5000000', '0.50', 5)).toBe('500000');
    expect(allocateProportionalShare('0', '0.50', 5)).toBe('0');
  });
});

describe('sanitizeMoneyInput', () => {
  it('removes letters and minus signs', () => {
    expect(sanitizeMoneyInput('-abc25000x')).toBe('25000');
  });

  it('strips unnecessary leading zeros', () => {
    expect(sanitizeMoneyInput('007')).toBe('7');
    expect(sanitizeMoneyInput('000')).toBe('0');
    expect(sanitizeMoneyInput('0')).toBe('0');
  });

  it('accepts a comma as decimal separator and limits to 2 decimals', () => {
    expect(sanitizeMoneyInput('25,5')).toBe('25.5');
    expect(sanitizeMoneyInput('25,567')).toBe('25.56');
    expect(sanitizeMoneyInput('0,5')).toBe('0.5');
    expect(sanitizeMoneyInput(',5')).toBe('0.5');
  });

  it('understands pasted thousand separators', () => {
    expect(sanitizeMoneyInput('1.000.000')).toBe('1000000');
    expect(sanitizeMoneyInput('12.500')).toBe('12500');
  });

  it('keeps a trailing dot while typing', () => {
    expect(sanitizeMoneyInput('25.')).toBe('25.');
  });

  it('limits to 13 integer digits', () => {
    expect(sanitizeMoneyInput('12345678901234567')).toBe('1234567890123');
  });

  it('returns an empty string for non-numeric input', () => {
    expect(sanitizeMoneyInput('abc')).toBe('');
  });
});

describe('finalizeMoneyInput', () => {
  it('drops an unfinished trailing dot', () => {
    expect(finalizeMoneyInput('25.')).toBe('25');
    expect(finalizeMoneyInput('25.5')).toBe('25.5');
  });
});

describe('money validators', () => {
  it('isValidPositiveMoney accepts only values greater than zero', () => {
    expect(isValidPositiveMoney('1')).toBe(true);
    expect(isValidPositiveMoney('0.01')).toBe(true);
    expect(isValidPositiveMoney('0')).toBe(false);
    expect(isValidPositiveMoney('0.00')).toBe(false);
    expect(isValidPositiveMoney('')).toBe(false);
    expect(isValidPositiveMoney('-5')).toBe(false);
    expect(isValidPositiveMoney('1.234')).toBe(false);
    expect(isValidPositiveMoney('12345678901234')).toBe(false);
  });

  it('isValidNonNegativeMoney allows zero', () => {
    expect(isValidNonNegativeMoney('0')).toBe(true);
    expect(isValidNonNegativeMoney('100000.50')).toBe(true);
    expect(isValidNonNegativeMoney('-1')).toBe(false);
    expect(isValidNonNegativeMoney('abc')).toBe(false);
    expect(isValidNonNegativeMoney('')).toBe(false);
  });
});

describe('sumMoney / subtractMoney / compareMoney', () => {
  it('sums without floating-point drift', () => {
    expect(sumMoney(['0.10', '0.20'])).toBe('0.30');
    expect(sumMoney(['1000000', '200000', '0.5'])).toBe('1200000.50');
    expect(sumMoney([])).toBe('0.00');
  });

  it('subtracts precisely', () => {
    expect(subtractMoney('0.30', '0.10')).toBe('0.20');
    expect(subtractMoney('475000', '600000')).toBe('-125000.00');
  });

  it('compares values numerically, not lexically', () => {
    expect(compareMoney('9', '10')).toBe(-1);
    expect(compareMoney('600000', '475000.00')).toBe(1);
    expect(compareMoney('100.0', '100.00')).toBe(0);
  });
});

describe('date helpers', () => {
  it('names months in Bahasa Indonesia', () => {
    expect(monthNameId(1)).toBe('Januari');
    expect(monthNameId(8)).toBe('Agustus');
    expect(monthNameId(12)).toBe('Desember');
  });

  it('derives the WIB period from a UTC instant', () => {
    expect(getCurrentWibPeriod(new Date('2026-11-30T18:00:00.000Z'))).toEqual({ year: 2026, month: 12 });
    expect(getCurrentWibPeriod(new Date('2026-11-15T05:00:00.000Z'))).toEqual({ year: 2026, month: 11 });
  });

  it('shifts periods across year boundaries', () => {
    expect(shiftPeriod({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftPeriod({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftPeriod({ year: 2026, month: 5 }, 0)).toEqual({ year: 2026, month: 5 });
  });

  it('formats dates in WIB', () => {
    expect(formatDateId('2026-11-30T17:30:00.000Z')).toBe('1 Desember 2026');
    expect(toDateInputValue('2026-11-30T17:30:00.000Z')).toBe('2026-12-01');
  });

  it('keeps picked past dates on the same WIB day', () => {
    const iso = dateInputToTransactionDate('2026-10-05', new Date('2026-11-21T03:00:00.000Z'));
    expect(toDateInputValue(iso)).toBe('2026-10-05');
  });
});
