import { Decimal } from 'decimal.js';
import type { AccountType, BudgetFramework, NetWorthSnapshot } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/AppError.js';
import {
  calculateEmergencyFundTarget,
  calculateFireProjection,
  detectLatteFactors,
  evaluateMilestoneLevel,
  type EmergencyFundBadge,
  type EmergencyFundDataSource,
  type EmergencyFundResult,
  type FireProjectionResult,
  type LatteFactorResult,
  type MilestoneEvaluationResult,
} from '../../utils/financialMath.js';
import { ZERO, toMoneyString } from '../../utils/money.js';
import {
  calculateDashboardSummary,
  getCurrentWibPeriod,
  getWibMonthRange,
  type DashboardSummary,
  type MonthPeriod,
} from '../dashboard/dashboard.calculations.js';
import type {
  AnalyticsDashboardQuery,
  CreateSnapshotBody,
  FireSimulationBody,
} from './analytics.schemas.js';

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface BudgetHealthCategoryItem {
  categoryId: string;
  allocated: string;
  spent: string;
  remaining: string;
}

export interface BudgetHealthSummary {
  budgetFramework: BudgetFramework;
  totalAllocated: string;
  totalSpentInBudgetedCategories: string;
  overBudgetCategoriesCount: number;
  categories: BudgetHealthCategoryItem[];
}

export interface AnalyticsDashboardResult extends DashboardSummary {
  period: MonthPeriod;
  isCurrentPeriod: boolean;
  emergencyFund: EmergencyFundResult;
  latteFactor: LatteFactorResult;
  milestone: MilestoneEvaluationResult;
  budgetHealth: BudgetHealthSummary;
}

function shiftPeriodMonths(period: MonthPeriod, deltaMonths: number): MonthPeriod {
  const index = period.year * 12 + (period.month - 1) + deltaMonths;
  return {
    year: Math.floor(index / 12),
    month: (index % 12) + 1,
  };
}

