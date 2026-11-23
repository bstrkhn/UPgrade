import { Decimal } from 'decimal.js';
import type { ExpenseClass, HealthStatus, InterestType } from '@prisma/client';
import { ZERO, formatRupiah, toMoneyString } from './money.js';

export type EmergencyFundDataSource = 'ONBOARDING_BASELINE' | 'ACTUAL_HISTORICAL';
export type EmergencyFundBadge = 'Estimasi Awal' | 'Data Aktual';

export interface EmergencyFundParams {
  historicalMonthlyEssentials: Decimal[];
  baselineEssential: Decimal;
  emergencyFundBalance: Decimal;
  currentLevel: number;
}

export interface EmergencyFundResult {
  dataSource: EmergencyFundDataSource;
  badge: EmergencyFundBadge;
  historyMonthsCount: number;
  monthlyBasis: string;
  currentBalance: string;
  monthsCovered: string;
  activeTargetMonths: 1 | 3;
  activeTargetAmount: string;
  shortfallToActiveTarget: string;
  progressPct: string;
  target1Month: string;
  target3Months: string;
  target6Months: string;
}

export interface LatteCandidateTransaction {
  categoryId: string;
  categoryName: string;
  expenseClass: ExpenseClass | null;
  amount: Decimal;
}

export interface DetectLatteFactorsParams {
  transactions: LatteCandidateTransaction[];
  monthlyIncome: Decimal;
  expectedReturnRatePct: Decimal;
}

export interface LatteFactorItem {
  categoryId: string;
  categoryName: string;
  monthlyFrequency: number;
  monthlyTotal: string;
  annualizedProjection: string;
  opportunityCost5Yr: string;
  opportunityCost10Yr: string;
}

export interface LatteFactorResult {
  windowDays: 30;
  microThresholdUsed: string;
  expectedReturnRatePct: string;
  totalMonthlyLeak: string;
  totalAnnualLeak: string;
  totalOpportunityCost5Yr: string;
  totalOpportunityCost10Yr: string;
  items: LatteFactorItem[];
}

export interface EvaluateMilestoneParams {
  previousHighestLevel: number;
  monthlySurplus: Decimal;
  hasPeriodTransactions: boolean;
  consumptiveDebtBalance: Decimal;
  emergencyFundBalance: Decimal;
  monthlyEssentialBasis: Decimal;
  investmentPortfolio: Decimal;
  swrRatePct: Decimal;
}

export interface MilestoneRequirement {
  code: string;
  label: string;
  currentDisplay: string;
  targetDisplay: string;
  isMet: boolean;
  progressPct: string;
}

export interface MilestoneMission {
  id: string;
  title: string;
  description: string;
  priority: 'HIGH' | 'NORMAL';
  completed: boolean;
}

export interface MilestoneEvaluationResult {
  currentLevel: number;
  highestLevel: number;
  healthStatus: HealthStatus;
  title: string;
  tagline: string;
  fireNumber: string;
  consumptiveDebtBalance: string;
  investmentPortfolio: string;
  nextLevelRequirements: MilestoneRequirement[];
  missions: MilestoneMission[];
}

const HUNDRED = new Decimal(100);
const TWELVE = new Decimal(12);
const MICRO_CAP = new Decimal('100000');
const MICRO_FALLBACK = new Decimal('50000');
const INCOME_MICRO_RATIO = new Decimal('0.05');

export const LEVEL_METADATA_ID: Record<number, { title: string; tagline: string }> = {
  1: {
    title: 'Ketergantungan Kritis',
    tagline: 'Fokus hentikan utang konsumtif baru, terapkan anggaran berbasis nol, dan catat pengeluaran 30 hari.',
  },
  2: {
    title: 'Kemandirian Dasar',
    tagline: 'Arus kas mulai seimbang dan bebas utang konsumtif. Sisihkan 1%–10% penghasilan di awal gajian.',
  },
  3: {
    title: 'Ruang Bernapas',
    tagline: 'Surplus bulanan positif dan Dana Darurat minimal 1 bulan pengeluaran pokok telah tercapai.',
  },
  4: {
    title: 'Stabilitas Finansial',
    tagline: 'Bebas utang konsumtif sepenuhnya dengan bantalan Dana Darurat minimal 3 bulan pengeluaran pokok.',
  },
  5: {
    title: 'Fleksibilitas',
    tagline: 'Portofolio investasi telah menembus minimal 12 bulan pengeluaran pokok. Pertahankan rasio tabungan tinggi.',
  },
  6: {
    title: 'Kebebasan Finansial Dasar',
    tagline: 'Portofolio investasi mencapai angka FIRE dan mampu menopang biaya hidup pokok melalui Safe Withdrawal Rate.',
  },
  7: {
    title: 'Kekayaan Melimpah',
    tagline: 'Portofolio investasi melampaui 2x angka FIRE. Fokus pada pelestarian kekayaan dan dampak sosial.',
  },
};

function clampPct(value: Decimal): Decimal {
  return Decimal.max(ZERO, Decimal.min(HUNDRED, value));
}

function progressTowardTarget(current: Decimal, target: Decimal): Decimal {
  if (target.lte(ZERO)) {
    return current.gte(ZERO) ? HUNDRED : ZERO;
  }
  return clampPct(current.div(target).times(HUNDRED));
}

/**
 * Pure Saving Rate helper using decimal.js:
 * ((totalIncome - totalExpense) / totalIncome) * 100, returning 0.00 when totalIncome <= 0.
 */
export function calculateSavingRate(totalIncome: Decimal, totalExpense: Decimal): Decimal {
  if (totalIncome.lte(ZERO)) {
    return ZERO;
  }
  return totalIncome.minus(totalExpense).div(totalIncome).times(HUNDRED);
}

/**
 * Pure Net Worth helper using decimal.js:
 * sum(accountBalances) - sum(activeDebtBalances).
 */
export function calculateNetWorth(accountBalances: readonly Decimal[], activeDebtBalances: readonly Decimal[]): Decimal {
  const totalAssets = accountBalances.reduce((acc, val) => acc.plus(val), ZERO);
  const totalLiabilities = activeDebtBalances.reduce((acc, val) => acc.plus(val), ZERO);
  return totalAssets.minus(totalLiabilities);
}

/**
 * Dynamic Emergency Fund Target with Cold-Start (< 3 distinct historical months) fallback
 * to `baselineEssential` ("Estimasi Awal") and automatic switch to actual average ("Data Aktual")
 * once >= 3 months exist.
 */
