import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./account-service-helpers', () => ({
  updateAccount: vi.fn(),
}));

import { updateAccount } from './account-service-helpers';
import {
  getLastAdvancementCheck,
  markAdvancementCheckPerformed,
  shouldRunDailyCheck,
  runDailyAdvancementCheck,
} from './account-warmup-scheduler';
import type { Account } from './database.types';

const mockUpdateAccount = vi.mocked(updateAccount);

describe('account-warmup-scheduler', () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(store)) {
      delete store[key];
    }
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const key of Object.keys(store)) {
          delete store[key];
        }
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('handles last advancement check storage', () => {
    expect(getLastAdvancementCheck()).toBeNull();
    const now = new Date('2026-10-04T12:00:00Z');
    markAdvancementCheckPerformed(now);
    expect(getLastAdvancementCheck()).toBe(now.toISOString());
  });

  it('determines if daily check should run', () => {
    expect(shouldRunDailyCheck()).toBe(true);

    const yesterday = new Date('2026-10-03T23:59:00Z');
    markAdvancementCheckPerformed(yesterday);
    const today = new Date('2026-10-04T10:00:00Z');
    expect(shouldRunDailyCheck(today)).toBe(true);

    markAdvancementCheckPerformed(today);
    const laterToday = new Date('2026-10-04T18:00:00Z');
    expect(shouldRunDailyCheck(laterToday)).toBe(false);
  });

  it('advances eligible accounts and updates daily action limit', async () => {
    mockUpdateAccount.mockResolvedValue({} as any);

    const now = new Date('2026-10-04T12:00:00Z');
    const eligibleAccount = {
      id: 'acc-advance',
      username: 'advance_user',
      platform: 'instagram' as const,
      warm_up_stage: 2,
      warm_up_started_at: new Date('2026-09-29T12:00:00Z').toISOString(), // 5 days ago (Day 4-7 threshold)
      daily_action_limit: 5,
      current_action_count: 2,
      is_blocked: false,
    };

    const result = await runDailyAdvancementCheck([eligibleAccount as Account], now);
    expect(result.advanced).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockUpdateAccount).toHaveBeenCalledWith('acc-advance', {
      warm_up_stage: 3,
      daily_action_limit: 15,
    });
    expect(getLastAdvancementCheck()).toBe(now.toISOString());
  });
});