function toWibYearMonthKey(date: Date): string {
  const shifted = new Date(date.getTime() + WIB_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export async function getAnalyticsDashboard(
  userId: string,
  query: AnalyticsDashboardQuery,
): Promise<AnalyticsDashboardResult> {
  const currentPeriod = getCurrentWibPeriod();
  const period: MonthPeriod = {
    year: query.year ?? currentPeriod.year,
    month: query.month ?? currentPeriod.month,
  };

  const isCurrentPeriod = period.year === currentPeriod.year && period.month === currentPeriod.month;
  const { start: monthStart, nextMonthStart } = getWibMonthRange(period.year, period.month);

  const fiveMonthsBefore = shiftPeriodMonths(period, -5);
  const { start: sixMonthStart } = getWibMonthRange(fiveMonthsBefore.year, fiveMonthsBefore.month);

  const latteEnd = isCurrentPeriod ? new Date() : nextMonthStart;
  const latteStart = new Date(latteEnd.getTime() - THIRTY_DAYS_MS);

  const [
    user,
    accounts,
    activeDebts,
    periodTransactions,
    historicalEssentialTx,
    latteCandidateTx,
    periodBudgets,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        baselineEssential: true,
        budgetFramework: true,
        swrRate: true,
        inflationRate: true,
        expectedReturnRate: true,
        currentLevel: true,
        highestLevel: true,
        healthStatus: true,
      },
    }),
    prisma.account.findMany({
      where: { userId },
      select: { id: true, type: true, balance: true },
    }),
    prisma.debt.findMany({
      where: { userId, isPaidOff: false },
      select: { remainingBalance: true, isConsumptive: true },
    }),
    prisma.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        transactionDate: { gte: monthStart, lt: nextMonthStart },
      },
      select: {
        type: true,
        amount: true,
        categoryId: true,
        category: { select: { expenseClass: true } },
      },
    }),
    prisma.transaction.findMany({
      where: {
        userId,
        type: 'EXPENSE',
        deletedAt: null,
        transactionDate: { gte: sixMonthStart, lt: nextMonthStart },
        category: { expenseClass: 'ESSENTIAL' },
      },
      select: {
        amount: true,
        transactionDate: true,
      },
    }),
    prisma.transaction.findMany({
      where: {
        userId,
        type: 'EXPENSE',
        deletedAt: null,
        transactionDate: { gte: latteStart, lt: latteEnd },
        category: { expenseClass: 'DISCRETIONARY' },
      },
      select: {
        amount: true,
        categoryId: true,
        category: { select: { name: true, expenseClass: true } },
      },
    }),
    prisma.budget.findMany({
      where: {
        userId,
        year: period.year,
        month: period.month,
      },
      select: {
        categoryId: true,
        allocated: true,
      },
    }),
  ]);

  if (!user) {
    throw AppError.unauthorized('Akun tidak ditemukan. Silakan masuk kembali.');
  }

  const summary = calculateDashboardSummary({
    accounts,
    activeDebts,
    transactions: periodTransactions,
  });

  const emergencyFundBalance = accounts
    .filter((acc) => acc.type === 'EMERGENCY_FUND')
    .reduce((sum, acc) => sum.plus(new Decimal(acc.balance.toString())), ZERO);

  const investmentPortfolio = accounts
    .filter((acc) => acc.type === 'INVESTMENT')
    .reduce((sum, acc) => sum.plus(new Decimal(acc.balance.toString())), ZERO);

  const consumptiveDebtBalance = activeDebts
    .filter((debt) => debt.isConsumptive)
    .reduce((sum, debt) => sum.plus(new Decimal(debt.remainingBalance.toString())), ZERO);

  // Aggregate distinct historical monthly essential totals (up to 6 months)
  const essentialByMonth = new Map<string, Decimal>();
  for (const tx of historicalEssentialTx) {
    const monthKey = toWibYearMonthKey(tx.transactionDate);
    const prev = essentialByMonth.get(monthKey) ?? ZERO;
    essentialByMonth.set(monthKey, prev.plus(new Decimal(tx.amount.toString())));
  }
  const historicalMonthlyEssentials = [...essentialByMonth.values()];

  const baselineEssential = new Decimal(user.baselineEssential.toString());
  const initialEf = calculateEmergencyFundTarget({
    historicalMonthlyEssentials,
    baselineEssential,
    emergencyFundBalance,
    currentLevel: user.currentLevel,
  });

  const monthlyEssentialBasis = new Decimal(initialEf.monthlyBasis);
  const monthlySurplus = new Decimal(summary.cashFlow.surplus);
  const monthlyIncome = new Decimal(summary.cashFlow.totalIncome);
  const swrRatePct = new Decimal(user.swrRate.toString());
  const expectedReturnRatePct = new Decimal(user.expectedReturnRate.toString());

  const milestone = evaluateMilestoneLevel({
    previousHighestLevel: user.highestLevel,
    monthlySurplus,
    hasPeriodTransactions: periodTransactions.length > 0,
    consumptiveDebtBalance,
    emergencyFundBalance,
    monthlyEssentialBasis,
    investmentPortfolio,
    swrRatePct,
  });

  const emergencyFund =
    milestone.currentLevel === user.currentLevel
      ? initialEf
      : calculateEmergencyFundTarget({
          historicalMonthlyEssentials,
          baselineEssential,
          emergencyFundBalance,
          currentLevel: milestone.currentLevel,
        });

  const latteFactor = detectLatteFactors({
    transactions: latteCandidateTx
      .filter((tx): tx is typeof tx & { categoryId: string; category: { name: string; expenseClass: 'DISCRETIONARY' } } =>
        tx.categoryId !== null && tx.category !== null && tx.category.expenseClass === 'DISCRETIONARY',
      )
      .map((tx) => ({
        categoryId: tx.categoryId,
        categoryName: tx.category.name,
        expenseClass: tx.category.expenseClass,
        amount: new Decimal(tx.amount.toString()),
      })),
    monthlyIncome,
    expectedReturnRatePct,
  });

  // Budget Health Summary
  const spentMap = new Map<string, Decimal>();
  for (const item of summary.categoryMonthlySpent) {
    spentMap.set(item.categoryId, new Decimal(item.spent));
  }

  let totalAllocated = ZERO;
  let totalSpentInBudgetedCategories = ZERO;
  let overBudgetCategoriesCount = 0;

  const budgetCategories: BudgetHealthCategoryItem[] = periodBudgets.map((budget) => {
    const allocated = new Decimal(budget.allocated.toString());
    const spent = spentMap.get(budget.categoryId) ?? ZERO;
    const remaining = allocated.minus(spent);

    totalAllocated = totalAllocated.plus(allocated);
    totalSpentInBudgetedCategories = totalSpentInBudgetedCategories.plus(spent);
    if (allocated.gt(ZERO) && spent.gt(allocated)) {
      overBudgetCategoriesCount += 1;
    }

    return {
      categoryId: budget.categoryId,
      allocated: toMoneyString(allocated),
      spent: toMoneyString(spent),
      remaining: toMoneyString(remaining),
    };
  });

  // Persist level/healthStatus to User ONLY when viewing the current active period
  if (
    isCurrentPeriod &&
    (milestone.currentLevel !== user.currentLevel ||
      milestone.highestLevel !== user.highestLevel ||
      milestone.healthStatus !== user.healthStatus)
  ) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        currentLevel: milestone.currentLevel,
        highestLevel: milestone.highestLevel,
        healthStatus: milestone.healthStatus,
      },
    });
  }

  return {
    period,
    isCurrentPeriod,
    ...summary,
    emergencyFund,
    latteFactor,
    milestone,
    budgetHealth: {
      budgetFramework: user.budgetFramework,
      totalAllocated: toMoneyString(totalAllocated),
      totalSpentInBudgetedCategories: toMoneyString(totalSpentInBudgetedCategories),
      overBudgetCategoriesCount,
      categories: budgetCategories,
    },
  };
}

