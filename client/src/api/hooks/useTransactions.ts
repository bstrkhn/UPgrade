import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import { queryKeys } from '../queryKeys';
import type {
  ApiSuccessEnvelope,
  CreateTransactionPayload,
  ListTransactionsFilter,
  PublicTransaction,
  TransactionMutationData,
  TransactionMutationMeta,
  TransactionPaginationMeta,
} from '../types';

export interface TransactionsListResponse {
  transactions: PublicTransaction[];
  meta: TransactionPaginationMeta;
}

export function useTransactions(filters: ListTransactionsFilter = {}, enabled = true) {
  return useQuery<TransactionsListResponse>({
    queryKey: queryKeys.transactions.list(filters),
    queryFn: async () => {
      const params: Record<string, string | number> = {};
      if (filters.type) params.type = filters.type;
      if (filters.accountId) params.accountId = filters.accountId;
      if (filters.categoryId) params.categoryId = filters.categoryId;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      if (filters.page) params.page = filters.page;
      if (filters.pageSize) params.pageSize = filters.pageSize;

      const response = await apiClient.get<
        ApiSuccessEnvelope<{ transactions: PublicTransaction[] }, TransactionPaginationMeta>
      >('/transactions', { params });

      return {
        transactions: response.data.data.transactions,
        meta: response.data.meta,
      };
    },
    enabled,
  });
}

function invalidateTransactionRelatedQueries(queryClient: ReturnType<typeof useQueryClient>): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.debts.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateTransactionPayload) => {
      const response = await apiClient.post<ApiSuccessEnvelope<TransactionMutationData, TransactionMutationMeta>>(
        '/transactions',
        payload,
      );
      return response.data;
    },
    onSuccess: () => {
      invalidateTransactionRelatedQueries(queryClient);
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<ApiSuccessEnvelope<TransactionMutationData, TransactionMutationMeta>>(
        `/transactions/${id}`,
      );
      return response.data;
    },
    onSuccess: () => {
      invalidateTransactionRelatedQueries(queryClient);
    },
  });
}

export function useRestoreTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post<ApiSuccessEnvelope<TransactionMutationData, TransactionMutationMeta>>(
        `/transactions/${id}/restore`,
      );
      return response.data;
    },
    onSuccess: () => {
      invalidateTransactionRelatedQueries(queryClient);
    },
  });
}
