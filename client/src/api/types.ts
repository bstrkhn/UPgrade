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

export type ZeroBasedStatus = 'BALANCED' | 'UNDER_ALLOCATED' | 'OVER_ALLOCATED' | 'NO_INCOME';

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

export interface UpsertBudgetsPayload {
  items: Array<{
    categoryId: string;
    allocated: string;
  }>;
}

export type EmergencyFundDataSource = 'ONBOARDING_BASELINE' | 'ACTUAL_HISTORICAL';
export type EmergencyFundBadge = 'Estimasi Awal' | 'Data Aktual';

export interface EmergencyFundAnalytics {
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

export interface LatteFactorItem {
  categoryId: string;
  categoryName: string;
  monthlyFrequency: number;
  monthlyTotal: string;
  annualizedProjection: string;
  opportunityCost5Yr: string;
  opportunityCost10Yr: string;
}

export interface LatteFactorAnalytics {
  windowDays: 30;
  microThresholdUsed: string;
  expectedReturnRatePct: string;
  totalMonthlyLeak: string;
  totalAnnualLeak: string;
  totalOpportunityCost5Yr: string;
  totalOpportunityCost10Yr: string;
  items: LatteFactorItem[];
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

export interface MilestoneAnalytics {
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

export interface AnalyticsDashboardResult extends DashboardSummaryResult {
  isCurrentPeriod: boolean;
  emergencyFund: EmergencyFundAnalytics;
  latteFactor: LatteFactorAnalytics;
  milestone: MilestoneAnalytics;
  budgetHealth: BudgetHealthSummary;
}

// ============================================================================
// PHASE 3: DEBT DESTROYER, FIRE PROJECTION, NET WORTH SNAPSHOTS & PDF EXPORT
// ============================================================================

export interface CreateDebtPayload {
  name: string;
  isConsumptive: boolean;
  totalPrincipal: string;
  remainingBalance?: string;
  annualInterestPct: string;
  interestType: InterestType;
  minimumMonthlyPay: string;
  dueDateDay?: number | null;
}

export interface UpdateDebtPayload {
  name?: string;
  isConsumptive?: boolean;
  totalPrincipal?: string;
  remainingBalance?: string;
  annualInterestPct?: string;
  interestType?: InterestType;
  minimumMonthlyPay?: string;
  dueDateDay?: number | null;
}

export interface SimulateDebtsPayload {
  extraMonthlyPayment: string;
}

export type DebtPayoffStrategyName = 'SNOWBALL' | 'AVALANCHE';

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

export interface DebtSimulationResult {
  activeDebtsCount: number;
  totalRemainingBalance: string;
  totalMinimumMonthlyPay: string;
  extraMonthlyPayment: string;
  snowball: DebtStrategySimulationResult;
  avalanche: DebtStrategySimulationResult;
  comparison: DebtSimulationComparison;
}

export interface FireSimulationPayload {
  monthlyEssentialBasis?: string;
  currentInvestmentPortfolio?: string;
  monthlyContribution?: string;
  swrRatePct?: string;
  inflationRatePct?: string;
  expectedReturnRatePct?: string;
  maxYears?: number;
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

export interface FireSimulationResult {
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

export interface NetWorthSnapshotItem {
  id: string;
  snapshotMonth: number;
  snapshotYear: number;
  totalAssets: string;
  totalLiabilities: string;
  netWorth: string;
  savingRatePct: string;
  createdAt: string;
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

export interface NetWorthSnapshotsResponse {
  currentBalanceSheet: CurrentBalanceSheet;
  snapshots: NetWorthSnapshotItem[];
}

export interface CreateSnapshotPayload {
  year?: number;
  month?: number;
}