export interface FireSimulationServiceResult {
  inputsUsed: {
    monthlyEssentialBasis: string;
    currentInvestmentPortfolio: string;
    monthlyContribution: string;
    swrRatePct: string;
    inflationRatePct: string;
    expectedReturnRatePct: string;
    maxYears: number;
  };
  dataSource: EmergencyFundDataSource;
  dataSourceBadge: EmergencyFundBadge;
  historyMonthsCount: number;
  projection: FireProjectionResult;
}

export async function simulateUserFire(
  userId: string,
  input: FireSimulationBody,
): Promise<FireSimulationServiceResult> {
  const currentPeriod = getCurrentWibPeriod();
  const { start: monthStart, nextMonthStart } = getWibMonthRange(currentPeriod.year, currentPeriod.month);
  const fiveMonthsBefore = shiftPeriodMonths(currentPeriod, -5);
  const { start: sixMonthStart } = getWibMonthRange(fiveMonthsBefore.year, fiveMonthsBefore.month);

  const [user, accounts, periodTransactions, historicalEssentialTx] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        baselineEssential: true,
        swrRate: true,
        inflationRate: true,
        expectedReturnRate: true,
        currentLevel: true,
      },
    }),
    prisma.account.findMany({
      where: { userId },
      select: { type: true, balance: true },
    }),
    prisma.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        transactionDate: { gte: monthStart, lt: nextMonthStart },
      },
      select: {
        type: true,
        amount: true,
        categoryId: true,
        category: { select: { expenseClass: true } },
      },
    }),
    prisma.transaction.findMany({
      where: {
        userId,
        type: 'EXPENSE',
        deletedAt: null,
        transactionDate: { gte: sixMonthStart, lt: nextMonthStart },
        category: { expenseClass: 'ESSENTIAL' },
      },
      select: {
        amount: true,
        transactionDate: true,
      },
    }),
  ]);

  if (!user) {
    throw AppError.unauthorized('Akun tidak ditemukan. Silakan masuk kembali.');
  }

  const essentialByMonth = new Map<string, Decimal>();
  for (const tx of historicalEssentialTx) {
    const monthKey = toWibYearMonthKey(tx.transactionDate);
    const prev = essentialByMonth.get(monthKey) ?? ZERO;
    essentialByMonth.set(monthKey, prev.plus(new Decimal(tx.amount.toString())));
  }

  const emergencyFundBalance = accounts
    .filter((acc) => acc.type === 'EMERGENCY_FUND')
    .reduce((sum, acc) => sum.plus(new Decimal(acc.balance.toString())), ZERO);

  const defaultInvestmentPortfolio = accounts
    .filter((acc) => acc.type === 'INVESTMENT')
    .reduce((sum, acc) => sum.plus(new Decimal(acc.balance.toString())), ZERO);

  const ef = calculateEmergencyFundTarget({
    historicalMonthlyEssentials: [...essentialByMonth.values()],
    baselineEssential: new Decimal(user.baselineEssential.toString()),
    emergencyFundBalance,
    currentLevel: user.currentLevel,
  });

  const summary = calculateDashboardSummary({
    accounts,
    activeDebts: [],
    transactions: periodTransactions,
  });

  const currentMonthSurplus = new Decimal(summary.cashFlow.surplus);
  const defaultMonthlyContribution = Decimal.max(ZERO, currentMonthSurplus);

  const monthlyEssentialBasis = input.monthlyEssentialBasis ?? new Decimal(ef.monthlyBasis);
  const currentInvestmentPortfolio = input.currentInvestmentPortfolio ?? defaultInvestmentPortfolio;
  const monthlyContribution = input.monthlyContribution ?? defaultMonthlyContribution;
  const swrRatePct = input.swrRatePct ?? new Decimal(user.swrRate.toString());
  const inflationRatePct = input.inflationRatePct ?? new Decimal(user.inflationRate.toString());
  const expectedReturnRatePct = input.expectedReturnRatePct ?? new Decimal(user.expectedReturnRate.toString());
  const maxYears = input.maxYears;

  const projection = calculateFireProjection({
    monthlyEssentialBasis,
    currentInvestmentPortfolio,
    monthlyContribution,
    swrRatePct,
    inflationRatePct,
    expectedReturnRatePct,
    maxYears,
  });

  return {
    inputsUsed: {
      monthlyEssentialBasis: toMoneyString(monthlyEssentialBasis),
      currentInvestmentPortfolio: toMoneyString(currentInvestmentPortfolio),
      monthlyContribution: toMoneyString(monthlyContribution),
      swrRatePct: toMoneyString(swrRatePct),
      inflationRatePct: toMoneyString(inflationRatePct),
      expectedReturnRatePct: toMoneyString(expectedReturnRatePct),
      maxYears,
    },
    dataSource: ef.dataSource,
    dataSourceBadge: ef.badge,
    historyMonthsCount: ef.historyMonthsCount,
    projection,
  };
}