export function calculateEmergencyFundTarget(params: EmergencyFundParams): EmergencyFundResult {
  const validHistory = params.historicalMonthlyEssentials.filter((amount) => amount.gt(ZERO));
  const historyMonthsCount = validHistory.length;

  let dataSource: EmergencyFundDataSource;
  let badge: EmergencyFundBadge;
  let monthlyBasis: Decimal;

  if (historyMonthsCount >= 3) {
    dataSource = 'ACTUAL_HISTORICAL';
    badge = 'Data Aktual';
    const sumHistorical = validHistory.reduce((acc, val) => acc.plus(val), ZERO);
    monthlyBasis = sumHistorical.div(new Decimal(historyMonthsCount));
  } else {
    dataSource = 'ONBOARDING_BASELINE';
    badge = 'Estimasi Awal';
    monthlyBasis = Decimal.max(ZERO, params.baselineEssential);
  }

  const safeEmergencyBalance = params.emergencyFundBalance;
  const activeTargetMonths: 1 | 3 = params.currentLevel >= 4 ? 3 : 1;

  const target1Month = monthlyBasis.times(1);
  const target3Months = monthlyBasis.times(3);
  const target6Months = monthlyBasis.times(6);
  const activeTargetAmount = monthlyBasis.times(activeTargetMonths);

  const shortfallToActiveTarget = Decimal.max(ZERO, activeTargetAmount.minus(safeEmergencyBalance));

  let monthsCovered = ZERO;
  let progressPct = ZERO;

  if (monthlyBasis.gt(ZERO)) {
    monthsCovered = Decimal.max(ZERO, safeEmergencyBalance.div(monthlyBasis));
    progressPct = progressTowardTarget(safeEmergencyBalance, activeTargetAmount);
  }

  return {
    dataSource,
    badge,
    historyMonthsCount,
    monthlyBasis: toMoneyString(monthlyBasis),
    currentBalance: toMoneyString(safeEmergencyBalance),
    monthsCovered: toMoneyString(monthsCovered),
    activeTargetMonths,
    activeTargetAmount: toMoneyString(activeTargetAmount),
    shortfallToActiveTarget: toMoneyString(shortfallToActiveTarget),
    progressPct: toMoneyString(progressPct),
    target1Month: toMoneyString(target1Month),
    target3Months: toMoneyString(target3Months),
    target6Months: toMoneyString(target6Months),
  };
}

/**
 * Future Value of an Ordinary Monthly Annuity:
 * FV = P * (((1 + rm)^n - 1) / rm), or P * n when rm == 0.
 * Strictly uses Decimal.pow(n) without Math.pow.
 */
export function calculateMonthlyAnnuityFutureValue(
  monthlyContribution: Decimal,
  annualReturnRatePct: Decimal,
  months: number,
): Decimal {
  if (monthlyContribution.lte(ZERO) || months <= 0) {
    return ZERO;
  }
  const monthlyRate = annualReturnRatePct.div(HUNDRED).div(TWELVE);
  if (monthlyRate.lte(ZERO)) {
    return monthlyContribution.times(new Decimal(months));
  }
  const compounded = new Decimal(1).plus(monthlyRate).pow(months);
  return monthlyContribution.times(compounded.minus(1).div(monthlyRate));
}

/**
 * Latte Factor Audit:
 * - Dynamic micro-threshold: min(5% * monthlyIncome, 100000), or 50000 fallback when monthlyIncome <= 0.
 * - Filters strictly for DISCRETIONARY expenses with amount <= microThreshold (ESSENTIAL ignored).
 * - Includes categories with frequency >= 3 within the 30-day window.
 * - Projects annualized spend (x12) and 5-year (60m) / 10-year (120m) compounded opportunity cost.
 */
export function detectLatteFactors(params: DetectLatteFactorsParams): LatteFactorResult {
  const microThreshold = params.monthlyIncome.gt(ZERO)
    ? Decimal.min(params.monthlyIncome.times(INCOME_MICRO_RATIO), MICRO_CAP)
    : MICRO_FALLBACK;

  const grouped = new Map<
    string,
    {
      categoryId: string;
      categoryName: string;
      count: number;
      total: Decimal;
    }
  >();

  for (const tx of params.transactions) {
    if (tx.expenseClass !== 'DISCRETIONARY') continue;
    if (tx.amount.lte(ZERO) || tx.amount.gt(microThreshold)) continue;

    const existing = grouped.get(tx.categoryId);
    if (existing) {
      existing.count += 1;
      existing.total = existing.total.plus(tx.amount);
    } else {
      grouped.set(tx.categoryId, {
        categoryId: tx.categoryId,
        categoryName: tx.categoryName,
        count: 1,
        total: tx.amount,
      });
    }
  }

  const rawItems: Array<{
    categoryId: string;
    categoryName: string;
    monthlyFrequency: number;
    monthlyTotal: Decimal;
    annualizedProjection: Decimal;
    opportunityCost5Yr: Decimal;
    opportunityCost10Yr: Decimal;
  }> = [];

  for (const entry of grouped.values()) {
    if (entry.count < 3) continue;

    const annualized = entry.total.times(TWELVE);
    const fv5Yr = calculateMonthlyAnnuityFutureValue(entry.total, params.expectedReturnRatePct, 60);
    const fv10Yr = calculateMonthlyAnnuityFutureValue(entry.total, params.expectedReturnRatePct, 120);

    rawItems.push({
      categoryId: entry.categoryId,
      categoryName: entry.categoryName,
      monthlyFrequency: entry.count,
      monthlyTotal: entry.total,
      annualizedProjection: annualized,
      opportunityCost5Yr: fv5Yr,
      opportunityCost10Yr: fv10Yr,
    });
  }

  rawItems.sort(
    (a, b) =>
      b.annualizedProjection.comparedTo(a.annualizedProjection) || a.categoryName.localeCompare(b.categoryName),
  );

  const totalMonthlyLeak = rawItems.reduce((acc, item) => acc.plus(item.monthlyTotal), ZERO);
  const totalAnnualLeak = rawItems.reduce((acc, item) => acc.plus(item.annualizedProjection), ZERO);
  const totalOpportunityCost5Yr = rawItems.reduce((acc, item) => acc.plus(item.opportunityCost5Yr), ZERO);
  const totalOpportunityCost10Yr = rawItems.reduce((acc, item) => acc.plus(item.opportunityCost10Yr), ZERO);

  return {
    windowDays: 30,
    microThresholdUsed: toMoneyString(microThreshold),
    expectedReturnRatePct: toMoneyString(params.expectedReturnRatePct),
    totalMonthlyLeak: toMoneyString(totalMonthlyLeak),
    totalAnnualLeak: toMoneyString(totalAnnualLeak),
    totalOpportunityCost5Yr: toMoneyString(totalOpportunityCost5Yr),
    totalOpportunityCost10Yr: toMoneyString(totalOpportunityCost10Yr),
    items: rawItems.map((item) => ({
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      monthlyFrequency: item.monthlyFrequency,
      monthlyTotal: toMoneyString(item.monthlyTotal),
      annualizedProjection: toMoneyString(item.annualizedProjection),
      opportunityCost5Yr: toMoneyString(item.opportunityCost5Yr),
      opportunityCost10Yr: toMoneyString(item.opportunityCost10Yr),
    })),
  };
}

