import { supabase } from './supabase';
import type { AccountAnalytics } from './database.types';

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

  if (error) throw new Error(`Failed to fetch analytics: ${error.message}`);
  return data as AccountAnalytics[];
}

export async function fetchAccountGrowth(accountId: string, days = 30) {
  const { data, error } = await supabase.rpc('get_account_growth', {
    p_account_id: accountId,
    p_days: days,
  });

  if (error) throw new Error(`Failed to fetch growth metrics: ${error.message}`);
  return data?.[0] as { followers_gained: number; avg_engagement: number } | undefined;
}

export async function generateMockAnalytics(accountId: string) {
  // Utility to seed some data for testing the UI
  const records = [];
  const now = new Date();
  let followers = 1500;
  
  for (let i = 30; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    
    // add 0-15 followers per day
    followers += Math.floor(Math.random() * 15);
    
    records.push({
      account_id: accountId,
      snapshot_date: d.toISOString().split('T')[0],
      followers_count: followers,
      following_count: 500 + Math.floor(Math.random() * 5),
      posts_count: 45 + Math.floor((30 - i) / 5), // new post every 5 days
      engagement_rate: 2.5 + (Math.random() * 1.5 - 0.75), // 1.75 to 3.25
    });
  }
  
  const { error } = await supabase.from('account_analytics').upsert(records, { onConflict: 'account_id,snapshot_date' });
  if (error) throw new Error(`Failed to generate mock analytics: ${error.message}`);
}
