import { supabase } from './supabase';
import { logAudit } from './audit';
import type { Account, AccountActionHistory, AccountPlatform, AccountActionType } from './database.types';

export async function fetchAccounts() {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch accounts: ${error.message}`);
  return data as Account[];
}

export async function fetchAccount(id: string) {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch account: ${error.message}`);
  if (!data) throw new Error('Account not found');
  return data as Account;
}

export async function createAccount(input: {
  username: string;
  encrypted_password: string;
  platform: AccountPlatform;
  daily_action_limit?: number;
}) {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('user_id')
    .maybeSingle();

  if (profileError) throw new Error(`Failed to get profile: ${profileError.message}`);
  if (!profile) throw new Error('User profile not found');

  const { data, error } = await supabase
    .from('accounts')
    .insert({
      user_id: profile.user_id,
      username: input.username,
      encrypted_password: input.encrypted_password,
      platform: input.platform,
      daily_action_limit: input.daily_action_limit ?? 100,
    })
    .select()
    .maybeSingle();

  if (error) throw new Error(`Failed to create account: ${error.message}`);
  if (!data) throw new Error('Account not created');

  await logAudit('account.create', 'account', data.id, { username: input.username, platform: input.platform });
  return data as Account;
}

export async function updateAccount(
  id: string,
  updates: Partial<Pick<Account, 'daily_action_limit' | 'warm_up_stage' | 'warm_up_started_at' | 'is_blocked' | 'detected_block_reason' | 'current_action_count' | 'last_action_reset_at'>>,
) {
  const { data, error } = await supabase
    .from('accounts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) throw new Error(`Failed to update account: ${error.message}`);

  await logAudit('account.update', 'account', id, updates);
  return data as Account;
}

export async function deleteAccount(id: string) {
  const { data } = await supabase.from('accounts').select('username').eq('id', id).maybeSingle();

  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Failed to delete account: ${error.message}`);

  await logAudit('account.delete', 'account', id, { username: data?.username });
}

export async function fetchAccountHistory(accountId: string, limit = 50) {
  const { data, error } = await supabase
    .from('account_action_history')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch account history: ${error.message}`);
  return data as AccountActionHistory[];
}

export async function recordAccountAction(input: {
  account_id: string;
  action_type: AccountActionType;
  step_id?: string;
  success?: boolean;
  error_message?: string;
}) {
  const { data, error } = await supabase
    .from('account_action_history')
    .insert({
      account_id: input.account_id,
      action_type: input.action_type,
      step_id: input.step_id ?? null,
      success: input.success ?? null,
      error_message: input.error_message ?? null,
    })
    .select()
    .maybeSingle();

  if (error) throw new Error(`Failed to record action: ${error.message}`);
  return data as AccountActionHistory;
}
