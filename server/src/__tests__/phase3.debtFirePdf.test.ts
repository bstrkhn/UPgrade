import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';
import {
  calculateEmergencyFundTarget,
  calculateFireProjection,
  detectLatteFactors,
  evaluateMilestoneLevel,
  simulateDebtPayoff,
} from '../utils/financialMath.js';
import { generateMonthlyReportPdf, type MonthlyPdfTransactionItem } from '../utils/pdfGenerator.js';

const d = (val: string | number) => new Decimal(val);

describe('simulateDebtPayoff — FLAT vs EFFECTIVE & Snowball vs Avalanche', () => {
  it('computes constant monthly interest for FLAT and declining monthly interest for EFFECTIVE', () => {
    const startDate = new Date('2026-11-01T00:00:00.000+07:00');

    const flatSim = simulateDebtPayoff({
      startDate,
      extraMonthlyPayment: d('0'),
      debts: [
        {
          id: 'debt-flat',
          name: 'Pinjaman Flat',
          totalPrincipal: d('1200000'),
          remainingBalance: d('1000000'),
          annualInterestPct: d('12'), // 1% of 1.200.000 = Rp12.000/mo every month
          interestType: 'FLAT',
          minimumMonthlyPay: d('300000'),
        },
      ],
    });

    expect(flatSim.snowball.isPayable).toBe(true);
    expect(flatSim.snowball.schedule[0]?.totalInterestThisMonth).toBe('12000.00');
    expect(flatSim.snowball.schedule[1]?.totalInterestThisMonth).toBe('12000.00');

    const effectiveSim = simulateDebtPayoff({
      startDate,
      extraMonthlyPayment: d('0'),
      debts: [
        {
          id: 'debt-eff',
          name: 'Pinjaman Efektif',
          totalPrincipal: d('1200000'),
          remainingBalance: d('1000000'),
          annualInterestPct: d('12'), // 1% of remaining balance: month 1 = Rp10.000, month 2 < Rp10.000
          interestType: 'EFFECTIVE',
          minimumMonthlyPay: d('300000'),
        },
      ],
    });

    expect(effectiveSim.avalanche.isPayable).toBe(true);
    expect(effectiveSim.avalanche.schedule[0]?.totalInterestThisMonth).toBe('10000.00');
    // Month 1 remaining = 1.000.000 - (300.000 - 10.000) = 710.000 -> Month 2 interest = 1% * 710.000 = 7.100
    expect(effectiveSim.avalanche.schedule[1]?.totalInterestThisMonth).toBe('7100.00');
    expect(
      new Decimal(effectiveSim.avalanche.totalInterestPaid).lt(
        new Decimal(flatSim.avalanche.totalInterestPaid),
      ),
    ).toBe(true);
  });

  it('compares Snowball vs Avalanche rollover and proves Avalanche saves interest on high-rate larger debt', () => {
    const startDate = new Date('2026-11-01T00:00:00.000+07:00');

    const result = simulateDebtPayoff({
      startDate,
      extraMonthlyPayment: d('300000'),
      debts: [
        {
          id: 'debt-small-low',
          name: 'Utang Kecil Bunga Rendah',
          totalPrincipal: d('1000000'),
          remainingBalance: d('1000000'),
          annualInterestPct: d('6.00'), // 0.5% / mo
          interestType: 'EFFECTIVE',
          minimumMonthlyPay: d('100000'),
        },
        {
          id: 'debt-large-high',
          name: 'Kartu Kredit Bunga Tinggi',
          totalPrincipal: d('3000000'),
          remainingBalance: d('3000000'),
          annualInterestPct: d('24.00'), // 2.0% / mo
          interestType: 'EFFECTIVE',
          minimumMonthlyPay: d('150000'),
        },
      ],
    });

    expect(result.snowball.isPayable).toBe(true);
    expect(result.avalanche.isPayable).toBe(true);

    // Snowball pays off the smallest balance first; Avalanche pays off the 24% debt first
    expect(result.snowball.payoffOrder[0]?.debtId).toBe('debt-small-low');
    expect(result.avalanche.payoffOrder[0]?.debtId).toBe('debt-large-high');

    expect(
      new Decimal(result.avalanche.totalInterestPaid).lt(new Decimal(result.snowball.totalInterestPaid)),
    ).toBe(true);
    expect(result.comparison.recommendedStrategy).toBe('AVALANCHE');
    expect(new Decimal(result.comparison.interestSavedByAvalanche).gt(0)).toBe(true);
  });

  it('immediately detects unpayable debt in < 10ms without infinite loop when payment <= monthly interest', () => {
    const t0 = Date.now();
    const result = simulateDebtPayoff({
      extraMonthlyPayment: d('0'),
      debts: [
        {
          id: 'debt-trap',
          name: 'Pinjaman Bunga Tinggi',
          totalPrincipal: d('10000000'),
          remainingBalance: d('10000000'),
          annualInterestPct: d('24.00'), // Monthly interest = Rp200.000
          interestType: 'EFFECTIVE',
          minimumMonthlyPay: d('150000'), // Below Rp200.000 monthly interest
        },
      ],
    });
    const elapsedMs = Date.now() - t0;

    expect(elapsedMs).toBeLessThan(25);
    expect(result.snowball.isPayable).toBe(false);
    expect(result.avalanche.isPayable).toBe(false);
    expect(result.snowball.unpayableReason).toContain('Total pembayaran bulanan belum mencukupi');
  });

  it('returns 0 months when active debts list is empty', () => {
    const empty = simulateDebtPayoff({ debts: [], extraMonthlyPayment: d('500000') });
    expect(empty.snowball.isPayable).toBe(true);
    expect(empty.snowball.monthsToDebtFree).toBe(0);
    expect(empty.snowball.totalInterestPaid).toBe('0.00');
  });
});

