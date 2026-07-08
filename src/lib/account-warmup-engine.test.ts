import { describe, expect, it } from 'vitest';
import {
  getStageConfig,
  getStageInfo,
  daysInWarmUp,
  computeRecommendedStage,
  recommendedDailyLimit,
  canPerformAction,
  computeWarmUpAdvancement,
} from './account-warmup-engine';
import type { Account } from './database.types';

describe('getStageConfig', () => {
  it('returns 5 stages for instagram', () => {
    const stages = getStageConfig('instagram');
    expect(stages).toHaveLength(5);
    expect(stages[0].stage).toBe(1);
    expect(stages[4].stage).toBe(5);
  });

  it('returns 5 stages for tiktok', () => {
    const stages = getStageConfig('tiktok');
    expect(stages).toHaveLength(5);
  });

  it('returns 5 stages for facebook', () => {
    const stages = getStageConfig('facebook');
    expect(stages).toHaveLength(5);
    expect(stages[4].recommendedLimit).toBe(80);
  });

  it('instagram stage 5 recommends 100 daily actions', () => {
    const stages = getStageConfig('instagram');
    expect(stages[4].recommendedLimit).toBe(100);
  });

  it('tiktok stage 5 recommends 120 daily actions', () => {
    const stages = getStageConfig('tiktok');
    expect(stages[4].recommendedLimit).toBe(120);
  });
});

describe('getStageInfo', () => {
  it('returns correct stage for valid stage number', () => {
    const info = getStageInfo('instagram', 3);
    expect(info.stage).toBe(3);
    expect(info.label).toBe('Day 4-7');
    expect(info.recommendedLimit).toBe(15);
  });

  it('clamps stage below 1 to stage 1', () => {
    const info = getStageInfo('instagram', 0);
    expect(info.stage).toBe(1);
  });

  it('clamps stage above max to max stage', () => {
    const info = getStageInfo('instagram', 99);
    expect(info.stage).toBe(5);
  });
});

describe('daysInWarmUp', () => {
  it('returns 0 when warm_up_started_at is null', () => {
    expect(daysInWarmUp(null)).toBe(0);
  });

  it('returns 0 for the same day', () => {
    const now = new Date('2026-06-29T12:00:00Z');
    expect(daysInWarmUp('2026-06-29T08:00:00Z', now)).toBe(0);
  });

  it('returns 1 for one day ago', () => {
    const now = new Date('2026-06-29T12:00:00Z');
    expect(daysInWarmUp('2026-06-28T10:00:00Z', now)).toBe(1);
  });

  it('returns 7 for exactly one week', () => {
    const now = new Date('2026-07-06T12:00:00Z');
    expect(daysInWarmUp('2026-06-29T12:00:00Z', now)).toBe(7);
  });

  it('never returns negative', () => {
    const now = new Date('2026-06-01T12:00:00Z');
    expect(daysInWarmUp('2026-06-29T12:00:00Z', now)).toBe(0);
  });
});

describe('computeRecommendedStage', () => {
  it('returns stage 1 when warm-up not started', () => {
    const account = { platform: 'instagram' as const, warm_up_started_at: null };
    expect(computeRecommendedStage(account)).toBe(1);
  });
});

// Re-test computeRecommendedStage with controlled date
describe('computeRecommendedStage (controlled)', () => {
  it('returns stage 2 for day 0 on instagram', () => {
    // warm_up_started_at = today, so daysInWarmUp = 0
    const today = new Date().toISOString();
    const account = { platform: 'instagram' as const, warm_up_started_at: today };
    expect(computeRecommendedStage(account)).toBe(2);
  });

  it('returns stage 5 for day 15+ on instagram', () => {
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
    const account = { platform: 'instagram' as const, warm_up_started_at: fifteenDaysAgo };
    expect(computeRecommendedStage(account)).toBe(5);
  });

  it('returns stage 4 for day 8+ on tiktok', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const account = { platform: 'tiktok' as const, warm_up_started_at: eightDaysAgo };
    expect(computeRecommendedStage(account)).toBe(4);
  });

  it('returns stage 5 for day 21+ on facebook', () => {
    const twentyOneDaysAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
    const account = { platform: 'facebook' as const, warm_up_started_at: twentyOneDaysAgo };
    expect(computeRecommendedStage(account)).toBe(5);
  });

  it('correctly maps all instagram stages by elapsed days', () => {
    const checkInstagram = (days: number) => {
      const started = new Date(Date.now() - days * 24 * 60 * 60 * 1000 - 1000).toISOString();
      return computeRecommendedStage({ platform: 'instagram', warm_up_started_at: started });
    };
    expect(checkInstagram(0)).toBe(2);
    expect(checkInstagram(3)).toBe(2);
    expect(checkInstagram(4)).toBe(3);
    expect(checkInstagram(7)).toBe(3);
    expect(checkInstagram(8)).toBe(4);
    expect(checkInstagram(14)).toBe(4);
    expect(checkInstagram(15)).toBe(5);
    expect(checkInstagram(30)).toBe(5);
  });

  it('correctly maps all tiktok stages by elapsed days', () => {
    const checkTikTok = (days: number) => {
      const started = new Date(Date.now() - days * 24 * 60 * 60 * 1000 - 1000).toISOString();
      return computeRecommendedStage({ platform: 'tiktok', warm_up_started_at: started });
    };
    expect(checkTikTok(0)).toBe(2);
    expect(checkTikTok(3)).toBe(2);
    expect(checkTikTok(4)).toBe(3);
    expect(checkTikTok(7)).toBe(3);
    expect(checkTikTok(8)).toBe(4);
    expect(checkTikTok(13)).toBe(4);
    expect(checkTikTok(14)).toBe(5);
    expect(checkTikTok(30)).toBe(5);
  });

  it('correctly maps all facebook stages by elapsed days', () => {
    const checkFacebook = (days: number) => {
      const started = new Date(Date.now() - days * 24 * 60 * 60 * 1000 - 1000).toISOString();
      return computeRecommendedStage({ platform: 'facebook', warm_up_started_at: started });
    };
    expect(checkFacebook(0)).toBe(2);
    expect(checkFacebook(5)).toBe(2);
    expect(checkFacebook(6)).toBe(3);
    expect(checkFacebook(12)).toBe(3);
    expect(checkFacebook(13)).toBe(4);
    expect(checkFacebook(20)).toBe(4);
    expect(checkFacebook(21)).toBe(5);
    expect(checkFacebook(30)).toBe(5);
  });
});

