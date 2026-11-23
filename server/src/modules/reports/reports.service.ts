import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { toMoneyString } from '../../utils/money.js';
import {
  generateMonthlyReportPdf,
  type MonthlyPdfTopExpenseItem,
  type MonthlyPdfTransactionItem,
} from '../../utils/pdfGenerator.js';
import { getAnalyticsDashboard } from '../analytics/analytics.service.js';
import { getCurrentWibPeriod, getWibMonthRange, type MonthPeriod } from '../dashboard/dashboard.calculations.js';
import type { MonthlyReportQuery } from './reports.schemas.js';

export interface GeneratedMonthlyPdfResult {
  buffer: Buffer;
  filename: string;
  period: MonthPeriod;
}

export async function buildMonthlyReportPdf(
  userId: string,
  query: MonthlyReportQuery,
): Promise<GeneratedMonthlyPdfResult> {
  const current = getCurrentWibPeriod();
  const period: MonthPeriod = {
    year: query.year ?? current.year,
    month: query.month ?? current.month,
  };
  const { start, nextMonthStart } = getWibMonthRange(period.year, period.month);

  const [user, analytics, categories, rawTransactions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    }),
    getAnalyticsDashboard(userId, period),
    prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true, expenseClass: true },
    }),
    prisma.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        transactionDate: { gte: start, lt: nextMonthStart },
      },
      include: {
        category: { select: { name: true } },
        sourceAccount: { select: { name: true } },
        destinationAccount: { select: { name: true } },
        debt: { select: { name: true } },
      },
      orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
    }),
  ]);

  if (!user) {
    throw AppError.unauthorized('Akun tidak ditemukan. Silakan masuk kembali.');
  }

  const categoryMap = new Map(categories.map((cat) => [cat.id, cat]));

  const topExpenses: MonthlyPdfTopExpenseItem[] = analytics.categoryMonthlySpent
    .slice(0, 5)
    .map((item) => {
      const cat = categoryMap.get(item.categoryId);
      return {
        categoryName: cat?.name ?? 'Kategori Lainnya',
        expenseClass: cat?.expenseClass ?? null,
        spent: item.spent,
      };
    });

  const transactions: MonthlyPdfTransactionItem[] = rawTransactions.map((tx) => ({
    transactionDate: tx.transactionDate,
    type: tx.type,
    amount: toMoneyString(tx.amount),
    note: tx.note,
    categoryName: tx.category?.name ?? null,
    sourceAccountName: tx.sourceAccount.name,
    destinationAccountName: tx.destinationAccount?.name ?? null,
    debtName: tx.debt?.name ?? null,
  }));

  const buffer = await generateMonthlyReportPdf({
    user,
    period,
    cashFlow: analytics.cashFlow,
    netWorth: analytics.netWorth,
    emergencyFund: analytics.emergencyFund,
    latteFactor: analytics.latteFactor,
    milestone: analytics.milestone,
    topExpenses,
    transactions,
  });

  const paddedMonth = String(period.month).padStart(2, '0');
  const filename = `UPgrade-Laporan-${period.year}-${paddedMonth}.pdf`;

  return {
    buffer,
    filename,
    period,
  };
}
