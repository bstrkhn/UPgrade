import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import { queryKeys } from '../queryKeys';
import type { ApiSuccessEnvelope, CreateAccountPayload, PublicAccount, UpdateAccountPayload } from '../types';

export function useAccounts(enabled = true) {
  return useQuery<PublicAccount[]>({
    queryKey: queryKeys.accounts.all,
    queryFn: async () => {
      const response = await apiClient.get<ApiSuccessEnvelope<{ accounts: PublicAccount[] }>>('/accounts');
      return response.data.data.accounts;
    },
    enabled,
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateAccountPayload) => {
      const response = await apiClient.post<ApiSuccessEnvelope<{ account: PublicAccount }>>('/accounts', payload);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all });
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateAccountPayload }) => {
      const response = await apiClient.patch<ApiSuccessEnvelope<{ account: PublicAccount }>>(
        `/accounts/${id}`,
        payload,
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all });
    },
  });
}
