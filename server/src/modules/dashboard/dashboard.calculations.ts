import { Decimal } from 'decimal.js';
import type { ExpenseClass, TransactionType } from '@prisma/client';
import { ZERO, toMoneyString } from '../../utils/money.js';

const WIB_OFFSET_HOURS = 7;
const HOUR_MS = 60 * 60 * 1000;

export interface MonthPeriod {
  year: number;
  month: number;
}

export interface MonthRange {
  start: Date;
  nextMonthStart: Date;
}

/** Anything with a decimal string form (Prisma Decimal, decimal.js Decimal, string). */
type DecimalLike = { toString(): string };

export interface SummaryAccount {
  balance: DecimalLike;
}

export interface SummaryDebt {
  remainingBalance: DecimalLike;
}

export interface SummaryTransaction {
  type: TransactionType;
  amount: DecimalLike;
  categoryId: string | null;
  category: { expenseClass: ExpenseClass | null } | null;
}

export interface DashboardSummaryInput {
  accounts: SummaryAccount[];
  activeDebts: SummaryDebt[];
  transactions: SummaryTransaction[];
}

export interface DashboardSummary {
  cashFlow: {
    totalIncome: string;
    totalExpense: string;
    essentialExpense: string;
    discretionaryExpense: string;
    debtPaymentTotal: string;
    surplus: string;
    savingRatePct: string;
  };
  netWorth: {
    totalAssets: string;
    totalLiabilities: string;
    netWorth: string;
  };
  categoryMonthlySpent: Array<{ categoryId: string; spent: string }>;
}

/** Current calendar year/month in WIB (+07:00). */
export function getCurrentWibPeriod(now: Date = new Date()): MonthPeriod {
  const shifted = new Date(now.getTime() + WIB_OFFSET_HOURS * HOUR_MS);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1 };
}

function wibMonthStart(year: number, month: number): Date {
  const paddedMonth = String(month).padStart(2, '0');
  return new Date(`${year}-${paddedMonth}-01T00:00:00.000+07:00`);
}

/** Half-open WIB interval [start, nextMonthStart) for the given month. */
export function getWibMonthRange(year: number, month: number): MonthRange {
  const start = wibMonthStart(year, month);
  const nextMonthStart = month === 12 ? wibMonthStart(year + 1, 1) : wibMonthStart(year, month + 1);
  return { start, nextMonthStart };
}

function sum(values: Iterable<DecimalLike>): Decimal {
  let total = ZERO;
  for (const value of values) {
    total = total.plus(new Decimal(value.toString()));
  }
  return total;
}

/**
 * Pure dashboard calculation using decimal.js only.
 * TRANSFER transactions are excluded entirely from Cash Flow and Saving Rate.
 */
export function calculateDashboardSummary(input: DashboardSummaryInput): DashboardSummary {
  const incomes = input.transactions.filter((transaction) => transaction.type === 'INCOME');
  const expenses = input.transactions.filter((transaction) => transaction.type === 'EXPENSE');
  const debtPayments = input.transactions.filter((transaction) => transaction.type === 'DEBT_PAYMENT');

  const totalIncome = sum(incomes.map((transaction) => transaction.amount));
  const totalExpense = sum(expenses.map((transaction) => transaction.amount));
  const essentialExpense = sum(
    expenses
      .filter((transaction) => transaction.category?.expenseClass === 'ESSENTIAL')
      .map((transaction) => transaction.amount),
  );
  const discretionaryExpense = sum(
    expenses
      .filter((transaction) => transaction.category?.expenseClass === 'DISCRETIONARY')
      .map((transaction) => transaction.amount),
  );
  const debtPaymentTotal = sum(debtPayments.map((transaction) => transaction.amount));

  const surplus = totalIncome.minus(totalExpense);
  const savingRatePct = totalIncome.isZero() ? ZERO : surplus.div(totalIncome).times(100);

  const totalAssets = sum(input.accounts.map((account) => account.balance));
  const totalLiabilities = sum(input.activeDebts.map((debt) => debt.remainingBalance));
  const netWorth = totalAssets.minus(totalLiabilities);

  const spentByCategory = new Map<string, Decimal>();
  for (const expense of expenses) {
    if (expense.categoryId === null) continue;
    const previous = spentByCategory.get(expense.categoryId) ?? ZERO;
    spentByCategory.set(expense.categoryId, previous.plus(new Decimal(expense.amount.toString())));
  }
  const categoryMonthlySpent = [...spentByCategory.entries()]
    .sort(([idA, spentA], [idB, spentB]) => spentB.comparedTo(spentA) || idA.localeCompare(idB))
    .map(([categoryId, spent]) => ({ categoryId, spent: toMoneyString(spent) }));

  return {
    cashFlow: {
      totalIncome: toMoneyString(totalIncome),
      totalExpense: toMoneyString(totalExpense),
      essentialExpense: toMoneyString(essentialExpense),
      discretionaryExpense: toMoneyString(discretionaryExpense),
      debtPaymentTotal: toMoneyString(debtPaymentTotal),
      surplus: toMoneyString(surplus),
      savingRatePct: toMoneyString(savingRatePct),
    },
    netWorth: {
      totalAssets: toMoneyString(totalAssets),
      totalLiabilities: toMoneyString(totalLiabilities),
      netWorth: toMoneyString(netWorth),
    },
    categoryMonthlySpent,
  };
}
