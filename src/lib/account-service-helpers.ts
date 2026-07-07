import { supabase } from './supabase';
import { logAudit } from './audit';
import type { Account, AccountActionHistory, AccountPlatform, AccountActionType, UserRole } from './database.types';
import { canManageAccounts } from './role-access';
import { isMissingSchemaError } from './supabase-errors';

const ENCRYPTED_PASSWORD_PREFIX = 'v2:';
const VALID_PLATFORMS = new Set<AccountPlatform>(['instagram', 'tiktok', 'facebook']);

type AccountMutationProfile = {
  user_id: string;
  role: UserRole;
};

async function requireAccountMutationProfile(): Promise<AccountMutationProfile> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('user_id, role')
    .maybeSingle();

  if (profileError) throw new Error(`Failed to get profile: ${profileError.message}`);
  if (!profile) throw new Error('User profile not found');
  const typedProfile = profile as AccountMutationProfile;
  if (!canManageAccounts(typedProfile.role)) {
    throw new Error('Only operators and admins can manage social accounts');
  }
  return typedProfile;
}

function validateAccountCreateInput(input: {
  username: string;
  encrypted_password: string;
  platform: AccountPlatform;
  daily_action_limit?: number;
}) {
  if (!input.username.trim()) throw new Error('Username is required');
  if (!VALID_PLATFORMS.has(input.platform)) throw new Error('Invalid account platform');
  if (!input.encrypted_password.startsWith(ENCRYPTED_PASSWORD_PREFIX)) {
    throw new Error('Account password must be encrypted before saving');
  }
  if (input.daily_action_limit != null && (!Number.isInteger(input.daily_action_limit) || input.daily_action_limit < 1)) {
    throw new Error('Daily action limit must be a positive integer');
  }
}

export async function fetchAccounts() {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: false });

  if (isMissingSchemaError(error)) return [];
  if (error) throw new Error(`Failed to fetch accounts: ${error.message}`);
  return data as Account[];
}

export async function fetchAccount(id: string) {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (isMissingSchemaError(error)) throw new Error('Account not found');
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
  validateAccountCreateInput(input);
  const profile = await requireAccountMutationProfile();

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

/** Batch-insert accounts in a single DB round-trip. Fetches profile once. */
export async function createAccountsBatch(rows: {
  username: string;
  encrypted_password: string;
  platform: AccountPlatform;
  daily_action_limit?: number;
}[]): Promise<{ success: number; failed: number }> {
  if (rows.length === 0) return { success: 0, failed: 0 };
  rows.forEach(validateAccountCreateInput);
  const profile = await requireAccountMutationProfile();

  const insertRows = rows.map((r) => ({
    user_id: profile.user_id,
    username: r.username,
    encrypted_password: r.encrypted_password,
    platform: r.platform,
    daily_action_limit: r.daily_action_limit ?? 100,
  }));

  const { data, error } = await supabase
    .from('accounts')
    .insert(insertRows)
    .select();

  if (error) throw new Error(`Batch insert failed: ${error.message}`);

  const inserted = data?.length ?? 0;
  for (const account of data ?? []) {
    await logAudit('account.create', 'account', account.id, { username: account.username, platform: account.platform });
  }

  return { success: inserted, failed: rows.length - inserted };
}

export async function updateAccount(
  id: string,
  updates: Partial<Pick<Account, 'daily_action_limit' | 'warm_up_stage' | 'warm_up_started_at' | 'is_blocked' | 'detected_block_reason' | 'current_action_count' | 'last_action_reset_at'>>,
) {
  await requireAccountMutationProfile();

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
  await requireAccountMutationProfile();
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

  if (isMissingSchemaError(error)) return [];
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
