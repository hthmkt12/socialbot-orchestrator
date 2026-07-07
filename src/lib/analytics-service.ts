import { supabase } from './supabase';
import type { AccountAnalytics } from './database.types';
import { isMissingSchemaError } from './supabase-errors';

export async function fetchAccountAnalytics(accountId: string, days = 30) {
  const dateStr = new Date();
  dateStr.setDate(dateStr.getDate() - days);
  const cutoffDate = dateStr.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('account_analytics')
    .select('*')
    .eq('account_id', accountId)
    .gte('snapshot_date', cutoffDate)
    .order('snapshot_date', { ascending: true });

  if (isMissingSchemaError(error)) return [];
  if (error) throw new Error(`Failed to fetch analytics: ${error.message}`);
  return data as AccountAnalytics[];
}

export async function fetchAccountGrowth(accountId: string, days = 30) {
  const { data, error } = await supabase.rpc('get_account_growth', {
    p_account_id: accountId,
    p_days: days,
  });

  if (isMissingSchemaError(error)) return undefined;
  if (error) throw new Error(`Failed to fetch growth metrics: ${error.message}`);
  return data?.[0] as { followers_gained: number; avg_engagement: number } | undefined;
}
