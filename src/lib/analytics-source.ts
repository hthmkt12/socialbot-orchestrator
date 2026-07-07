import type { AccountAnalytics } from './database.types';

export type AnalyticsSourceState =
  | 'real_persisted'
  | 'seed_or_demo'
  | 'insufficient_data'
  | 'unknown';

export type AnalyticsSourceSummary = {
  state: AnalyticsSourceState;
  label: string;
  detail: string;
};

function hasImpossibleMetric(row: AccountAnalytics) {
  return (
    row.followers_count < 0 ||
    row.following_count < 0 ||
    row.posts_count < 0 ||
    (row.engagement_rate !== null && (row.engagement_rate < 0 || row.engagement_rate > 100))
  );
}

export function classifyAnalyticsSource(
  rows: AccountAnalytics[] | null | undefined
): AnalyticsSourceSummary {
  if (!rows || rows.length === 0) {
    return {
      state: 'insufficient_data',
      label: 'Insufficient data',
      detail: 'No persisted analytics snapshots are available for this account and date range.',
    };
  }

  if (rows.some(hasImpossibleMetric)) {
    return {
      state: 'unknown',
      label: 'Unknown source',
      detail: 'Persisted analytics rows contain invalid metrics and should not be treated as healthy.',
    };
  }

  return {
    state: 'real_persisted',
    label: 'Real persisted data',
    detail: `${rows.length} persisted analytics snapshot${rows.length === 1 ? '' : 's'} loaded.`,
  };
}