describe('calculateFireProjection — SWR, Fisher Real Return & L5–L7 Milestones', () => {
  it('computes 25x annual essential for 4% SWR and accurate Fisher real return rate', () => {
    const startDate = new Date('2026-11-01T00:00:00.000+07:00');
    const result = calculateFireProjection({
      startDate,
      monthlyEssentialBasis: d('3000000'),
      currentInvestmentPortfolio: d('20000000'),
      monthlyContribution: d('3000000'),
      swrRatePct: d('4.00'),
      inflationRatePct: d('4.50'),
      expectedReturnRatePct: d('10.00'),
      maxYears: 40,
    });

    // Annual essential = 36.000.000; L5 = 36.000.000; L6 FIRE = 900.000.000; L7 = 1.800.000.000
    expect(result.annualEssential).toBe('36000000.00');
    expect(result.level5Target).toBe('36000000.00');
    expect(result.fireNumber).toBe('900000000.00');
    expect(result.abundantNumber).toBe('1800000000.00');

    // Fisher equation: ((1.10 / 1.045) - 1) * 100 = 5.263157... -> "5.26"
    expect(result.realReturnRatePct).toBe('5.26');

    expect(result.milestones.level5.alreadyReached).toBe(false);
    expect(result.milestones.level5.isReachableWithinHorizon).toBe(true);
    expect(result.milestones.level5.monthsToTarget).toBeGreaterThan(0);

    expect(result.milestones.level6Fire.isReachableWithinHorizon).toBe(true);
    expect(result.milestones.level6Fire.monthsToTarget).toBeGreaterThan(
      result.milestones.level5.monthsToTarget ?? 0,
    );
    expect(result.yearlyProjection.length).toBeGreaterThanOrEqual(11);
  });

  it('flags alreadyReached when current portfolio already exceeds FIRE number', () => {
    const result = calculateFireProjection({
      monthlyEssentialBasis: d('3000000'),
      currentInvestmentPortfolio: d('1000000000'),
      monthlyContribution: d('1000000'),
      swrRatePct: d('4.00'),
      inflationRatePct: d('4.50'),
      expectedReturnRatePct: d('10.00'),
    });

    expect(result.milestones.level5.alreadyReached).toBe(true);
    expect(result.milestones.level5.monthsToTarget).toBe(0);
    expect(result.milestones.level6Fire.alreadyReached).toBe(true);
    expect(result.milestones.level6Fire.monthsToTarget).toBe(0);
    expect(result.milestones.level7Abundant.alreadyReached).toBe(false);
  });

  it('handles negative real return (inflation > nominal return) and division-by-zero safely without NaN', () => {
    const negativeReal = calculateFireProjection({
      monthlyEssentialBasis: d('3000000'),
      currentInvestmentPortfolio: d('50000000'),
      monthlyContribution: d('500000'),
      swrRatePct: d('4.00'),
      inflationRatePct: d('8.00'),
      expectedReturnRatePct: d('4.00'),
      maxYears: 15,
    });
    expect(new Decimal(negativeReal.realReturnRatePct).isNegative()).toBe(true);
    expect(negativeReal.yearlyProjection.every((pt) => !pt.projectedPortfolio.includes('NaN'))).toBe(true);

    const zeroGuard = calculateFireProjection({
      monthlyEssentialBasis: d('0'),
      currentInvestmentPortfolio: d('0'),
      monthlyContribution: d('0'),
      swrRatePct: d('0'),
      inflationRatePct: d('4.50'),
      expectedReturnRatePct: d('10.00'),
    });
    expect(zeroGuard.fireNumber).toBe('0.00');
    expect(zeroGuard.milestones.level6Fire.isReachableWithinHorizon).toBe(false);
  });
});

