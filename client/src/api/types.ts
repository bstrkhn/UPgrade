export interface ApiSuccessEnvelope<T, M = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta: M;
}

export interface ApiErrorIssue {
  field: string;
  message: string;
}

export interface ApiErrorEnvelope {
  success: false;
  message: string;
  data: null;
  meta: {
    errors?: ApiErrorIssue[];
    details?: unknown;
  };
}

export type AccountType = 'CASH' | 'BANK' | 'EWALLET' | 'INVESTMENT' | 'EMERGENCY_FUND';
export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'DEBT_PAYMENT';
export type ExpenseClass = 'ESSENTIAL' | 'DISCRETIONARY';
export type CategoryKind = 'INCOME' | 'ESSENTIAL' | 'DISCRETIONARY';
export type InterestType = 'FLAT' | 'EFFECTIVE';
export type BudgetFramework = 'ZERO_BASED' | 'RULE_50_30_20';
export type HealthStatus = 'NORMAL' | 'RECOVERY_MODE';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  onboardingCompleted: boolean;
  baselineEssential: string;
  budgetFramework: BudgetFramework;
  swrRate: string;
  inflationRate: string;
  expectedReturnRate: string;
  currentLevel: number;
  highestLevel: number;
  healthStatus: HealthStatus;
  createdAt: string;
}

export interface PublicAccount {
  id: string;
  name: string;
  type: AccountType;
  balance: string;
  isLiquid: boolean;
  createdAt: string;
}

export interface PublicCategory {
  id: string;
  name: string;
  kind: CategoryKind;
  expenseClass: ExpenseClass | null;
  isSystem: boolean;
}

export interface PublicDebt {
  id: string;
  name: string;
  isConsumptive: boolean;
  totalPrincipal: string;
  remainingBalance: string;
  annualInterestPct: string;
  interestType: InterestType;
  minimumMonthlyPay: string;
  dueDateDay: number | null;
  isPaidOff: boolean;
}

export interface PublicTransaction {
  id: string;
  type: TransactionType;
  amount: string;
  transactionDate: string;
  note: string | null;
  sourceAccount: { id: string; name: string };
  destinationAccount: { id: string; name: string } | null;
  category: { id: string; name: string; expenseClass: ExpenseClass | null } | null;
  debt: { id: string; name: string } | null;
  principalPaid: string | null;
  interestPaid: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export interface InitialLevelSummary {
  level: number;
  title: string;
  description: string;
  dataSource: 'ONBOARDING_BASELINE';
  badge: 'Estimasi Awal';
  totalAssets: string;
  totalLiabilities: string;
  netWorth: string;
  baselineEssential: string;
}

export interface OnboardingResult {
  user: PublicUser;
  accounts: PublicAccount[];
  debts: PublicDebt[];
  summary: InitialLevelSummary;
}

export interface DashboardSummaryResult {
  period: {
    year: number;
    month: number;
  };
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
  categoryMonthlySpent: Array<{
    categoryId: string;
    spent: string;
  }>;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface UpdatePreferencesPayload {
  name?: string;
  budgetFramework?: BudgetFramework;
  swrRate?: string;
  inflationRate?: string;
  expectedReturnRate?: string;
  baselineEssential?: string;
}

export interface OnboardingAccountInput {
  name: string;
  type: AccountType;
  balance: string;
  isLiquid?: boolean;
}

export interface OnboardingDebtInput {
  name: string;
  isConsumptive: boolean;
  totalPrincipal: string;
  remainingBalance?: string;
  annualInterestPct: string;
  interestType: InterestType;
  minimumMonthlyPay: string;
  dueDateDay?: number;
}

export interface OnboardingPayload {
  baselineEssential: string;
  budgetFramework: BudgetFramework;
  accounts: OnboardingAccountInput[];
  debts: OnboardingDebtInput[];
}

export interface CreateAccountPayload {
  name: string;
  type: AccountType;
  balance?: string;
  isLiquid?: boolean;
}

export interface UpdateAccountPayload {
  name?: string;
  type?: AccountType;
  isLiquid?: boolean;
}

export interface CreateCategoryPayload {
  name: string;
  kind: CategoryKind;
}

export interface TransactionBasePayload {
  amount: string;
  transactionDate?: string;
  note?: string;
  sourceAccountId: string;
}

export type CreateTransactionPayload =
  | (TransactionBasePayload & {
      type: 'INCOME';
      categoryId?: string;
    })
  | (TransactionBasePayload & {
      type: 'EXPENSE';
      categoryId: string;
    })
  | (TransactionBasePayload & {
      type: 'TRANSFER';
      destinationAccountId: string;
    })
  | (TransactionBasePayload & {
      type: 'DEBT_PAYMENT';
      debtId: string;
      principalPaid?: string;
      interestPaid?: string;
    });

export interface ListTransactionsFilter {
  type?: TransactionType;
  accountId?: string;
  categoryId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface TransactionPaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface TransactionMutationData {
  transaction: PublicTransaction;
  accounts: PublicAccount[];
  debt: PublicDebt | null;
}

export interface TransactionMutationMeta {
  warnings: string[];
}