function buildNextLevelRequirements(params: {
  targetLevel: number;
  monthlySurplus: Decimal;
  hasPeriodTransactions: boolean;
  consumptiveDebtBalance: Decimal;
  emergencyFundBalance: Decimal;
  monthlyEssentialBasis: Decimal;
  investmentPortfolio: Decimal;
  annualEssential: Decimal;
  fireNumber: Decimal;
  abundantNumber: Decimal;
}): MilestoneRequirement[] {
  const {
    targetLevel,
    monthlySurplus,
    hasPeriodTransactions,
    consumptiveDebtBalance,
    emergencyFundBalance,
    monthlyEssentialBasis,
    investmentPortfolio,
    annualEssential,
    fireNumber,
    abundantNumber,
  } = params;

  const ef1Target = monthlyEssentialBasis.times(1);
  const ef3Target = monthlyEssentialBasis.times(3);
  const debtFreeMet = consumptiveDebtBalance.lte(ZERO);
  const surplusPositiveOrFreshMonth = monthlySurplus.gt(ZERO) || !hasPeriodTransactions;

  if (targetLevel <= 2) {
    return [
      {
        code: 'NO_CONSUMPTIVE_DEBT_OR_POSITIVE_SURPLUS',
        label: 'Arus kas bulanan positif atau bebas utang konsumtif',
        currentDisplay: formatRupiah(monthlySurplus),
        targetDisplay: `> ${formatRupiah(ZERO)}`,
        isMet: monthlySurplus.gt(ZERO) || (monthlySurplus.eq(ZERO) && debtFreeMet),
        progressPct: toMoneyString(
          monthlySurplus.gt(ZERO) || (monthlySurplus.eq(ZERO) && debtFreeMet) ? HUNDRED : ZERO,
        ),
      },
    ];
  }

  if (targetLevel === 3) {
    return [
      {
        code: 'POSITIVE_MONTHLY_SURPLUS',
        label: 'Pertahankan surplus arus kas bulanan positif',
        currentDisplay: formatRupiah(monthlySurplus),
        targetDisplay: `> ${formatRupiah(ZERO)}`,
        isMet: surplusPositiveOrFreshMonth,
        progressPct: toMoneyString(surplusPositiveOrFreshMonth ? HUNDRED : ZERO),
      },
      {
        code: 'EMERGENCY_FUND_1M',
        label: 'Dana Darurat minimal 1 bulan pengeluaran pokok',
        currentDisplay: formatRupiah(emergencyFundBalance),
        targetDisplay: formatRupiah(ef1Target),
        isMet: ef1Target.gt(ZERO) && emergencyFundBalance.gte(ef1Target),
        progressPct: toMoneyString(progressTowardTarget(emergencyFundBalance, ef1Target)),
      },
    ];
  }

  if (targetLevel === 4) {
    return [
      {
        code: 'ZERO_CONSUMPTIVE_DEBT',
        label: 'Lunasi seluruh utang konsumtif hingga Rp0',
        currentDisplay: `Sisa ${formatRupiah(consumptiveDebtBalance)}`,
        targetDisplay: formatRupiah(ZERO),
        isMet: debtFreeMet,
        progressPct: toMoneyString(debtFreeMet ? HUNDRED : ZERO),
      },
      {
        code: 'EMERGENCY_FUND_3M',
        label: 'Dana Darurat minimal 3 bulan pengeluaran pokok',
        currentDisplay: formatRupiah(emergencyFundBalance),
        targetDisplay: formatRupiah(ef3Target),
        isMet: ef3Target.gt(ZERO) && emergencyFundBalance.gte(ef3Target),
        progressPct: toMoneyString(progressTowardTarget(emergencyFundBalance, ef3Target)),
      },
    ];
  }

  if (targetLevel === 5) {
    return [
      {
        code: 'MAINTAIN_LEVEL_4_FOUNDATION',
        label: 'Pertahankan bebas utang konsumtif & Dana Darurat 3x pengeluaran pokok',
        currentDisplay: formatRupiah(emergencyFundBalance),
        targetDisplay: formatRupiah(ef3Target),
        isMet: debtFreeMet && ef3Target.gt(ZERO) && emergencyFundBalance.gte(ef3Target),
        progressPct: toMoneyString(
          debtFreeMet ? progressTowardTarget(emergencyFundBalance, ef3Target) : ZERO,
        ),
      },
      {
        code: 'INVESTMENT_12M_ESSENTIAL',
        label: 'Portofolio investasi minimal 12x pengeluaran pokok bulanan',
        currentDisplay: formatRupiah(investmentPortfolio),
        targetDisplay: formatRupiah(annualEssential),
        isMet: annualEssential.gt(ZERO) && investmentPortfolio.gte(annualEssential),
        progressPct: toMoneyString(progressTowardTarget(investmentPortfolio, annualEssential)),
      },
    ];
  }

  if (targetLevel === 6) {
    return [
      {
        code: 'INVESTMENT_FIRE_NUMBER',
        label: 'Portofolio investasi mencapai Angka FIRE (100% biaya hidup pokok via SWR)',
        currentDisplay: formatRupiah(investmentPortfolio),
        targetDisplay: formatRupiah(fireNumber),
        isMet: fireNumber.gt(ZERO) && investmentPortfolio.gte(fireNumber),
        progressPct: toMoneyString(progressTowardTarget(investmentPortfolio, fireNumber)),
      },
    ];
  }

  return [
    {
      code: 'INVESTMENT_2X_FIRE_NUMBER',
      label: 'Portofolio investasi mencapai 2x Angka FIRE (Kekayaan Melimpah)',
      currentDisplay: formatRupiah(investmentPortfolio),
      targetDisplay: formatRupiah(abundantNumber),
      isMet: abundantNumber.gt(ZERO) && investmentPortfolio.gte(abundantNumber),
      progressPct: toMoneyString(progressTowardTarget(investmentPortfolio, abundantNumber)),
    },
  ];
}

