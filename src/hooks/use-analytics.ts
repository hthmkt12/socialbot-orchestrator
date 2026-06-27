import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAccountAnalytics, fetchAccountGrowth, generateMockAnalytics } from '../lib/analytics-service';

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

export function useGenerateMockAnalytics() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => generateMockAnalytics(accountId),
    onSuccess: (_, accountId) => {
      queryClient.invalidateQueries({ queryKey: ['analytics', accountId] });
      queryClient.invalidateQueries({ queryKey: ['analytics', 'growth', accountId] });
    },
  });
}
