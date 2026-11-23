import type { CategoryKind, ListTransactionsFilter } from './types';

export const queryKeys = {
  auth: {
    all: ['auth'] as const,
    me: ['auth', 'me'] as const,
  },
  accounts: {
    all: ['accounts'] as const,
  },
  categories: {
    all: ['categories'] as const,
    byKind: (kind?: CategoryKind) => ['categories', { kind: kind ?? 'ALL' }] as const,
  },
  debts: {
    all: ['debts'] as const,
    byFilter: (activeOnly?: boolean) => ['debts', { activeOnly: activeOnly ?? null }] as const,
  },
  transactions: {
    all: ['transactions'] as const,
    list: (filters: ListTransactionsFilter) => ['transactions', 'list', filters] as const,
  },
  budgets: {
    all: ['budgets'] as const,
    period: (year: number, month: number) => ['budgets', 'period', { year, month }] as const,
  },
  analytics: {
    all: ['analytics'] as const,
    dashboard: (year: number, month: number) => ['analytics', 'dashboard', { year, month }] as const,
    snapshots: ['analytics', 'snapshots'] as const,
    fire: ['analytics', 'fire'] as const,
  },
};
