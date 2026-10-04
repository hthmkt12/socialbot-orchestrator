import { useQuery } from '@tanstack/react-query';
import { fetchAccountAnalytics, fetchAccountGrowth, fetchAccountActionMetrics } from '../lib/analytics-service';

export function useAccountAnalytics(accountId: string | undefined, days = 30) {
  return useQuery({
    queryKey: ['analytics', accountId, days],
    queryFn: () => fetchAccountAnalytics(accountId!, days),
    enabled: !!accountId,
  });
}

export function useAccountGrowth(accountId: string | undefined, days = 30) {
  return useQuery({
    queryKey: ['analytics', 'growth', accountId, days],
    queryFn: () => fetchAccountGrowth(accountId!, days),
    enabled: !!accountId,
  });
}

export function useAccountActionMetrics(accountId: string | undefined, days = 30) {
  return useQuery({
    queryKey: ['analytics', 'actions', accountId, days],
    queryFn: () => fetchAccountActionMetrics(accountId!, days),
    enabled: !!accountId,
  });
}

