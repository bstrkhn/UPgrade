import { prisma } from '../../config/prisma.js';
import {
  calculateDashboardSummary,
  getCurrentWibPeriod,
  getWibMonthRange,
  type DashboardSummary,
  type MonthPeriod,
} from './dashboard.calculations.js';
import type { DashboardSummaryQuery } from './dashboard.schemas.js';

export interface DashboardSummaryResult extends DashboardSummary {
  period: MonthPeriod;
}

export async function getDashboardSummary(
  userId: string,
  query: DashboardSummaryQuery,
): Promise<DashboardSummaryResult> {
  const current = getCurrentWibPeriod();
  const period: MonthPeriod = {
    year: query.year ?? current.year,
    month: query.month ?? current.month,
  };
  const { start, nextMonthStart } = getWibMonthRange(period.year, period.month);

  const [accounts, activeDebts, transactions] = await Promise.all([
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

  return { period, ...calculateDashboardSummary({ accounts, activeDebts, transactions }) };
}
