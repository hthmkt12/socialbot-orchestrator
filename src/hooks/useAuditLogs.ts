import { useQuery } from '@tanstack/react-query';
import { fetchAuditLogsForCurrentUser } from '../lib/admin-governance';

export function useAuditLogs(limit = 100, enabled = true) {
  return useQuery({
    queryKey: ['audit-logs', limit],
    queryFn: () => fetchAuditLogsForCurrentUser(limit),
    enabled,
  });
}
