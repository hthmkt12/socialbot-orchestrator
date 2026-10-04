import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  AccountWarmupScheduler,
  computeRecommendedStage,
  daysInWarmUp,
  getRecommendedDailyLimit,
  shouldResetDailyActionCount,
} from './account-warmup-scheduler';
import type { WorkerConfig } from './run-claim-coordinator';

const mockConfig: WorkerConfig = {
  port: 4310,
  pollIntervalMs: 1000,
  leaseTtlMs: 30000,
  maxActiveClaims: 2,
  instanceId: 'worker-test',
  supabaseUrl: 'http://127.0.0.1:54321',
  supabaseServiceRoleKey: 'mock-key',
  credentialVaultWorkerToken: 'mock-token',
  gatewayBaseUrl: 'http://127.0.0.1:8080',
  mobileMcpBridgeUrl: 'http://127.0.0.1:4321',
  deviceBackend: 'mobile-mcp',
  commandTimeoutMs: 1000,
};

describe('Warmup Stage and Reset Helpers', () => {
  it('computes days elapsed in warm-up accurately', () => {
    expect(daysInWarmUp(null)).toBe(0);

    const now = new Date('2026-10-04T12:00:00Z');
    const threeDaysAgo = '2026-10-01T12:00:00Z';
    expect(daysInWarmUp(threeDaysAgo, now)).toBe(3);

    const fourAndHalfDaysAgo = '2026-09-29T23:00:00Z';
    expect(daysInWarmUp(fourAndHalfDaysAgo, now)).toBe(4);
  });

  it('determines recommended stages for Instagram based on days elapsed', () => {
    const now = new Date('2026-10-04T12:00:00Z');

    expect(computeRecommendedStage('instagram', null, now)).toBe(1);

    // Day 0-3 -> Stage 2
    expect(computeRecommendedStage('instagram', '2026-10-02T12:00:00Z', now)).toBe(2);

    // Day 4-7 -> Stage 3
    expect(computeRecommendedStage('instagram', '2026-09-30T12:00:00Z', now)).toBe(3);

    // Day 8-14 -> Stage 4
    expect(computeRecommendedStage('instagram', '2026-09-25T12:00:00Z', now)).toBe(4);

    // Day 15+ -> Stage 5
    expect(computeRecommendedStage('instagram', '2026-09-10T12:00:00Z', now)).toBe(5);
  });

  it('provides recommended daily action limits per platform and stage', () => {
    expect(getRecommendedDailyLimit('instagram', 1)).toBe(0);
    expect(getRecommendedDailyLimit('instagram', 2)).toBe(5);
    expect(getRecommendedDailyLimit('instagram', 3)).toBe(15);
    expect(getRecommendedDailyLimit('instagram', 4)).toBe(40);
    expect(getRecommendedDailyLimit('instagram', 5)).toBe(100);

    expect(getRecommendedDailyLimit('tiktok', 3)).toBe(20);
    expect(getRecommendedDailyLimit('tiktok', 5)).toBe(120);
  });

  it('detects when daily action counts require reset', () => {
    const now = new Date('2026-10-04T12:00:00Z');

    // Never reset before -> must reset
    expect(shouldResetDailyActionCount(null, now)).toBe(true);

    // Reset yesterday -> must reset
    expect(shouldResetDailyActionCount('2026-10-03T23:59:00Z', now)).toBe(true);

    // Reset earlier today -> no reset needed
    expect(shouldResetDailyActionCount('2026-10-04T02:00:00Z', now)).toBe(false);
  });
});

describe('AccountWarmupScheduler', () => {
  it('polls accounts, resets action counts, and advances warm-up stage', async () => {
    const now = new Date('2026-10-04T12:00:00Z');
    const fiveDaysAgo = '2026-09-29T12:00:00Z'; // 5 days -> Stage 3 eligible

    const accountsData = [
      {
        id: 'acc-1',
        username: 'insta_grower',
        platform: 'instagram',
        warm_up_stage: 2,
        warm_up_started_at: fiveDaysAgo,
        daily_action_limit: 5,
        current_action_count: 5,
        last_action_reset_at: '2026-10-03T10:00:00Z', // Yesterday
        is_blocked: false,
      },
      {
        id: 'acc-2',
        username: 'tiktok_full',
        platform: 'tiktok',
        warm_up_stage: 5,
        warm_up_started_at: '2026-08-01T00:00:00Z',
        daily_action_limit: 120,
        current_action_count: 30,
        last_action_reset_at: '2026-10-04T05:00:00Z', // Today (no reset)
        is_blocked: false,
      },
      {
        id: 'acc-blocked',
        username: 'blocked_user',
        platform: 'instagram',
        warm_up_stage: 2,
        warm_up_started_at: fiveDaysAgo,
        daily_action_limit: 5,
        current_action_count: 5,
        last_action_reset_at: '2026-10-03T10:00:00Z',
        is_blocked: true,
      },
    ];

    const updatesRecorded: Record<string, unknown>[] = [];

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'accounts') {
          return {
            select: vi.fn().mockResolvedValue({ data: accountsData, error: null }),
            update: vi.fn((payload) => ({
              eq: vi.fn((field, val) => {
                updatesRecorded.push({ field, val, payload });
                return Promise.resolve({ data: null, error: null });
              }),
            })),
          };
        }
        return {};
      }),
    };

    const scheduler = new AccountWarmupScheduler(mockConfig, mockSupabase as any);

    const cycleResult = await scheduler.poll(now);

    expect(cycleResult.processedCount).toBe(3);
    expect(cycleResult.resetCount).toBe(1); // acc-1 reset (acc-2 was today, acc-blocked was skipped)
    expect(cycleResult.advancedCount).toBe(1); // acc-1 advanced from Stage 2 to Stage 3
    expect(cycleResult.errors).toHaveLength(0);

    // Verify updates to acc-1
    expect(updatesRecorded).toHaveLength(1);
    expect(updatesRecorded[0].val).toBe('acc-1');
    expect(updatesRecorded[0].payload).toMatchObject({
      current_action_count: 0,
      last_action_reset_at: now.toISOString(),
      warm_up_stage: 3,
      daily_action_limit: 15,
    });

    // Check health snapshot
    const health = scheduler.getHealthSnapshot();
    expect(health.lastProcessedCount).toBe(3);
    expect(health.lastResetCount).toBe(1);
    expect(health.lastAdvancedCount).toBe(1);
    expect(health.errorCount).toBe(0);
    expect(health.lastRunAt).toBe(now.toISOString());
  });

  it('handles query and update failures gracefully', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockResolvedValue({ data: null, error: { message: 'Database connection failed' } }),
      })),
    };

    const scheduler = new AccountWarmupScheduler(mockConfig, mockSupabase as any);
    const result = await scheduler.poll();

    expect(result.processedCount).toBe(0);
    expect(result.errors).toContain('Failed to query accounts: Database connection failed');
    expect(scheduler.getHealthSnapshot().errorCount).toBe(1);
  });
});
