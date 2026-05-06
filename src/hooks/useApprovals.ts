import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { processApprovalDecision } from '../lib/approval-service';
import type { Approval } from '../lib/database.types';

export function useApprovals() {
  return useQuery({
    queryKey: ['approvals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('approvals')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Approval[];
    },
    refetchInterval: 5000,
  });
}

export function usePendingApprovals() {
  return useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('approvals')
        .select('*')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Approval[];
    },
    refetchInterval: 3000,
  });
}

export function useResolveApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      approvalId,
      approved,
      reviewerId,
      reviewerNotes,
    }: {
      approvalId: string;
      approved: boolean;
      reviewerId: string;
      reviewerNotes?: string;
    }) => {
      return processApprovalDecision({ approvalId, approved, reviewerId, reviewerNotes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['runs'] });
    },
  });
}