describe('recommendedDailyLimit', () => {
  it('returns 5 for instagram stage 2', () => {
    const account = { platform: 'instagram' as const, warm_up_stage: 2 };
    expect(recommendedDailyLimit(account)).toBe(5);
  });

  it('returns 40 for instagram stage 4', () => {
    const account = { platform: 'instagram' as const, warm_up_stage: 4 };
    expect(recommendedDailyLimit(account)).toBe(40);
  });

  it('returns 0 for stage 1 (inactive)', () => {
    const account = { platform: 'instagram' as const, warm_up_stage: 1 };
    expect(recommendedDailyLimit(account)).toBe(0);
  });
});

describe('canPerformAction', () => {
  const makeAccount = (overrides: Partial<Pick<Account, 'is_blocked' | 'daily_action_limit' | 'current_action_count' | 'warm_up_stage'>>) => ({
    is_blocked: false,
    daily_action_limit: 100,
    current_action_count: 0,
    warm_up_stage: 3,
    ...overrides,
  });

  it('allows action when everything is normal', () => {
    const result = canPerformAction(makeAccount({}));
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(100);
  });

  it('blocks action when account is blocked', () => {
    const result = canPerformAction(makeAccount({ is_blocked: true }));
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.reason).toContain('blocked');
  });

  it('blocks action when warm_up_stage is 1', () => {
    const result = canPerformAction(makeAccount({ warm_up_stage: 1 }));
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.reason).toContain('warm-up');
  });

  it('blocks action when daily limit reached', () => {
    const result = canPerformAction(makeAccount({ daily_action_limit: 50, current_action_count: 50 }));
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.reason).toContain('limit');
  });

  it('returns correct remaining count', () => {
    const result = canPerformAction(makeAccount({ daily_action_limit: 100, current_action_count: 30 }));
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(70);
  });
});

describe('computeWarmUpAdvancement', () => {
  it('returns null when already at or above recommended stage', () => {
    const account = {
      platform: 'instagram' as const,
      warm_up_started_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      warm_up_stage: 5,
      daily_action_limit: 100,
    };
    expect(computeWarmUpAdvancement(account)).toBeNull();
  });

  it('returns advancement payload when behind recommended stage', () => {
    const account = {
      platform: 'instagram' as const,
      warm_up_started_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      warm_up_stage: 2,
      daily_action_limit: 5,
    };
    const result = computeWarmUpAdvancement(account);
    expect(result).not.toBeNull();
    expect(result!.warm_up_stage).toBeGreaterThan(2);
    expect(result!.daily_action_limit).toBeGreaterThan(5);
  });

  it('returns null when warm-up not started', () => {
    const account = {
      platform: 'instagram' as const,
      warm_up_started_at: null,
      warm_up_stage: 1,
      daily_action_limit: 0,
    };
    expect(computeWarmUpAdvancement(account)).toBeNull();
  });

  it('uses max of current and recommended limit', () => {
    const account = {
      platform: 'instagram' as const,
      warm_up_started_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      warm_up_stage: 3,
      daily_action_limit: 200, // manually increased
    };
    const result = computeWarmUpAdvancement(account);
    expect(result).not.toBeNull();
    expect(result!.daily_action_limit).toBe(200); // keeps the higher manual limit
  });
});