function buildLevelMissions(params: {
  computedLevel: number;
  highestLevel: number;
  healthStatus: HealthStatus;
  monthlySurplus: Decimal;
  consumptiveDebtBalance: Decimal;
  emergencyFundBalance: Decimal;
  monthlyEssentialBasis: Decimal;
  investmentPortfolio: Decimal;
}): MilestoneMission[] {
  const {
    computedLevel,
    highestLevel,
    healthStatus,
    monthlySurplus,
    consumptiveDebtBalance,
    emergencyFundBalance,
    monthlyEssentialBasis,
    investmentPortfolio,
  } = params;

  const missions: MilestoneMission[] = [];

  if (healthStatus === 'RECOVERY_MODE') {
    missions.push({
      id: 'RECOVERY_REFILL_EMERGENCY_FUND',
      title: 'Isi Ulang Dana Darurat',
      description: `Dana darurat terpakai di bawah standar Level ${highestLevel}. Lencana rekor Anda tetap aman — prioritaskan pengisian kembali sebelum menambah pos investasi baru.`,
      priority: 'HIGH',
      completed: false,
    });
  }

  const ef1Target = monthlyEssentialBasis.times(1);
  const ef3Target = monthlyEssentialBasis.times(3);
  const ef6Target = monthlyEssentialBasis.times(6);

  switch (computedLevel) {
    case 1:
      missions.push(
        {
          id: 'L1_ZERO_BASED_BUDGET',
          title: 'Terapkan Zero-Based Budgeting',
          description: 'Beri tugas setiap Rupiah pemasukan di halaman Anggaran hingga sisa tak teralokasi Rp0.',
          priority: 'HIGH',
          completed: false,
        },
        {
          id: 'L1_STOP_CONSUMPTIVE_DEBT',
          title: 'Hentikan Penambahan Utang Konsumtif Baru',
          description: 'Hindari penggunaan Paylater atau cicilan konsumtif baru selama masa stabilisasi arus kas.',
          priority: 'HIGH',
          completed: consumptiveDebtBalance.lte(ZERO),
        },
        {
          id: 'L1_AUDIT_LATTE_FACTOR',
          title: 'Audit Pengeluaran Mikro (Latte Factor)',
          description: 'Catat seluruh pengeluaran harian selama 30 hari dan pangkas kebocoran halus kategori Keinginan.',
          priority: 'NORMAL',
          completed: false,
        },
      );
      break;

    case 2:
      missions.push(
        {
          id: 'L2_PAY_YOURSELF_FIRST',
          title: 'Terapkan Pay Yourself First (1%–10%)',
          description: 'Sisihkan minimal 1% hingga 10% penghasilan ke akun Dana Darurat tepat saat gajian diterima.',
          priority: 'HIGH',
          completed: monthlySurplus.gt(ZERO),
        },
        {
          id: 'L2_BUILD_1M_EMERGENCY_FUND',
          title: 'Capai Dana Darurat 1x Pengeluaran Pokok',
          description: `Kumpulkan saldo akun Dana Darurat hingga mencapai ${formatRupiah(ef1Target)}.`,
          priority: 'NORMAL',
          completed: ef1Target.gt(ZERO) && emergencyFundBalance.gte(ef1Target),
        },
      );
      break;

    case 3:
      missions.push(
        {
          id: 'L3_DEBT_DESTROYER',
          title: 'Akselerasi Pelunasan Utang Konsumtif',
          description: 'Fokuskan surplus bulanan untuk melunasi sisa utang konsumtif hingga tuntas Rp0.',
          priority: 'HIGH',
          completed: consumptiveDebtBalance.lte(ZERO),
        },
        {
          id: 'L3_BUILD_3M_EMERGENCY_FUND',
          title: 'Tingkatkan Dana Darurat ke 3x Pengeluaran Pokok',
          description: `Bangun bantalan Dana Darurat menuju ${formatRupiah(ef3Target)} untuk naik ke Level 4.`,
          priority: 'NORMAL',
          completed: ef3Target.gt(ZERO) && emergencyFundBalance.gte(ef3Target),
        },
      );
      break;

    case 4:
      missions.push(
        {
          id: 'L4_HEALTH_PROTECTION',
          title: 'Pastikan Proteksi Kesehatan Dasar (BPJS / Asuransi)',
          description: 'Lindungi Dana Darurat dari risiko medis dengan memastikan kepesertaan BPJS Kesehatan aktif.',
          priority: 'NORMAL',
          completed: false,
        },
        {
          id: 'L4_AUTOMATE_INVESTING',
          title: 'Otomatisasi Investasi Bulanan',
          description: 'Rutin alokasikan surplus bulanan ke akun Portofolio Investasi hingga mencapai 12x biaya pokok.',
          priority: 'HIGH',
          completed: investmentPortfolio.gt(ZERO),
        },
        {
          id: 'L4_EXPAND_6M_EMERGENCY_FUND',
          title: 'Perkuat Dana Darurat Ideal 6x Pengeluaran Pokok',
          description: `Sempurnakan ketahanan kas jangka panjang menuju ${formatRupiah(ef6Target)}.`,
          priority: 'NORMAL',
          completed: ef6Target.gt(ZERO) && emergencyFundBalance.gte(ef6Target),
        },
      );
      break;

    case 5:
      missions.push(
        {
          id: 'L5_BOOST_SAVING_RATE',
          title: 'Dorong Rasio Tabungan ke 30%–50%',
          description: 'Pertahankan gaya hidup sehat dan percepat akumulasi portofolio menuju angka FIRE.',
          priority: 'HIGH',
          completed: false,
        },
        {
          id: 'L5_PORTFOLIO_REBALANCING',
          title: 'Evaluasi Alokasi Aset & Rebalancing Berkala',
          description: 'Jaga profil risiko investasi tetap terdiversifikasi sesuai horison waktu kebebasan finansial.',
          priority: 'NORMAL',
          completed: false,
        },
      );
      break;

    case 6:
      missions.push(
        {
          id: 'L6_SWR_DISCIPLINE',
          title: 'Kelola Penarikan Portofolio Sesuai Safe Withdrawal Rate',
          description: 'Jaga tingkat penarikan tahunan tidak melebihi SWR agar pokok portofolio bertahan lintas dekade.',
          priority: 'HIGH',
          completed: true,
        },
        {
          id: 'L6_PASSIVE_INCOME_BUFFER',
          title: 'Pertahankan Bantalan Kas Likuid 1–2 Tahun',
          description: 'Lindungi portofolio dari volatilitas pasar dengan cadangan kas likuid yang memadai.',
          priority: 'NORMAL',
          completed: false,
        },
      );
      break;

    case 7:
    default:
      missions.push(
        {
          id: 'L7_WEALTH_PRESERVATION',
          title: 'Pelestarian Kekayaan & Perencanaan Waris',
          description: 'Optimalkan struktur aset lintas generasi, efisiensi pajak, dan keberlanjutan portofolio.',
          priority: 'NORMAL',
          completed: true,
        },
        {
          id: 'L7_PHILANTHROPY_IMPACT',
          title: 'Perluas Dampak Sosial & Filantropi',
          description: 'Salurkan sebagian surplus investasi untuk kontribusi sosial dan pemberdayaan yang bermakna.',
          priority: 'NORMAL',
          completed: false,
        },
      );
      break;
  }

  return missions;
}

