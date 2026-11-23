import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import { queryKeys } from '../queryKeys';
import type {
  AnalyticsDashboardResult,
  ApiSuccessEnvelope,
  CreateSnapshotPayload,
  FireSimulationPayload,
  FireSimulationResult,
  NetWorthSnapshotItem,
  NetWorthSnapshotsResponse,
  PublicUser,
} from '../types';

export function useAnalyticsDashboard(year: number, month: number, enabled = true) {
  const queryClient = useQueryClient();

  return useQuery<AnalyticsDashboardResult>({
    queryKey: queryKeys.analytics.dashboard(year, month),
    queryFn: async () => {
      const response = await apiClient.get<ApiSuccessEnvelope<AnalyticsDashboardResult>>('/analytics/dashboard', {
        params: { year, month },
      });
      const result = response.data.data;

      // Sync cached user level/healthStatus immediately when viewing current period
      if (result.isCurrentPeriod) {
        const cachedUser = queryClient.getQueryData<PublicUser | null>(queryKeys.auth.me);
        if (
          cachedUser &&
          (cachedUser.currentLevel !== result.milestone.currentLevel ||
            cachedUser.highestLevel !== result.milestone.highestLevel ||
            cachedUser.healthStatus !== result.milestone.healthStatus)
        ) {
          queryClient.setQueryData<PublicUser>(queryKeys.auth.me, {
            ...cachedUser,
            currentLevel: result.milestone.currentLevel,
            highestLevel: result.milestone.highestLevel,
            healthStatus: result.milestone.healthStatus,
          });
        }
      }

      return result;
    },
    enabled,
  });
}

export function useFireSimulation() {
  return useMutation({
    mutationFn: async (payload: FireSimulationPayload = {}) => {
      const response = await apiClient.post<ApiSuccessEnvelope<FireSimulationResult>>(
        '/analytics/fire/simulate',
        payload,
      );
      return response.data.data;
    },
  });
}

export function useNetWorthSnapshots(enabled = true) {
  return useQuery<NetWorthSnapshotsResponse>({
    queryKey: queryKeys.analytics.snapshots,
    queryFn: async () => {
      const response = await apiClient.get<ApiSuccessEnvelope<NetWorthSnapshotsResponse>>('/analytics/snapshots');
      return response.data.data;
    },
    enabled,
  });
}

export function useCreateSnapshot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateSnapshotPayload = {}) => {
      const response = await apiClient.post<
        ApiSuccessEnvelope<{ period: { year: number; month: number }; snapshot: NetWorthSnapshotItem }>
      >('/analytics/snapshot', payload);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.snapshots });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    },
  });
}
