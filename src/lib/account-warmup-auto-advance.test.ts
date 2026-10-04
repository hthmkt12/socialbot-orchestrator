import { describe, expect, it } from 'vitest';
import type { Account } from './database.types';
import {
  getAccountsReadyForAdvancement,
  getAdvancementEstimates,
  buildAdvancementUpdates,
} from './account-warmup-auto-advance';

type AccountAdvancementFixture = Pick<
  Account,
  'id' | 'username' | 'platform' | 'warm_up_stage' | 'warm_up_started_at' | 'daily_action_limit' | 'current_action_count' | 'is_blocked'
>;

describe('getAccountsReadyForAdvancement', () => {
  it('returns empty when account is blocked', () => {
    const account: AccountAdvancementFixture = {
      id: 'acc-1',
      username: 'user1',
      platform: 'instagram',
      warm_up_stage: 2,
      warm_up_started_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago (ready for stage 3)
      daily_action_limit: 5,
      current_action_count: 3,
      is_blocked: true,
    };
    expect(getAccountsReadyForAdvancement([account])).toHaveLength(0);
  });

  it('ignores accounts in stage 1 (inactive) or stage 5 (max)', () => {
    const stage1: AccountAdvancementFixture = {
      id: 'acc-1',
      username: 'user1',
      platform: 'instagram',
      warm_up_stage: 1,
      warm_up_started_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      daily_action_limit: 0,
      current_action_count: 0,
      is_blocked: false,
    };
    const stage5: AccountAdvancementFixture = {
      id: 'acc-5',
      username: 'user5',
      platform: 'instagram',
      warm_up_stage: 5,
      warm_up_started_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      daily_action_limit: 100,
      current_action_count: 50,
      is_blocked: false,
    };
    expect(getAccountsReadyForAdvancement([stage1, stage5])).toHaveLength(0);
  });

  it('detects accounts ready to advance from Stage 2 to Stage 3 (Day 4+)', () => {
    const account: AccountAdvancementFixture = {
      id: 'acc-2',
      username: 'user2',
      platform: 'instagram',
      warm_up_stage: 2,
      warm_up_started_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago -> Stage 3
      daily_action_limit: 5,
      current_action_count: 2,
      is_blocked: false,
    };
    const ready = getAccountsReadyForAdvancement([account]);
    expect(ready).toHaveLength(1);
    expect(ready[0].result.targetStage).toBe(3);
    expect(ready[0].result.newDailyLimit).toBe(15);
    expect(ready[0].result.targetLabel).toBe('Day 4-7');
  });

  it('detects accounts ready to advance from Stage 3 to Stage 4 (Day 8+)', () => {
    const account: AccountAdvancementFixture = {
      id: 'acc-3',
      username: 'user3',
      platform: 'tiktok',
      warm_up_stage: 3,
      warm_up_started_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(), // 9 days ago -> Stage 4
      daily_action_limit: 20,
      current_action_count: 5,
      is_blocked: false,
    };
    const ready = getAccountsReadyForAdvancement([account]);
    expect(ready).toHaveLength(1);
    expect(ready[0].result.targetStage).toBe(4);
    expect(ready[0].result.newDailyLimit).toBe(50);
  });
});

describe('getAdvancementEstimates', () => {
  it('computes daysElapsed, daysRequired, and estimatedDate accurately', () => {
    const now = new Date('2026-10-04T12:00:00Z');
    const startedAt = new Date('2026-10-02T12:00:00Z').toISOString(); // 2 days elapsed, Stage 2 (requires 4 days for Stage 3)
    const account = {
      id: 'acc-est',
      username: 'userEst',
      platform: 'instagram' as const,
      warm_up_stage: 2,
      warm_up_started_at: startedAt,
    };

    const estimates = getAdvancementEstimates([account], now);
    expect(estimates).toHaveLength(1);
    expect(estimates[0].daysElapsed).toBe(2);
    expect(estimates[0].daysRequired).toBe(4);
    expect(estimates[0].daysRemaining).toBe(2);
    expect(estimates[0].nextStage).toBe(3);
    expect(estimates[0].nextLabel).toBe('Day 4-7');
    expect(new Date(estimates[0].estimatedDate!).getTime()).toBe(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  });
});

describe('buildAdvancementUpdates', () => {
  it('converts candidates into update objects', () => {
    const candidates = [
      {
        account: {} as Account,
        result: {
          accountId: 'acc-abc',
          username: 'userAbc',
          platform: 'instagram',
          currentStage: 2,
          targetStage: 3,
          targetLabel: 'Day 4-7',
          newDailyLimit: 15,
        },
      },
    ];
    const updates = buildAdvancementUpdates(candidates);
    expect(updates).toEqual([
      {
        id: 'acc-abc',
        warm_up_stage: 3,
        daily_action_limit: 15,
      },
    ]);
  });
});
