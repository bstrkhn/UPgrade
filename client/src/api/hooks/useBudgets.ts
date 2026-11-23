import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import { queryKeys } from '../queryKeys';
import type { ApiSuccessEnvelope, BudgetOverviewResult, UpsertBudgetsPayload } from '../types';

export function useBudgetOverview(year: number, month: number, enabled = true) {
  return useQuery<BudgetOverviewResult>({
    queryKey: queryKeys.budgets.period(year, month),
    queryFn: async () => {
      const response = await apiClient.get<ApiSuccessEnvelope<BudgetOverviewResult>>(
        `/budgets/${year}/${month}`,
      );
      return response.data.data;
    },
    enabled,
  });
}

export function useUpsertBudgets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      year,
      month,
      payload,
    }: {
      year: number;
      month: number;
      payload: UpsertBudgetsPayload;
    }) => {
      const response = await apiClient.put<ApiSuccessEnvelope<BudgetOverviewResult>>(
        `/budgets/${year}/${month}`,
        payload,
      );
      return response.data;
    },
    onSuccess: (envelope, variables) => {
      queryClient.setQueryData(queryKeys.budgets.period(variables.year, variables.month), envelope.data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    },
  });
}
