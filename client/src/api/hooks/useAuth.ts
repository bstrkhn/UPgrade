import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiClientError } from '../client';
import { queryKeys } from '../queryKeys';
import type {
  ApiSuccessEnvelope,
  LoginPayload,
  PublicUser,
  RegisterPayload,
  UpdatePreferencesPayload,
} from '../types';

export function useMe() {
  return useQuery<PublicUser | null>({
    queryKey: queryKeys.auth.me,
    queryFn: async () => {
      try {
        const response = await apiClient.get<ApiSuccessEnvelope<{ user: PublicUser }>>('/auth/me');
        return response.data.data.user;
      } catch (error) {
        if (error instanceof ApiClientError && error.statusCode === 401) {
          return null;
        }
        throw error;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: RegisterPayload) => {
      const response = await apiClient.post<ApiSuccessEnvelope<{ user: PublicUser }>>('/auth/register', payload);
      return response.data;
    },
    onSuccess: (envelope) => {
      queryClient.setQueryData(queryKeys.auth.me, envelope.data.user);
    },
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const response = await apiClient.post<ApiSuccessEnvelope<{ user: PublicUser }>>('/auth/login', payload);
      return response.data;
    },
    onSuccess: (envelope) => {
      queryClient.setQueryData(queryKeys.auth.me, envelope.data.user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<ApiSuccessEnvelope<null>>('/auth/logout');
      return response.data;
    },
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(queryKeys.auth.me, null);
    },
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdatePreferencesPayload) => {
      const response = await apiClient.patch<ApiSuccessEnvelope<{ user: PublicUser }>>('/auth/preferences', payload);
      return response.data;
    },
    onSuccess: (envelope) => {
      queryClient.setQueryData(queryKeys.auth.me, envelope.data.user);
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all });
    },
  });
}
