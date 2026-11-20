import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import { queryKeys } from '../queryKeys';
import type { ApiSuccessEnvelope, PublicDebt } from '../types';

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
