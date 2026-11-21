import { Decimal } from 'decimal.js';
import type { BudgetFramework, ExpenseClass, TransactionType } from '@prisma/client';
import { ZERO, toMoneyString } from '../../utils/money.js';

type DecimalLike = { toString(): string };

export type ZeroBasedStatus = 'BALANCED' | 'UNDER_ALLOCATED' | 'OVER_ALLOCATED' | 'NO_INCOME';

export interface BudgetExpenseCategoryInput {
  id: string;
  name: string;
  expenseClass: ExpenseClass;
}

export interface BudgetAllocationInput {
  categoryId: string;
  allocated: DecimalLike;
}

export interface BudgetTransactionInput {
  type: TransactionType;
  amount: DecimalLike;
  categoryId: string | null;
}

export interface CalculateBudgetOverviewInput {
  period: { year: number; month: number };
  budgetFramework: BudgetFramework;
  expenseCategories: BudgetExpenseCategoryInput[];
  budgets: BudgetAllocationInput[];
  transactions: BudgetTransactionInput[];
}

export interface BudgetCategoryRow {
  categoryId: string;
  categoryName: string;
  expenseClass: ExpenseClass;
  allocated: string;
  spent: string;
  remaining: string;
  utilizationPct: string;
  isOverBudget: boolean;
}

export interface ZeroBasedSummary {
  totalIncome: string;
  totalAllocated: string;
  unallocated: string;
  status: ZeroBasedStatus;
}

export interface Rule503020Bucket {
  targetPct: string;
  targetAmount: string;
  allocated: string;
  spent: string;
  actualPctOfIncome: string;
}

export interface Rule503020SavingsBucket {
  targetPct: string;
  targetAmount: string;
  actualSavings: string;
  debtPaymentTotal: string;
  actualPctOfIncome: string;
}

export interface BudgetOverviewResult {
  period: { year: number; month: number };
  budgetFramework: BudgetFramework;
  cashFlow: {
    totalIncome: string;
    totalExpense: string;
    debtPaymentTotal: string;
    surplus: string;
  };
  zeroBased: ZeroBasedSummary;
  rule503020: {
    needs: Rule503020Bucket;
    wants: Rule503020Bucket;
    savings: Rule503020SavingsBucket;
  };
  categories: BudgetCategoryRow[];
}

const HUNDRED = new Decimal(100);
const HALF = new Decimal('0.50');
const THIRTY_PCT = new Decimal('0.30');
const TWENTY_PCT = new Decimal('0.20');