/**
 * Evaluates the 7-Level UPgrade Financial Freedom Milestone and enforces Anti-Frustration Recovery Mode:
 * - `highestLevel` NEVER downgrades (`Math.max(previousHighestLevel, computedLevel)`).
 * - When `computedLevel < highestLevel`, `healthStatus` becomes `'RECOVERY_MODE'` and top-priority
 *   mission `"Isi Ulang Dana Darurat"` is injected at position 0.
 */
export function evaluateMilestoneLevel(params: EvaluateMilestoneParams): MilestoneEvaluationResult {
  const safeEssential = params.monthlyEssentialBasis.gt(ZERO) ? params.monthlyEssentialBasis : ZERO;
  const safeConsumptiveDebt = Decimal.max(ZERO, params.consumptiveDebtBalance);
  const safeEmergencyFund = Decimal.max(ZERO, params.emergencyFundBalance);
  const safeInvestments = Decimal.max(ZERO, params.investmentPortfolio);
  const safeSwrPct = params.swrRatePct.gt(ZERO) ? params.swrRatePct : ZERO;

  const efMonths = safeEssential.gt(ZERO) ? safeEmergencyFund.div(safeEssential) : ZERO;
  const annualEssential = safeEssential.times(TWELVE);
  const fireNumber =
    safeEssential.gt(ZERO) && safeSwrPct.gt(ZERO) ? annualEssential.div(safeSwrPct.div(HUNDRED)) : ZERO;
  const abundantNumber = fireNumber.times(2);

  let computedLevel = 1;

  if (safeEssential.gt(ZERO)) {
    const l2Met =
      params.monthlySurplus.gt(ZERO) ||
      (params.monthlySurplus.eq(ZERO) && safeConsumptiveDebt.eq(ZERO));
    if (l2Met) {
      computedLevel = 2;
    }

    const l3SurplusMet = params.monthlySurplus.gt(ZERO) || !params.hasPeriodTransactions;
    if (efMonths.gte(1) && l3SurplusMet) {
      computedLevel = 3;
    }

    const l4Met = safeConsumptiveDebt.eq(ZERO) && efMonths.gte(3);
    if (l4Met) {
      computedLevel = 4;
    }

    if (computedLevel >= 4 && annualEssential.gt(ZERO) && safeInvestments.gte(annualEssential)) {
      computedLevel = 5;
    }

    if (computedLevel >= 4 && fireNumber.gt(ZERO) && safeInvestments.gte(fireNumber)) {
      computedLevel = 6;
    }

    if (computedLevel >= 4 && abundantNumber.gt(ZERO) && safeInvestments.gte(abundantNumber)) {
      computedLevel = 7;
    }
  }

  const safePrevHighest = Math.max(1, Math.min(7, params.previousHighestLevel || 1));
  const highestLevel = Math.max(safePrevHighest, computedLevel);
  const healthStatus: HealthStatus = computedLevel < highestLevel ? 'RECOVERY_MODE' : 'NORMAL';

  const meta = LEVEL_METADATA_ID[computedLevel] ?? LEVEL_METADATA_ID[1]!;
  const targetLevel = healthStatus === 'RECOVERY_MODE' ? highestLevel : Math.min(7, computedLevel + 1);

  const nextLevelRequirements = buildNextLevelRequirements({
    targetLevel,
    monthlySurplus: params.monthlySurplus,
    hasPeriodTransactions: params.hasPeriodTransactions,
    consumptiveDebtBalance: safeConsumptiveDebt,
    emergencyFundBalance: safeEmergencyFund,
    monthlyEssentialBasis: safeEssential,
    investmentPortfolio: safeInvestments,
    annualEssential,
    fireNumber,
    abundantNumber,
  });

  const missions = buildLevelMissions({
    computedLevel,
    highestLevel,
    healthStatus,
    monthlySurplus: params.monthlySurplus,
    consumptiveDebtBalance: safeConsumptiveDebt,
    emergencyFundBalance: safeEmergencyFund,
    monthlyEssentialBasis: safeEssential,
    investmentPortfolio: safeInvestments,
  });

  return {
    currentLevel: computedLevel,
    highestLevel,
    healthStatus,
    title: meta.title,
    tagline: meta.tagline,
    fireNumber: toMoneyString(fireNumber),
    consumptiveDebtBalance: toMoneyString(safeConsumptiveDebt),
    investmentPortfolio: toMoneyString(safeInvestments),
    nextLevelRequirements,
    missions,
  };
}

// ============================================================================
// PHASE 3: DEBT DESTROYER (SNOWBALL VS AVALANCHE) & FIRE COUNTDOWN (L5–L7)
// ============================================================================

export type DebtPayoffStrategyName = 'SNOWBALL' | 'AVALANCHE';

export interface SimDebtInput {
  id: string;
  name: string;
  totalPrincipal: Decimal;
  remainingBalance: Decimal;
  annualInterestPct: Decimal;
  interestType: InterestType;
  minimumMonthlyPay: Decimal;
}

export interface SimulateDebtPayoffParams {
  debts: SimDebtInput[];
  extraMonthlyPayment: Decimal;
  startDate?: Date;
}

export interface DebtPayoffOrderItem {
  debtId: string;
  name: string;
  paidOffMonth: number;
  paidOffDate: string;
  totalInterestPaid: string;
  totalAmountPaid: string;
}

export interface DebtPayoffMonthlyPoint {
  month: number;
  date: string;
  totalRemainingBalance: string;
  totalInterestThisMonth: string;
  totalPrincipalThisMonth: string;
  totalPaidThisMonth: string;
}

export interface DebtStrategySimulationResult {
  strategy: DebtPayoffStrategyName;
  isPayable: boolean;
  unpayableReason: string | null;
  monthsToDebtFree: number | null;
  debtFreeDate: string | null;
  totalInterestPaid: string;
  totalAmountPaid: string;
  payoffOrder: DebtPayoffOrderItem[];
  schedule: DebtPayoffMonthlyPoint[];
}

export interface DebtSimulationComparison {
  interestSavedByAvalanche: string;
  monthsSavedByAvalanche: number;
  recommendedStrategy: 'AVALANCHE' | 'SNOWBALL' | 'TIE';
}

export interface DebtPayoffSimulationOutput {
  snowball: DebtStrategySimulationResult;
  avalanche: DebtStrategySimulationResult;
  comparison: DebtSimulationComparison;
}

