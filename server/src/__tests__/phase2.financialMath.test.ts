import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { calculateBudgetOverview } from '../modules/budgets/budgets.calculations.js';
import { upsertBudgetsSchema } from '../modules/budgets/budgets.schemas.js';
import {
  calculateEmergencyFundTarget,
  calculateMonthlyAnnuityFutureValue,
  calculateNetWorth,
  calculateSavingRate,
  detectLatteFactors,
  evaluateMilestoneLevel,
} from '../utils/financialMath.js';

const d = (val: string | number) => new Decimal(val);

describe('calculateSavingRate & calculateNetWorth', () => {
  it('returns 0.00 when income is 0 (division-by-zero guard)', () => {
    expect(calculateSavingRate(d(0), d(500000)).toFixed(2)).toBe('0.00');
  });

  it('computes saving rate and net worth with decimal precision', () => {
    expect(calculateSavingRate(d('5000000'), d('3200000')).toFixed(2)).toBe('36.00');
    expect(calculateNetWorth([d('10000000.25'), d('2500000.75')], [d('2000000.50')]).toFixed(2)).toBe(
      '10500000.50',
    );
  });
});

describe('calculateEmergencyFundTarget (Cold-Start & Dynamic Switching)', () => {
  it('falls back to ONBOARDING_BASELINE ("Estimasi Awal") when history is 0 months', () => {
    const result = calculateEmergencyFundTarget({
      historicalMonthlyEssentials: [],
      baselineEssential: d('3000000'),
      emergencyFundBalance: d('1500000'),
      currentLevel: 2,
    });

    expect(result.dataSource).toBe('ONBOARDING_BASELINE');
    expect(result.badge).toBe('Estimasi Awal');
    expect(result.historyMonthsCount).toBe(0);
    expect(result.monthlyBasis).toBe('3000000.00');
    expect(result.activeTargetMonths).toBe(1);
    expect(result.activeTargetAmount).toBe('3000000.00');
    expect(result.shortfallToActiveTarget).toBe('1500000.00');
    expect(result.monthsCovered).toBe('0.50');
    expect(result.progressPct).toBe('50.00');
    expect(result.target1Month).toBe('3000000.00');
    expect(result.target3Months).toBe('9000000.00');
    expect(result.target6Months).toBe('18000000.00');
  });

  it('still uses ONBOARDING_BASELINE when history has only 2 distinct months (< 3)', () => {
    const result = calculateEmergencyFundTarget({
      historicalMonthlyEssentials: [d('2500000'), d('2700000')],
      baselineEssential: d('3000000'),
      emergencyFundBalance: d('3000000'),
      currentLevel: 3,
    });

    expect(result.dataSource).toBe('ONBOARDING_BASELINE');
    expect(result.badge).toBe('Estimasi Awal');
    expect(result.historyMonthsCount).toBe(2);
    expect(result.monthlyBasis).toBe('3000000.00');
    expect(result.progressPct).toBe('100.00');
  });

  it('switches automatically to ACTUAL_HISTORICAL ("Data Aktual") once >= 3 months exist', () => {
    const result = calculateEmergencyFundTarget({
      historicalMonthlyEssentials: [d('2000000'), d('2500000'), d('3000000')],
      baselineEssential: d('4000000'),
      emergencyFundBalance: d('5000000'),
      currentLevel: 4,
    });

    expect(result.dataSource).toBe('ACTUAL_HISTORICAL');
    expect(result.badge).toBe('Data Aktual');
    expect(result.historyMonthsCount).toBe(3);
    expect(result.monthlyBasis).toBe('2500000.00');
    expect(result.activeTargetMonths).toBe(3);
    expect(result.activeTargetAmount).toBe('7500000.00');
    expect(result.shortfallToActiveTarget).toBe('2500000.00');
    expect(result.monthsCovered).toBe('2.00');
    expect(result.progressPct).toBe('66.67');
  });

  it('computes 6-month historical average accurately', () => {
    const result = calculateEmergencyFundTarget({
      historicalMonthlyEssentials: [
        d('3100000'),
        d('2900000'),
        d('3000000'),
        d('3200000'),
        d('2800000'),
        d('3000000'),
      ],
      baselineEssential: d('2000000'),
      emergencyFundBalance: d('9000000'),
      currentLevel: 4,
    });

    expect(result.dataSource).toBe('ACTUAL_HISTORICAL');
    expect(result.historyMonthsCount).toBe(6);
    expect(result.monthlyBasis).toBe('3000000.00');
    expect(result.monthsCovered).toBe('3.00');
    expect(result.progressPct).toBe('100.00');
  });

  it('guards against division by zero when monthlyBasis is 0', () => {
    const result = calculateEmergencyFundTarget({
      historicalMonthlyEssentials: [],
      baselineEssential: d('0'),
      emergencyFundBalance: d('500000'),
      currentLevel: 1,
    });

    expect(result.monthlyBasis).toBe('0.00');
    expect(result.monthsCovered).toBe('0.00');
    expect(result.progressPct).toBe('0.00');
  });
});

