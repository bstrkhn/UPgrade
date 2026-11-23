import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import { queryKeys } from '../queryKeys';
import type { ApiSuccessEnvelope, OnboardingPayload, OnboardingResult } from '../types';

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: OnboardingPayload) => {
      const response = await apiClient.post<ApiSuccessEnvelope<OnboardingResult>>('/onboarding', payload);
      return response.data;
    },
    onSuccess: (envelope) => {
      queryClient.setQueryData(queryKeys.auth.me, envelope.data.user);
      void queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.debts.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all });
    },
  });
}
