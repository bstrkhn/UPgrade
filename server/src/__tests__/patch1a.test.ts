import { describe, expect, it } from 'vitest';
import {
  calculateDashboardSummary,
  getCurrentWibPeriod,
  getWibMonthRange,
  type SummaryTransaction,
} from '../modules/dashboard/dashboard.calculations.js';
import { listDebtsQuerySchema } from '../modules/debts/debts.schemas.js';
import { updatePreferencesSchema } from '../modules/auth/auth.schemas.js';
import { onboardingSchema } from '../modules/onboarding/onboarding.schemas.js';
import { listTransactionsQuerySchema, parseFilterDate } from '../modules/transactions/transactions.schemas.js';

describe('parseFilterDate / listTransactionsQuerySchema', () => {
  it('maps a date-only "from" to start-of-day WIB', () => {
    const result = parseFilterDate('start', 'Tanggal awal tidak valid.').parse('2026-11-30');
    expect(result.toISOString()).toBe('2026-11-29T17:00:00.000Z');
  });

  it('maps a date-only "to" to end-of-day WIB (23:59:59.999 +07:00)', () => {
    const result = parseFilterDate('end', 'Tanggal akhir tidak valid.').parse('2026-11-30');
    expect(result.toISOString()).toBe('2026-11-30T16:59:59.999Z');
    expect(result.getTime()).toBe(new Date('2026-11-30T23:59:59.999+07:00').getTime());
  });

  it('rejects non-existent calendar dates such as 2026-02-31', () => {
    const parsed = parseFilterDate('end', 'Tanggal akhir tidak valid.').safeParse('2026-02-31');
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe('Tanggal akhir tidak valid.');
    }
  });

  it('rejects garbage strings', () => {
    expect(parseFilterDate('start', 'Tanggal awal tidak valid.').safeParse('bukan-tanggal').success).toBe(false);
  });

  it('passes full ISO-8601 timestamps through unchanged', () => {
    const withOffset = parseFilterDate('end', 'x').parse('2026-11-30T10:15:00.000+07:00');
    expect(withOffset.toISOString()).toBe('2026-11-30T03:15:00.000Z');
    const utc = parseFilterDate('start', 'x').parse('2026-11-30T10:15:00.000Z');
    expect(utc.toISOString()).toBe('2026-11-30T10:15:00.000Z');
  });

  it('applies boundaries inside listTransactionsQuerySchema', () => {
    const result = listTransactionsQuerySchema.parse({ from: '2026-11-01', to: '2026-11-30' });
    expect(result.from?.toISOString()).toBe('2026-10-31T17:00:00.000Z');
    expect(result.to?.toISOString()).toBe('2026-11-30T16:59:59.999Z');
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('allows a single-day range (from = to)', () => {
    expect(listTransactionsQuerySchema.safeParse({ from: '2026-11-15', to: '2026-11-15' }).success).toBe(true);
  });

  it('rejects from > to with an Indonesian message', () => {
    const parsed = listTransactionsQuerySchema.safeParse({ from: '2026-12-01', to: '2026-11-30' });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe('Tanggal awal tidak boleh setelah tanggal akhir.');
    }
  });

  it('rejects an invalid date in the query schema', () => {
    expect(listTransactionsQuerySchema.safeParse({ to: '2026-02-31' }).success).toBe(false);
  });
});

describe('baselineEssential must be positive', () => {
  const validOnboarding = {
    baselineEssential: '3000000',
    accounts: [{ name: 'Dompet', type: 'CASH', balance: '100000' }],
  };

  it('onboardingSchema accepts a positive baselineEssential', () => {
    expect(onboardingSchema.safeParse(validOnboarding).success).toBe(true);
  });

  it('onboardingSchema rejects baselineEssential "0"', () => {
    const parsed = onboardingSchema.safeParse({ ...validOnboarding, baselineEssential: '0' });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path).toEqual(['baselineEssential']);
    }
  });

  it('onboardingSchema rejects "0.00"', () => {
    expect(onboardingSchema.safeParse({ ...validOnboarding, baselineEssential: '0.00' }).success).toBe(false);
  });

  it('updatePreferencesSchema accepts a positive baselineEssential', () => {
    expect(updatePreferencesSchema.safeParse({ baselineEssential: '2500000' }).success).toBe(true);
  });

  it('updatePreferencesSchema rejects baselineEssential "0"', () => {
    const parsed = updatePreferencesSchema.safeParse({ baselineEssential: '0' });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path).toEqual(['baselineEssential']);
    }
  });
});

describe('listDebtsQuerySchema', () => {
  it('parses "false" to false (not true)', () => {
    expect(listDebtsQuerySchema.parse({ activeOnly: 'false' }).activeOnly).toBe(false);
  });

  it('parses "true" to true', () => {
    expect(listDebtsQuerySchema.parse({ activeOnly: 'true' }).activeOnly).toBe(true);
  });

  it('leaves activeOnly undefined when omitted', () => {
    expect(listDebtsQuerySchema.parse({}).activeOnly).toBeUndefined();
  });

  it('rejects other values', () => {
    const parsed = listDebtsQuerySchema.safeParse({ activeOnly: 'yes' });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe('activeOnly harus berupa true atau false.');
    }
  });
});

