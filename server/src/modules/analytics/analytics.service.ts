import { Decimal } from 'decimal.js';
import type { BudgetFramework } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/AppError.js';
import {
  calculateEmergencyFundTarget,
  detectLatteFactors,
  evaluateMilestoneLevel,
  type EmergencyFundResult,
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
import type { AnalyticsDashboardQuery } from './analytics.schemas.js';

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