describe('generateMonthlyReportPdf — PDFKit Buffer Smoke Tests', () => {
  const emergencyFund = calculateEmergencyFundTarget({
    historicalMonthlyEssentials: [],
    baselineEssential: d('3000000'),
    emergencyFundBalance: d('3000000'),
    currentLevel: 3,
  });

  const latteFactor = detectLatteFactors({
    monthlyIncome: d('6000000'),
    expectedReturnRatePct: d('10.00'),
    transactions: [
      { categoryId: 'c1', categoryName: 'Jajan & Kopi', expenseClass: 'DISCRETIONARY', amount: d('25000') },
      { categoryId: 'c1', categoryName: 'Jajan & Kopi', expenseClass: 'DISCRETIONARY', amount: d('25000') },
      { categoryId: 'c1', categoryName: 'Jajan & Kopi', expenseClass: 'DISCRETIONARY', amount: d('25000') },
    ],
  });

  const milestone = evaluateMilestoneLevel({
    previousHighestLevel: 3,
    monthlySurplus: d('1500000'),
    hasPeriodTransactions: true,
    consumptiveDebtBalance: d('0'),
    emergencyFundBalance: d('3000000'),
    monthlyEssentialBasis: d('3000000'),
    investmentPortfolio: d('5000000'),
    swrRatePct: d('4.00'),
  });

  it('generates a valid PDF buffer starting with %PDF- when transaction list is empty', async () => {
    const buffer = await generateMonthlyReportPdf({
      user: { name: 'Budi Santoso', email: 'budi@upgrade.id' },
      period: { year: 2026, month: 11 },
      cashFlow: {
        totalIncome: '0.00',
        totalExpense: '0.00',
        essentialExpense: '0.00',
        discretionaryExpense: '0.00',
        debtPaymentTotal: '0.00',
        surplus: '0.00',
        savingRatePct: '0.00',
      },
      netWorth: {
        totalAssets: '8000000.00',
        totalLiabilities: '0.00',
        netWorth: '8000000.00',
      },
      emergencyFund,
      latteFactor,
      milestone,
      topExpenses: [],
      transactions: [],
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('generates a multi-page PDF buffer cleanly for 60 transactions without overflowing', async () => {
    const transactions: MonthlyPdfTransactionItem[] = Array.from({ length: 60 }, (_, idx) => ({
      transactionDate: new Date(Date.UTC(2026, 10, (idx % 28) + 1, 5, 0, 0)),
      type: idx % 4 === 0 ? 'INCOME' : idx % 4 === 1 ? 'EXPENSE' : idx % 4 === 2 ? 'TRANSFER' : 'DEBT_PAYMENT',
      amount: '125000.00',
      note: `Catatan Transaksi Ke-${idx + 1} dengan deskripsi cukup panjang untuk uji potong teks`,
      categoryName: idx % 4 === 1 ? 'Makan & Kebutuhan Dapur' : 'Gaji',
      sourceAccountName: 'Rekening BCA Utama',
      destinationAccountName: idx % 4 === 2 ? 'GoPay Dompet Digital' : null,
      debtName: idx % 4 === 3 ? 'Cicilan Paylater' : null,
    }));

    const buffer = await generateMonthlyReportPdf({
      user: { name: 'Siti Rahmawati', email: 'siti@upgrade.id' },
      period: { year: 2026, month: 11 },
      cashFlow: {
        totalIncome: '6000000.00',
        totalExpense: '3500000.00',
        essentialExpense: '2500000.00',
        discretionaryExpense: '1000000.00',
        debtPaymentTotal: '500000.00',
        surplus: '2500000.00',
        savingRatePct: '41.67',
      },
      netWorth: {
        totalAssets: '25000000.00',
        totalLiabilities: '1500000.00',
        netWorth: '23500000.00',
      },
      emergencyFund,
      latteFactor,
      milestone,
      topExpenses: [
        { categoryName: 'Makan & Kebutuhan Dapur', expenseClass: 'ESSENTIAL', spent: '2500000.00' },
        { categoryName: 'Jajan & Kopi', expenseClass: 'DISCRETIONARY', spent: '1000000.00' },
      ],
      transactions,
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(2500);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
