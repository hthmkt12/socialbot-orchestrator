import { supabase } from './supabase';
import type { AccountAnalytics, AccountActionHistory } from './database.types';
import { isMissingSchemaError } from './supabase-errors';

export interface DailyActionRollup {
  date: string;
  total: number;
  successCount: number;
  failedCount: number;
  byType: Record<string, number>;
}

export interface AccountActionSummary {
  totalActions: number;
  successRate: number;
  actionsByType: Record<string, number>;
  dailyRollup: DailyActionRollup[];
  recentFailures: {
    actionType: string;
    errorMessage: string;
    createdAt: string;
  }[];
}

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

export function aggregateActionHistory(rows: AccountActionHistory[]): AccountActionSummary {
  if (!rows || rows.length === 0) {
    return {
      totalActions: 0,
      successRate: 100,
      actionsByType: {},
      dailyRollup: [],
      recentFailures: [],
    };
  }

  const actionsByType: Record<string, number> = {};
  const rollupMap = new Map<string, { total: number; successCount: number; failedCount: number; byType: Record<string, number> }>();
  const recentFailures: AccountActionSummary['recentFailures'] = [];
  let totalSuccess = 0;

  for (const row of rows) {
    const isSuccess = row.success !== false;
    if (isSuccess) totalSuccess++;

    actionsByType[row.action_type] = (actionsByType[row.action_type] || 0) + 1;

    const date = row.created_at.split('T')[0];
    const rollup = rollupMap.get(date) || { total: 0, successCount: 0, failedCount: 0, byType: {} };
    rollup.total++;
    if (isSuccess) {
      rollup.successCount++;
    } else {
      rollup.failedCount++;
    }
    rollup.byType[row.action_type] = (rollup.byType[row.action_type] || 0) + 1;
    rollupMap.set(date, rollup);

    if (!isSuccess && row.error_message && recentFailures.length < 5) {
      recentFailures.push({
        actionType: row.action_type,
        errorMessage: row.error_message,
        createdAt: row.created_at,
      });
    }
  }

  const dailyRollup: DailyActionRollup[] = Array.from(rollupMap.entries())
    .map(([date, data]) => ({
      date,
      total: data.total,
      successCount: data.successCount,
      failedCount: data.failedCount,
      byType: data.byType,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const successRate = rows.length > 0 ? (totalSuccess / rows.length) * 100 : 100;

  return {
    totalActions: rows.length,
    successRate: Math.round(successRate * 10) / 10,
    actionsByType,
    dailyRollup,
    recentFailures,
  };
}

export async function fetchAccountActionMetrics(accountId: string, days = 30): Promise<AccountActionSummary> {
  const dateStr = new Date();
  dateStr.setDate(dateStr.getDate() - days);
  const cutoffDate = dateStr.toISOString();

  const { data, error } = await supabase
    .from('account_action_history')
    .select('*')
    .eq('account_id', accountId)
    .gte('created_at', cutoffDate)
    .order('created_at', { ascending: false });

  if (isMissingSchemaError(error)) {
    return aggregateActionHistory([]);
  }
  if (error) throw new Error(`Failed to fetch action history: ${error.message}`);
  return aggregateActionHistory((data as AccountActionHistory[]) || []);
}