describe('dashboard period helpers', () => {
  it('builds a half-open WIB range for a regular month', () => {
    const { start, nextMonthStart } = getWibMonthRange(2026, 11);
    expect(start.toISOString()).toBe('2026-10-31T17:00:00.000Z');
    expect(nextMonthStart.toISOString()).toBe('2026-11-30T17:00:00.000Z');
  });

  it('rolls over to January of the next year for December', () => {
    const { start, nextMonthStart } = getWibMonthRange(2026, 12);
    expect(start.toISOString()).toBe('2026-11-30T17:00:00.000Z');
    expect(nextMonthStart.toISOString()).toBe('2026-12-31T17:00:00.000Z');
  });

  it('derives the current WIB period (UTC late evening is already next month in WIB)', () => {
    expect(getCurrentWibPeriod(new Date('2026-11-30T18:00:00.000Z'))).toEqual({ year: 2026, month: 12 });
    expect(getCurrentWibPeriod(new Date('2026-12-31T17:00:00.000Z'))).toEqual({ year: 2027, month: 1 });
    expect(getCurrentWibPeriod(new Date('2026-11-15T05:00:00.000Z'))).toEqual({ year: 2026, month: 11 });
  });
});

describe('calculateDashboardSummary', () => {
  const tx = (
    type: SummaryTransaction['type'],
    amount: string,
    categoryId: string | null,
    expenseClass: 'ESSENTIAL' | 'DISCRETIONARY' | null,
  ): SummaryTransaction => ({
    type,
    amount,
    categoryId,
    category: categoryId === null ? null : { expenseClass },
  });

  it('excludes TRANSFER and computes cash flow, net worth and category spend', () => {
    const summary = calculateDashboardSummary({
      accounts: [{ balance: '12500000.00' }],
      activeDebts: [{ remainingBalance: '2000000.00' }],
      transactions: [
        tx('INCOME', '5000000', 'cat-salary', null),
        tx('EXPENSE', '2100000', 'cat-food', 'ESSENTIAL'),
        tx('EXPENSE', '600000.50', 'cat-fun', 'DISCRETIONARY'),
        tx('EXPENSE', '499999.50', 'cat-fun', 'DISCRETIONARY'),
        tx('TRANSFER', '9000000', null, null),
        tx('DEBT_PAYMENT', '500000', null, null),
      ],
    });

    expect(summary.cashFlow).toEqual({
      totalIncome: '5000000.00',
      totalExpense: '3200000.00',
      essentialExpense: '2100000.00',
      discretionaryExpense: '1100000.00',
      debtPaymentTotal: '500000.00',
      surplus: '1800000.00',
      savingRatePct: '36.00',
    });
    expect(summary.netWorth).toEqual({
      totalAssets: '12500000.00',
      totalLiabilities: '2000000.00',
      netWorth: '10500000.00',
    });
    expect(summary.categoryMonthlySpent).toEqual([
      { categoryId: 'cat-food', spent: '2100000.00' },
      { categoryId: 'cat-fun', spent: '1100000.00' },
    ]);
  });

  it('returns savingRatePct "0.00" when income is zero (no division by zero)', () => {
    const summary = calculateDashboardSummary({
      accounts: [],
      activeDebts: [],
      transactions: [tx('EXPENSE', '150000', 'cat-food', 'ESSENTIAL')],
    });
    expect(summary.cashFlow.totalIncome).toBe('0.00');
    expect(summary.cashFlow.surplus).toBe('-150000.00');
    expect(summary.cashFlow.savingRatePct).toBe('0.00');
  });

  it('keeps decimal precision without floating-point drift', () => {
    const summary = calculateDashboardSummary({
      accounts: [{ balance: '0.10' }, { balance: '0.20' }],
      activeDebts: [],
      transactions: [tx('INCOME', '0.10', null, null), tx('INCOME', '0.20', null, null)],
    });
    expect(summary.netWorth.totalAssets).toBe('0.30');
    expect(summary.cashFlow.totalIncome).toBe('0.30');
  });

  it('ignores uncategorised expenses in categoryMonthlySpent but counts them in totalExpense', () => {
    const summary = calculateDashboardSummary({
      accounts: [],
      activeDebts: [],
      transactions: [tx('EXPENSE', '10000', null, null)],
    });
    expect(summary.cashFlow.totalExpense).toBe('10000.00');
    expect(summary.categoryMonthlySpent).toEqual([]);
  });

  it('returns all-zero values for an empty period', () => {
    const summary = calculateDashboardSummary({ accounts: [], activeDebts: [], transactions: [] });
    expect(summary.cashFlow.savingRatePct).toBe('0.00');
    expect(summary.netWorth.netWorth).toBe('0.00');
    expect(summary.categoryMonthlySpent).toEqual([]);
  });
});