describe('detectLatteFactors & calculateMonthlyAnnuityFutureValue', () => {
  it('ignores ESSENTIAL categories and DISCRETIONARY categories with frequency < 3', () => {
    const result = detectLatteFactors({
      monthlyIncome: d('5000000'),
      expectedReturnRatePct: d('10.00'),
      transactions: [
        // ESSENTIAL micro-expenses (must be ignored even though 4x)
        { categoryId: 'cat-transport', categoryName: 'Transportasi', expenseClass: 'ESSENTIAL', amount: d('15000') },
        { categoryId: 'cat-transport', categoryName: 'Transportasi', expenseClass: 'ESSENTIAL', amount: d('15000') },
        { categoryId: 'cat-transport', categoryName: 'Transportasi', expenseClass: 'ESSENTIAL', amount: d('15000') },
        { categoryId: 'cat-transport', categoryName: 'Transportasi', expenseClass: 'ESSENTIAL', amount: d('15000') },
        // DISCRETIONARY with only 2 occurrences (must be excluded)
        { categoryId: 'cat-game', categoryName: 'Hiburan', expenseClass: 'DISCRETIONARY', amount: d('40000') },
        { categoryId: 'cat-game', categoryName: 'Hiburan', expenseClass: 'DISCRETIONARY', amount: d('40000') },
        // DISCRETIONARY with 6 occurrences of Rp25.000 = Rp150.000/month
        { categoryId: 'cat-coffee', categoryName: 'Jajan & Kopi', expenseClass: 'DISCRETIONARY', amount: d('25000') },
        { categoryId: 'cat-coffee', categoryName: 'Jajan & Kopi', expenseClass: 'DISCRETIONARY', amount: d('25000') },
        { categoryId: 'cat-coffee', categoryName: 'Jajan & Kopi', expenseClass: 'DISCRETIONARY', amount: d('25000') },
        { categoryId: 'cat-coffee', categoryName: 'Jajan & Kopi', expenseClass: 'DISCRETIONARY', amount: d('25000') },
        { categoryId: 'cat-coffee', categoryName: 'Jajan & Kopi', expenseClass: 'DISCRETIONARY', amount: d('25000') },
        { categoryId: 'cat-coffee', categoryName: 'Jajan & Kopi', expenseClass: 'DISCRETIONARY', amount: d('25000') },
      ],
    });

    // min(5% * 5.000.000 = 250.000, 100.000) -> 100.000
    expect(result.microThresholdUsed).toBe('100000.00');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({
      categoryId: 'cat-coffee',
      categoryName: 'Jajan & Kopi',
      monthlyFrequency: 6,
      monthlyTotal: '150000.00',
      annualizedProjection: '1800000.00',
      opportunityCost5Yr: '11615560.83',
      opportunityCost10Yr: '30726746.84',
    });
    expect(result.totalMonthlyLeak).toBe('150000.00');
    expect(result.totalAnnualLeak).toBe('1800000.00');
  });

  it('uses fallback micro-threshold Rp50.000 when monthlyIncome is 0 and 5% when income is small', () => {
    const zeroIncome = detectLatteFactors({
      monthlyIncome: d('0'),
      expectedReturnRatePct: d('0'),
      transactions: [
        { categoryId: 'cat-coffee', categoryName: 'Jajan & Kopi', expenseClass: 'DISCRETIONARY', amount: d('50000') },
        { categoryId: 'cat-coffee', categoryName: 'Jajan & Kopi', expenseClass: 'DISCRETIONARY', amount: d('50000') },
        { categoryId: 'cat-coffee', categoryName: 'Jajan & Kopi', expenseClass: 'DISCRETIONARY', amount: d('50000') },
        // Above 50.000 fallback -> ignored
        { categoryId: 'cat-coffee', categoryName: 'Jajan & Kopi', expenseClass: 'DISCRETIONARY', amount: d('75000') },
      ],
    });

    expect(zeroIncome.microThresholdUsed).toBe('50000.00');
    expect(zeroIncome.items[0]?.monthlyFrequency).toBe(3);
    expect(zeroIncome.items[0]?.monthlyTotal).toBe('150000.00');
    // At 0% expected return, 5yr = 150.000 * 60 = 9.000.000; 10yr = 150.000 * 120 = 18.000.000
    expect(zeroIncome.items[0]?.opportunityCost5Yr).toBe('9000000.00');
    expect(zeroIncome.items[0]?.opportunityCost10Yr).toBe('18000000.00');

    const lowIncome = detectLatteFactors({
      monthlyIncome: d('800000'),
      expectedReturnRatePct: d('10'),
      transactions: [],
    });
    // 5% of 800.000 = 40.000
    expect(lowIncome.microThresholdUsed).toBe('40000.00');
  });

  it('handles zero monthly contribution in calculateMonthlyAnnuityFutureValue', () => {
    expect(calculateMonthlyAnnuityFutureValue(d(0), d(10), 60).toFixed(2)).toBe('0.00');
  });
});

