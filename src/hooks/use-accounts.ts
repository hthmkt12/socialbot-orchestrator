import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchAccounts,
  fetchAccount,
  createAccount,
  createAccountsBatch,
  updateAccount,
  deleteAccount,
  fetchAccountHistory,
  recordAccountAction,
} from '../lib/account-service-helpers';
import type { AccountActionType, AccountPlatform } from '../lib/database.types';

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: fetchAccounts,
  });
}

export function useAccount(id: string) {
  return useQuery({
    queryKey: ['accounts', id],
    queryFn: () => fetchAccount(id),
    enabled: !!id,
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      username: string;
      encrypted_password: string;
      platform: AccountPlatform;
      daily_action_limit?: number;
    }) => createAccount(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...updates
    }: {
      id: string;
      daily_action_limit?: number;
      warm_up_stage?: number;
      warm_up_started_at?: string;
      is_blocked?: boolean;
      detected_block_reason?: string;
      current_action_count?: number;
      last_action_reset_at?: string;
    }) => updateAccount(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts', data.id] });
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useBatchCreateAccounts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rows: {
      username: string;
      encrypted_password: string;
      platform: AccountPlatform;
      daily_action_limit?: number;
    }[]) => createAccountsBatch(rows),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useAccountHistory(accountId: string, limit?: number) {
  return useQuery({
    queryKey: ['account-history', accountId],
    queryFn: () => fetchAccountHistory(accountId, limit),
    enabled: !!accountId,
  });
}

export function useRecordAccountAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      account_id: string;
      action_type: AccountActionType;
      step_id?: string | null;
      source_run_id?: string | null;
      source_step_id?: string | null;
      success?: boolean;
      error_message?: string;
    }) => recordAccountAction(input),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['account-history', vars.account_id] });
    },
  });
}
