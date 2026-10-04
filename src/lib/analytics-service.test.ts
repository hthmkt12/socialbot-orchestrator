import { describe, it, expect } from 'vitest';
import { aggregateActionHistory } from './analytics-service';
import type { AccountActionHistory } from './database.types';

describe('aggregateActionHistory', () => {
  it('handles empty action history cleanly', () => {
    const summary = aggregateActionHistory([]);
    expect(summary.totalActions).toBe(0);
    expect(summary.successRate).toBe(100);
    expect(summary.actionsByType).toEqual({});
    expect(summary.dailyRollup).toEqual([]);
    expect(summary.recentFailures).toEqual([]);
  });

  it('aggregates daily actions, success rates, and action types correctly', () => {
    const rows: AccountActionHistory[] = [
      {
        id: '1',
        account_id: 'acc-1',
        action_type: 'like',
        step_id: null,
        source_run_id: null,
        source_step_id: null,
        success: true,
        error_message: null,
        created_at: '2026-10-02T10:00:00.000Z',
      },
      {
        id: '2',
        account_id: 'acc-1',
        action_type: 'like',
        step_id: null,
        source_run_id: null,
        source_step_id: null,
        success: true,
        error_message: null,
        created_at: '2026-10-02T11:00:00.000Z',
      },
      {
        id: '3',
        account_id: 'acc-1',
        action_type: 'follow',
        step_id: null,
        source_run_id: null,
        source_step_id: null,
        success: false,
        error_message: 'Rate limit exceeded on device',
        created_at: '2026-10-02T12:00:00.000Z',
      },
      {
        id: '4',
        account_id: 'acc-1',
        action_type: 'comment',
        step_id: null,
        source_run_id: null,
        source_step_id: null,
        success: true,
        error_message: null,
        created_at: '2026-10-03T09:00:00.000Z',
      },
    ];

    const summary = aggregateActionHistory(rows);

    expect(summary.totalActions).toBe(4);
    // 3 successes out of 4 = 75%
    expect(summary.successRate).toBe(75);
    expect(summary.actionsByType).toEqual({
      like: 2,
      follow: 1,
      comment: 1,
    });

    expect(summary.dailyRollup).toHaveLength(2);
    expect(summary.dailyRollup[0]).toEqual({
      date: '2026-10-02',
      total: 3,
      successCount: 2,
      failedCount: 1,
      byType: {
        like: 2,
        follow: 1,
      },
    });

    expect(summary.dailyRollup[1]).toEqual({
      date: '2026-10-03',
      total: 1,
      successCount: 1,
      failedCount: 0,
      byType: {
        comment: 1,
      },
    });

    expect(summary.recentFailures).toHaveLength(1);
    expect(summary.recentFailures[0]).toEqual({
      actionType: 'follow',
      errorMessage: 'Rate limit exceeded on device',
      createdAt: '2026-10-02T12:00:00.000Z',
    });
  });
});