describe('evaluateMilestoneLevel (Levels 1–7 & Anti-Frustration Recovery Mode)', () => {
  const baseParams = {
    previousHighestLevel: 1,
    monthlySurplus: d('0'),
    hasPeriodTransactions: true,
    consumptiveDebtBalance: d('0'),
    emergencyFundBalance: d('0'),
    monthlyEssentialBasis: d('3000000'),
    investmentPortfolio: d('0'),
    swrRatePct: d('4.00'),
  };

  it('assigns Level 1 (Ketergantungan Kritis) when consumptive debt > 0 and surplus <= 0', () => {
    const res = evaluateMilestoneLevel({
      ...baseParams,
      consumptiveDebtBalance: d('500000'),
      monthlySurplus: d('0'),
    });
    expect(res.currentLevel).toBe(1);
    expect(res.highestLevel).toBe(1);
    expect(res.healthStatus).toBe('NORMAL');
    expect(res.title).toBe('Ketergantungan Kritis');
  });

  it('assigns Level 2 (Kemandirian Dasar) when free of consumptive debt even with 0 surplus (matches Onboarding)', () => {
    const res = evaluateMilestoneLevel({
      ...baseParams,
      consumptiveDebtBalance: d('0'),
      monthlySurplus: d('0'),
    });
    expect(res.currentLevel).toBe(2);
    expect(res.highestLevel).toBe(2);
    expect(res.title).toBe('Kemandirian Dasar');
  });

  it('assigns Level 3 (Ruang Bernapas) when EF >= 1x essential and surplus > 0 (or fresh month)', () => {
    const res = evaluateMilestoneLevel({
      ...baseParams,
      consumptiveDebtBalance: d('1000000'),
      emergencyFundBalance: d('3000000'),
      monthlySurplus: d('500000'),
    });
    expect(res.currentLevel).toBe(3);
    expect(res.title).toBe('Ruang Bernapas');

    const freshMonth = evaluateMilestoneLevel({
      ...baseParams,
      previousHighestLevel: 3,
      consumptiveDebtBalance: d('1000000'),
      emergencyFundBalance: d('3000000'),
      monthlySurplus: d('0'),
      hasPeriodTransactions: false,
    });
    expect(freshMonth.currentLevel).toBe(3);
    expect(freshMonth.healthStatus).toBe('NORMAL');
  });

  it('assigns Level 4 (Stabilitas Finansial) when consumptive debt == 0 and EF >= 3x essential', () => {
    const res = evaluateMilestoneLevel({
      ...baseParams,
      consumptiveDebtBalance: d('0'),
      emergencyFundBalance: d('9000000'),
      monthlySurplus: d('0'),
    });
    expect(res.currentLevel).toBe(4);
    expect(res.highestLevel).toBe(4);
    expect(res.title).toBe('Stabilitas Finansial');
  });

  it('assigns Levels 5, 6, and 7 based on investment portfolio thresholds once Level 4 is met', () => {
    // Essential = 3.000.000/mo -> Annual = 36.000.000 -> FIRE (4% SWR) = 900.000.000 -> 2x FIRE = 1.800.000.000
    const l5 = evaluateMilestoneLevel({
      ...baseParams,
      emergencyFundBalance: d('9000000'),
      investmentPortfolio: d('36000000'),
    });
    expect(l5.currentLevel).toBe(5);
    expect(l5.title).toBe('Fleksibilitas');

    const l6 = evaluateMilestoneLevel({
      ...baseParams,
      emergencyFundBalance: d('9000000'),
      investmentPortfolio: d('900000000'),
    });
    expect(l6.currentLevel).toBe(6);
    expect(l6.title).toBe('Kebebasan Finansial Dasar');

    const l7 = evaluateMilestoneLevel({
      ...baseParams,
      emergencyFundBalance: d('9000000'),
      investmentPortfolio: d('1800000000'),
    });
    expect(l7.currentLevel).toBe(7);
    expect(l7.title).toBe('Kekayaan Melimpah');
  });

  it('never downgrades highestLevel and triggers RECOVERY_MODE with "Isi Ulang Dana Darurat" when EF drops', () => {
    const res = evaluateMilestoneLevel({
      ...baseParams,
      previousHighestLevel: 4,
      consumptiveDebtBalance: d('0'),
      emergencyFundBalance: d('6000000'), // 2x essential (below L4's 3x requirement)
      monthlySurplus: d('200000'),
    });

    expect(res.currentLevel).toBe(3);
    expect(res.highestLevel).toBe(4);
    expect(res.healthStatus).toBe('RECOVERY_MODE');
    expect(res.missions[0]?.title).toBe('Isi Ulang Dana Darurat');
    expect(res.missions[0]?.priority).toBe('HIGH');
  });

  it('guards against division by zero when monthlyEssentialBasis is 0', () => {
    const res = evaluateMilestoneLevel({
      ...baseParams,
      monthlyEssentialBasis: d('0'),
    });
    expect(res.currentLevel).toBe(1);
    expect(res.fireNumber).toBe('0.00');
  });
});

