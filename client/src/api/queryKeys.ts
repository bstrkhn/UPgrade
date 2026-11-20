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
  dashboard: {
    all: ['dashboard'] as const,
    summary: (year: number, month: number) => ['dashboard', 'summary', { year, month }] as const,
  },
};