export interface PublicNetWorthSnapshot {
  id: string;
  snapshotMonth: number;
  snapshotYear: number;
  totalAssets: string;
  totalLiabilities: string;
  netWorth: string;
  savingRatePct: string;
  createdAt: Date;
}

export function toPublicNetWorthSnapshot(snapshot: NetWorthSnapshot): PublicNetWorthSnapshot {
  return {
    id: snapshot.id,
    snapshotMonth: snapshot.snapshotMonth,
    snapshotYear: snapshot.snapshotYear,
    totalAssets: toMoneyString(snapshot.totalAssets),
    totalLiabilities: toMoneyString(snapshot.totalLiabilities),
    netWorth: toMoneyString(snapshot.netWorth),
    savingRatePct: toMoneyString(snapshot.savingRatePct),
    createdAt: snapshot.createdAt,
  };
}

export interface AssetsByTypeItem {
  type: AccountType;
  count: number;
  totalBalance: string;
}

export interface CurrentBalanceSheet {
  totalAssets: string;
  totalLiabilities: string;
  netWorth: string;
  liquidAssetsTotal: string;
  nonLiquidAssetsTotal: string;
  consumptiveDebtTotal: string;
  productiveDebtTotal: string;
  assetsByType: AssetsByTypeItem[];
}

export interface NetWorthSnapshotsResult {
  currentBalanceSheet: CurrentBalanceSheet;
  snapshots: PublicNetWorthSnapshot[];
}

const ALL_ACCOUNT_TYPES: readonly AccountType[] = [
  'CASH',
  'BANK',
  'EWALLET',
  'EMERGENCY_FUND',
  'INVESTMENT',
];

