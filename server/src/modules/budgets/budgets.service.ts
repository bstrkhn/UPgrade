import type { ExpenseClass } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { getWibMonthRange } from '../dashboard/dashboard.calculations.js';
import { calculateBudgetOverview, type BudgetOverviewResult } from './budgets.calculations.js';
import type { BudgetPeriodParams, UpsertBudgetsInput } from './budgets.schemas.js';

export async function getBudgetOverview(userId: string, period: BudgetPeriodParams): Promise<BudgetOverviewResult> {
  const { start, nextMonthStart } = getWibMonthRange(period.year, period.month);

  const [user, rawExpenseCategories, budgets, transactions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { budgetFramework: true },
    }),
    prisma.category.findMany({
      where: { userId, expenseClass: { not: null } },
      select: { id: true, name: true, expenseClass: true },
    }),
    prisma.budget.findMany({
      where: { userId, year: period.year, month: period.month },
      select: { categoryId: true, allocated: true },
    }),
    prisma.transaction.findMany({
      where: { userId, deletedAt: null, transactionDate: { gte: start, lt: nextMonthStart } },
      select: { type: true, amount: true, categoryId: true },
    }),
  ]);

  if (!user) {
    throw AppError.unauthorized('Akun tidak ditemukan. Silakan masuk kembali.');
  }

  const expenseCategories = rawExpenseCategories.filter(
    (category): category is { id: string; name: string; expenseClass: ExpenseClass } => category.expenseClass !== null,
  );

  return calculateBudgetOverview({
    period,
    budgetFramework: user.budgetFramework,
    expenseCategories,
    budgets,
    transactions,
  });
}

export async function upsertBudgets(
  userId: string,
  period: BudgetPeriodParams,
  input: UpsertBudgetsInput,
): Promise<BudgetOverviewResult> {
  const categoryIds = input.items.map((item) => item.categoryId);

  await prisma.$transaction(async (tx) => {
    const ownedCategories = await tx.category.findMany({
      where: { userId, id: { in: categoryIds } },
      select: { id: true, name: true, expenseClass: true },
    });

    if (ownedCategories.length !== categoryIds.length) {
      throw AppError.notFound('Satu atau lebih kategori tidak ditemukan.');
    }

    const incomeCategory = ownedCategories.find((category) => category.expenseClass === null);
    if (incomeCategory) {
      throw AppError.badRequest(
        `Kategori pemasukan "${incomeCategory.name}" tidak dapat diberi alokasi anggaran pengeluaran.`,
      );
    }

    for (const item of input.items) {
      const allocatedStr = item.allocated.toFixed(2);
      await tx.budget.upsert({
        where: {
          userId_categoryId_month_year: {
            userId,
            categoryId: item.categoryId,
            month: period.month,
            year: period.year,
          },
        },
        create: {
          userId,
          categoryId: item.categoryId,
          month: period.month,
          year: period.year,
          allocated: allocatedStr,
        },
        update: {
          allocated: allocatedStr,
        },
      });
    }
  });

  return getBudgetOverview(userId, period);
}
