import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import { queryKeys } from '../queryKeys';
import type { ApiSuccessEnvelope, CategoryKind, CreateCategoryPayload, PublicCategory } from '../types';

export function useCategories(kind?: CategoryKind, enabled = true) {
  return useQuery<PublicCategory[]>({
    queryKey: queryKeys.categories.byKind(kind),
    queryFn: async () => {
      const response = await apiClient.get<ApiSuccessEnvelope<{ categories: PublicCategory[] }>>('/categories', {
        params: kind ? { kind } : undefined,
      });
      return response.data.data.categories;
    },
    enabled,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateCategoryPayload) => {
      const response = await apiClient.post<ApiSuccessEnvelope<{ category: PublicCategory }>>('/categories', payload);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<ApiSuccessEnvelope<null>>(`/categories/${id}`);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    },
  });
}
