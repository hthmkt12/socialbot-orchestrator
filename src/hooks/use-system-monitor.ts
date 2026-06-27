import { useQuery } from '@tanstack/react-query';
import { fetchSystemMetrics } from '../lib/system-monitor-service';

export function useSystemMonitor(refreshIntervalMs = 10000) {
  return useQuery({
    queryKey: ['system-monitor'],
    queryFn: fetchSystemMetrics,
    refetchInterval: refreshIntervalMs,
  });
}
