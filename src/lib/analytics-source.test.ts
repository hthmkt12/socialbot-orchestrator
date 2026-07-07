import { describe, expect, it } from 'vitest';
import type { AccountAnalytics } from './database.types';
import { classifyAnalyticsSource } from './analytics-source';

const baseRow: AccountAnalytics = {
  id: 'analytics-1',
  account_id: 'account-1',
  snapshot_date: '2026-07-07',
  followers_count: 100,
  following_count: 20,
  posts_count: 5,
  engagement_rate: 3.2,
  created_at: '2026-07-07T00:00:00Z',
};

describe('analytics source classifier', () => {
  it('labels empty analytics as insufficient data', () => {
    expect(classifyAnalyticsSource([])).toMatchObject({
      state: 'insufficient_data',
      label: 'Insufficient data',
    });
  });

  it('labels sane persisted rows as real persisted data', () => {
    expect(classifyAnalyticsSource([baseRow])).toMatchObject({
      state: 'real_persisted',
      label: 'Real persisted data',
    });
  });

  it('labels impossible metrics as unknown instead of healthy', () => {
    expect(classifyAnalyticsSource([{ ...baseRow, engagement_rate: 120 }])).toMatchObject({
      state: 'unknown',
      label: 'Unknown source',
    });
  });
});