export async function listNetWorthSnapshots(userId: string): Promise<NetWorthSnapshotsResult> {
  const [accounts, activeDebts, snapshots] = await Promise.all([
    prisma.account.findMany({
      where: { userId },
      select: { type: true, balance: true, isLiquid: true },
    }),
    prisma.debt.findMany({
      where: { userId, isPaidOff: false },
      select: { remainingBalance: true, isConsumptive: true },
    }),
    prisma.netWorthSnapshot.findMany({
      where: { userId },
      orderBy: [{ snapshotYear: 'asc' }, { snapshotMonth: 'asc' }],
    }),
  ]);

  let totalAssets = ZERO;
  let liquidAssetsTotal = ZERO;
  let nonLiquidAssetsTotal = ZERO;

  const groupedByType = new Map<AccountType, { count: number; total: Decimal }>();
  for (const type of ALL_ACCOUNT_TYPES) {
    groupedByType.set(type, { count: 0, total: ZERO });
  }

  for (const acc of accounts) {
    const balance = new Decimal(acc.balance.toString());
    totalAssets = totalAssets.plus(balance);
    if (acc.isLiquid) {
      liquidAssetsTotal = liquidAssetsTotal.plus(balance);
    } else {
      nonLiquidAssetsTotal = nonLiquidAssetsTotal.plus(balance);
    }
    const bucket = groupedByType.get(acc.type);
    if (bucket) {
      bucket.count += 1;
      bucket.total = bucket.total.plus(balance);
    }
  }

  let consumptiveDebtTotal = ZERO;
  let productiveDebtTotal = ZERO;
  for (const debt of activeDebts) {
    const remaining = new Decimal(debt.remainingBalance.toString());
    if (debt.isConsumptive) {
      consumptiveDebtTotal = consumptiveDebtTotal.plus(remaining);
    } else {
      productiveDebtTotal = productiveDebtTotal.plus(remaining);
    }
  }

  const totalLiabilities = consumptiveDebtTotal.plus(productiveDebtTotal);
  const netWorth = totalAssets.minus(totalLiabilities);

  const assetsByType: AssetsByTypeItem[] = ALL_ACCOUNT_TYPES.map((type) => {
    const entry = groupedByType.get(type) ?? { count: 0, total: ZERO };
    return {
      type,
      count: entry.count,
      totalBalance: toMoneyString(entry.total),
    };
  });

  return {
    currentBalanceSheet: {
      totalAssets: toMoneyString(totalAssets),
      totalLiabilities: toMoneyString(totalLiabilities),
      netWorth: toMoneyString(netWorth),
      liquidAssetsTotal: toMoneyString(liquidAssetsTotal),
      nonLiquidAssetsTotal: toMoneyString(nonLiquidAssetsTotal),
      consumptiveDebtTotal: toMoneyString(consumptiveDebtTotal),
      productiveDebtTotal: toMoneyString(productiveDebtTotal),
      assetsByType,
    },
    snapshots: snapshots.map(toPublicNetWorthSnapshot),
  };
}

export async function upsertMonthlySnapshot(
  userId: string,
  input: CreateSnapshotBody,
): Promise<{ period: MonthPeriod; snapshot: PublicNetWorthSnapshot }> {
  const current = getCurrentWibPeriod();
  const period: MonthPeriod = {
    year: input.year ?? current.year,
    month: input.month ?? current.month,
  };
  const { start, nextMonthStart } = getWibMonthRange(period.year, period.month);

  const [accounts, activeDebts, periodTransactions] = await Promise.all([
    prisma.account.findMany({ where: { userId }, select: { balance: true } }),
    prisma.debt.findMany({ where: { userId, isPaidOff: false }, select: { remainingBalance: true } }),
    prisma.transaction.findMany({
      where: { userId, deletedAt: null, transactionDate: { gte: start, lt: nextMonthStart } },
      select: {
        type: true,
        amount: true,
        categoryId: true,
        category: { select: { expenseClass: true } },
      },
    }),
  ]);

  const summary = calculateDashboardSummary({
    accounts,
    activeDebts,
    transactions: periodTransactions,
  });

  const saved = await prisma.netWorthSnapshot.upsert({
    where: {
      userId_snapshotMonth_snapshotYear: {
        userId,
        snapshotMonth: period.month,
        snapshotYear: period.year,
      },
    },
    create: {
      userId,
      snapshotMonth: period.month,
      snapshotYear: period.year,
      totalAssets: summary.netWorth.totalAssets,
      totalLiabilities: summary.netWorth.totalLiabilities,
      netWorth: summary.netWorth.netWorth,
      savingRatePct: summary.cashFlow.savingRatePct,
    },
    update: {
      totalAssets: summary.netWorth.totalAssets,
      totalLiabilities: summary.netWorth.totalLiabilities,
      netWorth: summary.netWorth.netWorth,
      savingRatePct: summary.cashFlow.savingRatePct,
    },
  });

  return {
    period,
    snapshot: toPublicNetWorthSnapshot(saved),
  };
}