export function calculateBudgetOverview(input: CalculateBudgetOverviewInput): BudgetOverviewResult {
  let totalIncome = ZERO;
  let totalExpense = ZERO;
  let debtPaymentTotal = ZERO;
  const spentByCategory = new Map<string, Decimal>();

  for (const tx of input.transactions) {
    const amount = new Decimal(tx.amount.toString());
    if (tx.type === 'INCOME') {
      totalIncome = totalIncome.plus(amount);
    } else if (tx.type === 'EXPENSE') {
      totalExpense = totalExpense.plus(amount);
      if (tx.categoryId !== null) {
        const prev = spentByCategory.get(tx.categoryId) ?? ZERO;
        spentByCategory.set(tx.categoryId, prev.plus(amount));
      }
    } else if (tx.type === 'DEBT_PAYMENT') {
      debtPaymentTotal = debtPaymentTotal.plus(amount);
    }
  }

  const surplus = totalIncome.minus(totalExpense);

  const allocatedByCategory = new Map<string, Decimal>();
  for (const budget of input.budgets) {
    allocatedByCategory.set(budget.categoryId, new Decimal(budget.allocated.toString()));
  }

  const sortedCategories = [...input.expenseCategories].sort((a, b) => {
    if (a.expenseClass !== b.expenseClass) {
      return a.expenseClass === 'ESSENTIAL' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  let totalAllocated = ZERO;
  let essentialAllocated = ZERO;
  let essentialSpent = ZERO;
  let discretionaryAllocated = ZERO;
  let discretionarySpent = ZERO;

  const categories: BudgetCategoryRow[] = sortedCategories.map((category) => {
    const allocated = allocatedByCategory.get(category.id) ?? ZERO;
    const spent = spentByCategory.get(category.id) ?? ZERO;
    const remaining = allocated.minus(spent);

    totalAllocated = totalAllocated.plus(allocated);
    if (category.expenseClass === 'ESSENTIAL') {
      essentialAllocated = essentialAllocated.plus(allocated);
      essentialSpent = essentialSpent.plus(spent);
    } else {
      discretionaryAllocated = discretionaryAllocated.plus(allocated);
      discretionarySpent = discretionarySpent.plus(spent);
    }

    const utilizationPct = allocated.gt(ZERO) ? spent.div(allocated).times(HUNDRED) : ZERO;

    const isOverBudget = allocated.gt(ZERO) && spent.gt(allocated);

    return {
      categoryId: category.id,
      categoryName: category.name,
      expenseClass: category.expenseClass,
      allocated: toMoneyString(allocated),
      spent: toMoneyString(spent),
      remaining: toMoneyString(remaining),
      utilizationPct: toMoneyString(utilizationPct),
      isOverBudget,
    };
  });

  const unallocated = totalIncome.minus(totalAllocated);
  let zeroBasedStatus: ZeroBasedStatus;
  if (totalIncome.eq(ZERO) && totalAllocated.eq(ZERO)) {
    zeroBasedStatus = 'NO_INCOME';
  } else if (unallocated.eq(ZERO)) {
    zeroBasedStatus = 'BALANCED';
  } else if (unallocated.gt(ZERO)) {
    zeroBasedStatus = 'UNDER_ALLOCATED';
  } else {
    zeroBasedStatus = 'OVER_ALLOCATED';
  }

  const needsActualPct = totalIncome.gt(ZERO) ? essentialSpent.div(totalIncome).times(HUNDRED) : ZERO;
  const wantsActualPct = totalIncome.gt(ZERO) ? discretionarySpent.div(totalIncome).times(HUNDRED) : ZERO;
  const savingsActualPct = totalIncome.gt(ZERO) ? surplus.div(totalIncome).times(HUNDRED) : ZERO;

  return {
    period: input.period,
    budgetFramework: input.budgetFramework,
    cashFlow: {
      totalIncome: toMoneyString(totalIncome),
      totalExpense: toMoneyString(totalExpense),
      debtPaymentTotal: toMoneyString(debtPaymentTotal),
      surplus: toMoneyString(surplus),
    },
    zeroBased: {
      totalIncome: toMoneyString(totalIncome),
      totalAllocated: toMoneyString(totalAllocated),
      unallocated: toMoneyString(unallocated),
      status: zeroBasedStatus,
    },
    rule503020: {
      needs: {
        targetPct: '50.00',
        targetAmount: toMoneyString(totalIncome.times(HALF)),
        allocated: toMoneyString(essentialAllocated),
        spent: toMoneyString(essentialSpent),
        actualPctOfIncome: toMoneyString(needsActualPct),
      },
      wants: {
        targetPct: '30.00',
        targetAmount: toMoneyString(totalIncome.times(THIRTY_PCT)),
        allocated: toMoneyString(discretionaryAllocated),
        spent: toMoneyString(discretionarySpent),
        actualPctOfIncome: toMoneyString(wantsActualPct),
      },
      savings: {
        targetPct: '20.00',
        targetAmount: toMoneyString(totalIncome.times(TWENTY_PCT)),
        actualSavings: toMoneyString(surplus),
        debtPaymentTotal: toMoneyString(debtPaymentTotal),
        actualPctOfIncome: toMoneyString(savingsActualPct),
      },
    },
    categories,
  };
}