const MAX_SIMULATION_MONTHS = 600;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function addMonthsToWibYearMonth(startDate: Date, monthsToAdd: number): string {
  const shifted = new Date(startDate.getTime() + WIB_OFFSET_MS);
  const baseYear = shifted.getUTCFullYear();
  const baseMonthIndex = shifted.getUTCMonth();
  const totalMonths = baseYear * 12 + baseMonthIndex + monthsToAdd;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
}

function getWibCalendarYear(startDate: Date): number {
  const shifted = new Date(startDate.getTime() + WIB_OFFSET_MS);
  return shifted.getUTCFullYear();
}

function computeMonthlyDebtInterest(debt: SimDebtInput, currentBalance: Decimal): Decimal {
  if (currentBalance.lte(ZERO) || debt.annualInterestPct.lte(ZERO)) {
    return ZERO;
  }
  const basis = debt.interestType === 'FLAT' ? debt.totalPrincipal : currentBalance;
  return basis
    .times(debt.annualInterestPct)
    .div(HUNDRED)
    .div(TWELVE)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

function runSingleDebtStrategy(
  strategy: DebtPayoffStrategyName,
  activeDebts: readonly SimDebtInput[],
  extraMonthlyPayment: Decimal,
  startDate: Date,
): DebtStrategySimulationResult {
  if (activeDebts.length === 0) {
    return {
      strategy,
      isPayable: true,
      unpayableReason: null,
      monthsToDebtFree: 0,
      debtFreeDate: addMonthsToWibYearMonth(startDate, 0),
      totalInterestPaid: '0.00',
      totalAmountPaid: '0.00',
      payoffOrder: [],
      schedule: [],
    };
  }

  const ordered = [...activeDebts].sort((a, b) => {
    if (strategy === 'SNOWBALL') {
      return (
        a.remainingBalance.comparedTo(b.remainingBalance) ||
        b.annualInterestPct.comparedTo(a.annualInterestPct) ||
        a.name.localeCompare(b.name)
      );
    }
    return (
      b.annualInterestPct.comparedTo(a.annualInterestPct) ||
      a.remainingBalance.comparedTo(b.remainingBalance) ||
      a.name.localeCompare(b.name)
    );
  });

  const totalMinimumPay = ordered.reduce((acc, debt) => acc.plus(Decimal.max(ZERO, debt.minimumMonthlyPay)), ZERO);
  const monthlyBudget = totalMinimumPay.plus(Decimal.max(ZERO, extraMonthlyPayment));

  const firstMonthInterest = ordered.reduce(
    (acc, debt) => acc.plus(computeMonthlyDebtInterest(debt, debt.remainingBalance)),
    ZERO,
  );

  // Early anti-infinite-loop guard: total monthly budget cannot even cover the first month's interest
  if (monthlyBudget.lte(ZERO) || monthlyBudget.lte(firstMonthInterest)) {
    return {
      strategy,
      isPayable: false,
      unpayableReason:
        'Total pembayaran bulanan belum mencukupi untuk menutup beban bunga utang. Tambahkan pembayaran ekstra bulanan.',
      monthsToDebtFree: null,
      debtFreeDate: null,
      totalInterestPaid: '0.00',
      totalAmountPaid: '0.00',
      payoffOrder: [],
      schedule: [],
    };
  }

  interface WorkingDebtState {
    debt: SimDebtInput;
    balance: Decimal;
    unpaidInterest: Decimal;
    cumulativeInterestPaid: Decimal;
    cumulativeAmountPaid: Decimal;
    paidOff: boolean;
  }

  const states: WorkingDebtState[] = ordered.map((debt) => ({
    debt,
    balance: debt.remainingBalance,
    unpaidInterest: ZERO,
    cumulativeInterestPaid: ZERO,
    cumulativeAmountPaid: ZERO,
    paidOff: false,
  }));

  const payoffOrder: DebtPayoffOrderItem[] = [];
  const schedule: DebtPayoffMonthlyPoint[] = [];
  let grandTotalInterestPaid = ZERO;
  let grandTotalAmountPaid = ZERO;

  for (let month = 1; month <= MAX_SIMULATION_MONTHS; month += 1) {
    for (const state of states) {
      if (state.paidOff || state.balance.lte(ZERO)) continue;
      state.unpaidInterest = computeMonthlyDebtInterest(state.debt, state.balance);
    }

    let remainingBudget = monthlyBudget;
    let totalInterestThisMonth = ZERO;
    let totalPrincipalThisMonth = ZERO;

    // Stage 1: Minimum payments on each active debt
    for (const state of states) {
      if (state.paidOff || (state.balance.lte(ZERO) && state.unpaidInterest.lte(ZERO))) continue;
      if (remainingBudget.lte(ZERO)) break;

      const totalDue = state.balance.plus(state.unpaidInterest);
      const minPay = Decimal.min(Decimal.max(ZERO, state.debt.minimumMonthlyPay), totalDue, remainingBudget);
      if (minPay.lte(ZERO)) continue;

      const interestPortion = Decimal.min(minPay, state.unpaidInterest);
      const principalPortion = minPay.minus(interestPortion);

      state.unpaidInterest = state.unpaidInterest.minus(interestPortion);
      state.balance = state.balance.minus(principalPortion);
      remainingBudget = remainingBudget.minus(minPay);

      totalInterestThisMonth = totalInterestThisMonth.plus(interestPortion);
      totalPrincipalThisMonth = totalPrincipalThisMonth.plus(principalPortion);
      state.cumulativeInterestPaid = state.cumulativeInterestPaid.plus(interestPortion);
      state.cumulativeAmountPaid = state.cumulativeAmountPaid.plus(minPay);
    }

    // Stage 2: Rollover freed minimums + extraMonthlyPayment into priority debts
    for (const state of states) {
      if (state.paidOff || (state.balance.lte(ZERO) && state.unpaidInterest.lte(ZERO))) continue;
      if (remainingBudget.lte(ZERO)) break;

      if (state.unpaidInterest.gt(ZERO)) {
        const interestCover = Decimal.min(remainingBudget, state.unpaidInterest);
        state.unpaidInterest = state.unpaidInterest.minus(interestCover);
        remainingBudget = remainingBudget.minus(interestCover);
        totalInterestThisMonth = totalInterestThisMonth.plus(interestCover);
        state.cumulativeInterestPaid = state.cumulativeInterestPaid.plus(interestCover);
        state.cumulativeAmountPaid = state.cumulativeAmountPaid.plus(interestCover);
      }

      if (remainingBudget.gt(ZERO) && state.balance.gt(ZERO)) {
        const principalCover = Decimal.min(remainingBudget, state.balance);
        state.balance = state.balance.minus(principalCover);
        remainingBudget = remainingBudget.minus(principalCover);
        totalPrincipalThisMonth = totalPrincipalThisMonth.plus(principalCover);
        state.cumulativeAmountPaid = state.cumulativeAmountPaid.plus(principalCover);
      }
    }

    // Capitalize any residual unpaid interest on lower-priority debts and check payoffs
    let totalRemainingBalance = ZERO;
    const monthDateStr = addMonthsToWibYearMonth(startDate, month);

    for (const state of states) {
      if (state.paidOff) continue;
      if (state.unpaidInterest.gt(ZERO)) {
        state.balance = state.balance.plus(state.unpaidInterest);
        state.unpaidInterest = ZERO;
      }

      if (state.balance.lte(ZERO)) {
        state.balance = ZERO;
        state.paidOff = true;
        payoffOrder.push({
          debtId: state.debt.id,
          name: state.debt.name,
          paidOffMonth: month,
          paidOffDate: monthDateStr,
          totalInterestPaid: toMoneyString(state.cumulativeInterestPaid),
          totalAmountPaid: toMoneyString(state.cumulativeAmountPaid),
        });
      } else {
        totalRemainingBalance = totalRemainingBalance.plus(state.balance);
      }
    }

    const totalPaidThisMonth = totalInterestThisMonth.plus(totalPrincipalThisMonth);
    grandTotalInterestPaid = grandTotalInterestPaid.plus(totalInterestThisMonth);
    grandTotalAmountPaid = grandTotalAmountPaid.plus(totalPaidThisMonth);

    schedule.push({
      month,
      date: monthDateStr,
      totalRemainingBalance: toMoneyString(totalRemainingBalance),
      totalInterestThisMonth: toMoneyString(totalInterestThisMonth),
      totalPrincipalThisMonth: toMoneyString(totalPrincipalThisMonth),
      totalPaidThisMonth: toMoneyString(totalPaidThisMonth),
    });

    if (totalRemainingBalance.lte(ZERO)) {
      return {
        strategy,
        isPayable: true,
        unpayableReason: null,
        monthsToDebtFree: month,
        debtFreeDate: monthDateStr,
        totalInterestPaid: toMoneyString(grandTotalInterestPaid),
        totalAmountPaid: toMoneyString(grandTotalAmountPaid),
        payoffOrder,
        schedule,
      };
    }
  }

  return {
    strategy,
    isPayable: false,
    unpayableReason:
      'Waktu pelunasan melebihi batas simulasi 50 tahun (600 bulan). Tambahkan pembayaran ekstra bulanan.',
    monthsToDebtFree: null,
    debtFreeDate: null,
    totalInterestPaid: toMoneyString(grandTotalInterestPaid),
    totalAmountPaid: toMoneyString(grandTotalAmountPaid),
    payoffOrder,
    schedule,
  };
}

/**
 * Simulates both SNOWBALL (smallest balance first) and AVALANCHE (highest interest rate first)
 * debt payoff strategies using 100% decimal.js, supporting FLAT and EFFECTIVE interest types,
 * rollover surplus, and a 600-month anti-infinite-loop guard.
 */
export function simulateDebtPayoff(params: SimulateDebtPayoffParams): DebtPayoffSimulationOutput {
  const startDate = params.startDate ?? new Date();
  const activeDebts = params.debts.filter((debt) => debt.remainingBalance.gt(ZERO));
  const extra = Decimal.max(ZERO, params.extraMonthlyPayment);

  const snowball = runSingleDebtStrategy('SNOWBALL', activeDebts, extra, startDate);
  const avalanche = runSingleDebtStrategy('AVALANCHE', activeDebts, extra, startDate);

  let interestSavedByAvalanche = ZERO;
  let monthsSavedByAvalanche = 0;
  let recommendedStrategy: 'AVALANCHE' | 'SNOWBALL' | 'TIE' = 'TIE';

  if (snowball.isPayable && avalanche.isPayable) {
    const snowballInterest = new Decimal(snowball.totalInterestPaid);
    const avalancheInterest = new Decimal(avalanche.totalInterestPaid);
    const diff = snowballInterest.minus(avalancheInterest);
    interestSavedByAvalanche = Decimal.max(ZERO, diff);
    monthsSavedByAvalanche = (snowball.monthsToDebtFree ?? 0) - (avalanche.monthsToDebtFree ?? 0);

    if (diff.gt(ZERO)) {
      recommendedStrategy = 'AVALANCHE';
    } else if (diff.lt(ZERO)) {
      recommendedStrategy = 'SNOWBALL';
    } else if (monthsSavedByAvalanche > 0) {
      recommendedStrategy = 'AVALANCHE';
    } else if (monthsSavedByAvalanche < 0) {
      recommendedStrategy = 'SNOWBALL';
    } else {
      recommendedStrategy = 'TIE';
    }
  }

  return {
    snowball,
    avalanche,
    comparison: {
      interestSavedByAvalanche: toMoneyString(interestSavedByAvalanche),
      monthsSavedByAvalanche,
      recommendedStrategy,
    },
  };
}

export interface CalculateFireProjectionParams {
  monthlyEssentialBasis: Decimal;
  currentInvestmentPortfolio: Decimal;
  monthlyContribution: Decimal;
  swrRatePct: Decimal;
  inflationRatePct: Decimal;
  expectedReturnRatePct: Decimal;
  maxYears?: number;
  startDate?: Date;
}

export interface FireMilestoneCountdown {
  targetAmount: string;
  progressPct: string;
  alreadyReached: boolean;
  isReachableWithinHorizon: boolean;
  monthsToTarget: number | null;
  years: number | null;
  remainingMonths: number | null;
  targetDate: string | null;
}

export interface FireYearlyProjectionPoint {
  year: number;
  calendarYear: number;
  projectedPortfolio: string;
  totalContributed: string;
  investmentGrowth: string;
  level5Target: string;
  fireNumber: string;
  abundantNumber: string;
}

export interface FireProjectionResult {
  annualEssential: string;
  level5Target: string;
  fireNumber: string;
  abundantNumber: string;
  swrRatePct: string;
  nominalReturnRatePct: string;
  inflationRatePct: string;
  realReturnRatePct: string;
  milestones: {
    level5: FireMilestoneCountdown;
    level6Fire: FireMilestoneCountdown;
    level7Abundant: FireMilestoneCountdown;
  };
  yearlyProjection: FireYearlyProjectionPoint[];
}

/**
 * Calculates SWR & FIRE Countdown across Level 5 (12x essential), Level 6 (FIRE Number),
 * and Level 7 (2x FIRE Number) using the Fisher real return rate:
 *   r_real = ((1 + r_nom) / (1 + r_inf)) - 1
 * Strictly uses decimal.js with division-by-zero and negative-real-return guards.
 */
export function calculateFireProjection(params: CalculateFireProjectionParams): FireProjectionResult {
  const startDate = params.startDate ?? new Date();
  const startCalendarYear = getWibCalendarYear(startDate);
  const horizonYears = Math.max(1, Math.min(60, Math.trunc(params.maxYears ?? 40)));
  const horizonMonths = horizonYears * 12;

  const safeEssential = Decimal.max(ZERO, params.monthlyEssentialBasis);
  const safePortfolio = Decimal.max(ZERO, params.currentInvestmentPortfolio);
  const safeContribution = Decimal.max(ZERO, params.monthlyContribution);
  const safeSwrPct = params.swrRatePct.gt(ZERO) ? params.swrRatePct : ZERO;
  const safeInflationPct = Decimal.max(ZERO, params.inflationRatePct);
  const safeReturnPct = Decimal.max(ZERO, params.expectedReturnRatePct);

  const annualEssential = safeEssential.times(TWELVE);
  const level5Target = annualEssential;
  const fireNumber =
    safeEssential.gt(ZERO) && safeSwrPct.gt(ZERO) ? annualEssential.div(safeSwrPct.div(HUNDRED)) : ZERO;
  const abundantNumber = fireNumber.times(2);

  // Fisher equation: r_real = ((1 + r_nom) / (1 + r_inf)) - 1
  const onePlusReturn = new Decimal(1).plus(safeReturnPct.div(HUNDRED));
  const onePlusInflation = new Decimal(1).plus(safeInflationPct.div(HUNDRED));
  const realReturnDecimal = onePlusInflation.gt(ZERO)
    ? onePlusReturn.div(onePlusInflation).minus(1)
    : ZERO;
  const realReturnRatePct = realReturnDecimal.times(HUNDRED);
  const monthlyRealRate = realReturnDecimal.div(TWELVE);

  const targetsValid = safeEssential.gt(ZERO) && safeSwrPct.gt(ZERO);

  let l5ReachedMonth: number | null = targetsValid && safePortfolio.gte(level5Target) ? 0 : null;
  let l6ReachedMonth: number | null = targetsValid && safePortfolio.gte(fireNumber) ? 0 : null;
  let l7ReachedMonth: number | null = targetsValid && safePortfolio.gte(abundantNumber) ? 0 : null;

  const level5TargetStr = toMoneyString(level5Target);
  const fireNumberStr = toMoneyString(fireNumber);
  const abundantNumberStr = toMoneyString(abundantNumber);

  const allYearlyPoints: FireYearlyProjectionPoint[] = [
    {
      year: 0,
      calendarYear: startCalendarYear,
      projectedPortfolio: toMoneyString(safePortfolio),
      totalContributed: toMoneyString(safePortfolio),
      investmentGrowth: '0.00',
      level5Target: level5TargetStr,
      fireNumber: fireNumberStr,
      abundantNumber: abundantNumberStr,
    },
  ];

  let runningPortfolio = safePortfolio;
  let runningContributed = safePortfolio;

  for (let month = 1; month <= horizonMonths; month += 1) {
    runningPortfolio = Decimal.max(
      ZERO,
      runningPortfolio.times(new Decimal(1).plus(monthlyRealRate)).plus(safeContribution),
    );
    runningContributed = runningContributed.plus(safeContribution);

    if (targetsValid) {
      if (l5ReachedMonth === null && runningPortfolio.gte(level5Target)) {
        l5ReachedMonth = month;
      }
      if (l6ReachedMonth === null && runningPortfolio.gte(fireNumber)) {
        l6ReachedMonth = month;
      }
      if (l7ReachedMonth === null && runningPortfolio.gte(abundantNumber)) {
        l7ReachedMonth = month;
      }
    }

    if (month % 12 === 0) {
      const yearNum = month / 12;
      const growth = runningPortfolio.minus(runningContributed);
      allYearlyPoints.push({
        year: yearNum,
        calendarYear: startCalendarYear + yearNum,
        projectedPortfolio: toMoneyString(runningPortfolio),
        totalContributed: toMoneyString(runningContributed),
        investmentGrowth: toMoneyString(growth),
        level5Target: level5TargetStr,
        fireNumber: fireNumberStr,
        abundantNumber: abundantNumberStr,
      });
    }
  }

  const buildMilestoneCountdown = (target: Decimal, reachedMonth: number | null): FireMilestoneCountdown => {
    const progress = target.gt(ZERO) ? progressTowardTarget(safePortfolio, target) : ZERO;
    if (!targetsValid || target.lte(ZERO)) {
      return {
        targetAmount: toMoneyString(target),
        progressPct: '0.00',
        alreadyReached: false,
        isReachableWithinHorizon: false,
        monthsToTarget: null,
        years: null,
        remainingMonths: null,
        targetDate: null,
      };
    }
    if (reachedMonth === 0) {
      return {
        targetAmount: toMoneyString(target),
        progressPct: '100.00',
        alreadyReached: true,
        isReachableWithinHorizon: true,
        monthsToTarget: 0,
        years: 0,
        remainingMonths: 0,
        targetDate: addMonthsToWibYearMonth(startDate, 0),
      };
    }
    if (reachedMonth !== null) {
      return {
        targetAmount: toMoneyString(target),
        progressPct: toMoneyString(progress),
        alreadyReached: false,
        isReachableWithinHorizon: true,
        monthsToTarget: reachedMonth,
        years: Math.floor(reachedMonth / 12),
        remainingMonths: reachedMonth % 12,
        targetDate: addMonthsToWibYearMonth(startDate, reachedMonth),
      };
    }
    return {
      targetAmount: toMoneyString(target),
      progressPct: toMoneyString(progress),
      alreadyReached: false,
      isReachableWithinHorizon: false,
      monthsToTarget: null,
      years: null,
      remainingMonths: null,
      targetDate: null,
    };
  };

  const fireYears = l6ReachedMonth !== null ? Math.ceil(l6ReachedMonth / 12) : horizonYears;
  const chartCapYears = Math.min(horizonYears, Math.max(10, fireYears + 5));
  const yearlyProjection = allYearlyPoints.slice(0, chartCapYears + 1);

  return {
    annualEssential: toMoneyString(annualEssential),
    level5Target: level5TargetStr,
    fireNumber: fireNumberStr,
    abundantNumber: abundantNumberStr,
    swrRatePct: toMoneyString(safeSwrPct),
    nominalReturnRatePct: toMoneyString(safeReturnPct),
    inflationRatePct: toMoneyString(safeInflationPct),
    realReturnRatePct: toMoneyString(realReturnRatePct),
    milestones: {
      level5: buildMilestoneCountdown(level5Target, l5ReachedMonth),
      level6Fire: buildMilestoneCountdown(fireNumber, l6ReachedMonth),
      level7Abundant: buildMilestoneCountdown(abundantNumber, l7ReachedMonth),
    },
    yearlyProjection,
  };
}
