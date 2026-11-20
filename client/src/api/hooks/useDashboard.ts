import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import { queryKeys } from '../queryKeys';
import type { ApiSuccessEnvelope, DashboardSummaryResult } from '../types';

export function useDashboardSummary(year: number, month: number, enabled = true) {
  return useQuery<DashboardSummaryResult>({
    queryKey: queryKeys.dashboard.summary(year, month),
    queryFn: async () => {
      const response = await apiClient.get<ApiSuccessEnvelope<DashboardSummaryResult>>('/dashboard/summary', {
        params: { year, month },
      });
      return response.data.data;
    },
    enabled,
  });
}