describe('calculateBudgetOverview & upsertBudgetsSchema', () => {
  const expenseCategories = [
    { id: 'cat-food', name: 'Makan & Dapur', expenseClass: 'ESSENTIAL' as const },
    { id: 'cat-coffee', name: 'Jajan & Kopi', expenseClass: 'DISCRETIONARY' as const },
  ];

  it('reports BALANCED when unallocated is Rp0 in ZERO_BASED framework', () => {
    const overview = calculateBudgetOverview({
      period: { year: 2026, month: 11 },
      budgetFramework: 'ZERO_BASED',
      expenseCategories,
      budgets: [
        { categoryId: 'cat-food', allocated: '3500000' },
        { categoryId: 'cat-coffee', allocated: '1500000' },
      ],
      transactions: [
        { type: 'INCOME', amount: '5000000', categoryId: 'cat-salary' },
        { type: 'EXPENSE', amount: '2000000', categoryId: 'cat-food' },
        { type: 'EXPENSE', amount: '1600000', categoryId: 'cat-coffee' },
      ],
    });

    expect(overview.zeroBased).toEqual({
      totalIncome: '5000000.00',
      totalAllocated: '5000000.00',
      unallocated: '0.00',
      status: 'BALANCED',
    });

    const coffeeRow = overview.categories.find((c) => c.categoryId === 'cat-coffee');
    expect(coffeeRow?.isOverBudget).toBe(true);
    expect(coffeeRow?.remaining).toBe('-100000.00');

    expect(overview.rule503020.needs.targetAmount).toBe('2500000.00');
    expect(overview.rule503020.needs.actualPctOfIncome).toBe('40.00');
    expect(overview.rule503020.wants.targetAmount).toBe('1500000.00');
    expect(overview.rule503020.wants.actualPctOfIncome).toBe('32.00');
    expect(overview.rule503020.savings.targetAmount).toBe('1000000.00');
    expect(overview.rule503020.savings.actualSavings).toBe('1400000.00');
    expect(overview.rule503020.savings.actualPctOfIncome).toBe('28.00');
  });

  it('reports UNDER_ALLOCATED and OVER_ALLOCATED accurately', () => {
    const under = calculateBudgetOverview({
      period: { year: 2026, month: 11 },
      budgetFramework: 'ZERO_BASED',
      expenseCategories,
      budgets: [{ categoryId: 'cat-food', allocated: '2000000' }],
      transactions: [{ type: 'INCOME', amount: '5000000', categoryId: null }],
    });
    expect(under.zeroBased.status).toBe('UNDER_ALLOCATED');
    expect(under.zeroBased.unallocated).toBe('3000000.00');

    const over = calculateBudgetOverview({
      period: { year: 2026, month: 11 },
      budgetFramework: 'ZERO_BASED',
      expenseCategories,
      budgets: [{ categoryId: 'cat-food', allocated: '6000000' }],
      transactions: [
        { type: 'INCOME', amount: '5000000', categoryId: null },
        { type: 'EXPENSE', amount: '250000', categoryId: 'cat-coffee' },
      ],
    });
    expect(over.zeroBased.status).toBe('OVER_ALLOCATED');
    expect(over.zeroBased.unallocated).toBe('-1000000.00');

    // Unbudgeted category (allocated = 0) with spent > 0 must NOT be flagged over-budget
    const unbudgetedRow = over.categories.find((c) => c.categoryId === 'cat-coffee');
    expect(unbudgetedRow?.allocated).toBe('0.00');
    expect(unbudgetedRow?.spent).toBe('250000.00');
    expect(unbudgetedRow?.isOverBudget).toBe(false);
    expect(unbudgetedRow?.utilizationPct).toBe('0.00');
  });

  it('rejects duplicate categoryId in upsertBudgetsSchema', () => {
    const id = '3f2b7c1e-8a4d-4c1b-9f3a-1d2e3f4a5b6c';
    const parsed = upsertBudgetsSchema.safeParse({
      items: [
        { categoryId: id, allocated: '500000' },
        { categoryId: id, allocated: '700000' },
      ],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe(
        'Terdapat kategori yang duplikat dalam daftar alokasi anggaran.',
      );
    }
  });
});
