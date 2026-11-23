import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import { queryKeys } from '../queryKeys';
import type {
  ApiSuccessEnvelope,
  CreateDebtPayload,
  DebtSimulationResult,
  PublicDebt,
  SimulateDebtsPayload,
  UpdateDebtPayload,
} from '../types';

export function useDebts(activeOnly?: boolean, enabled = true) {
  return useQuery<PublicDebt[]>({
    queryKey: queryKeys.debts.byFilter(activeOnly),
    queryFn: async () => {
      const response = await apiClient.get<ApiSuccessEnvelope<{ debts: PublicDebt[] }>>('/debts', {
        params: activeOnly === undefined ? undefined : { activeOnly: activeOnly ? 'true' : 'false' },
      });
      return response.data.data.debts;
    },
    enabled,
  });
}

function invalidateDebtRelatedQueries(queryClient: ReturnType<typeof useQueryClient>): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.debts.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
}

export function useCreateDebt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateDebtPayload) => {
      const response = await apiClient.post<ApiSuccessEnvelope<{ debt: PublicDebt }>>('/debts', payload);
      return response.data;
    },
    onSuccess: () => {
      invalidateDebtRelatedQueries(queryClient);
    },
  });
}

export function useUpdateDebt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateDebtPayload }) => {
      const response = await apiClient.patch<ApiSuccessEnvelope<{ debt: PublicDebt }>>(`/debts/${id}`, payload);
      return response.data;
    },
    onSuccess: () => {
      invalidateDebtRelatedQueries(queryClient);
    },
  });
}

export function useDeleteDebt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<ApiSuccessEnvelope<null>>(`/debts/${id}`);
      return response.data;
    },
    onSuccess: () => {
      invalidateDebtRelatedQueries(queryClient);
    },
  });
}

export function useSimulateDebts() {
  return useMutation({
    mutationFn: async (payload: SimulateDebtsPayload) => {
      const response = await apiClient.post<ApiSuccessEnvelope<DebtSimulationResult>>('/debts/simulate', payload);
      return response.data.data;
    },
  });
}
