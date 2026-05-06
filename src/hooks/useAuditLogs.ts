import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { AuditLog } from '../lib/database.types';

export function useAuditLogs(limit = 100, enabled = true) {
  return useQuery({
    queryKey: ['audit-logs', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as AuditLog[];
    },
    enabled,
  });
}
