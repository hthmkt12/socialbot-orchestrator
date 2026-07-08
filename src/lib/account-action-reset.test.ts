import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('./account-service-helpers', () => ({
  updateAccount: vi.fn(),
}));

import type { Account } from './database.types';
import { updateAccount } from './account-service-helpers';
import {
  shouldResetActionCount,
  computeCorrectDailyLimit,
  resetAccountActionCount,
  runDailyActionReset,
} from './account-action-reset';

const mockUpdateAccount = vi.mocked(updateAccount);

type ResetAccountFixture = Pick<Account, 'id' | 'platform' | 'warm_up_stage' | 'current_action_count' | 'daily_action_limit' | 'last_action_reset_at'>;
type UpdateAccountResult = Awaited<ReturnType<typeof updateAccount>>;

describe('shouldResetActionCount', () => {
  it('returns true when lastResetAt is null', () => {
    expect(shouldResetActionCount(null)).toBe(true);
  });

  it('returns true when last reset was yesterday', () => {
    const now = new Date('2026-06-29T12:00:00Z');
    const yesterday = '2026-06-28T23:59:00Z';
    expect(shouldResetActionCount(yesterday, now)).toBe(true);
  });

  it('returns false when last reset was today', () => {
    const now = new Date('2026-06-29T12:00:00Z');
    const today = '2026-06-29T08:00:00Z';
    expect(shouldResetActionCount(today, now)).toBe(false);
  });

  it('returns false for same day different hour', () => {
    const now = new Date('2026-06-29T23:00:00Z');
    const earlierToday = '2026-06-29T01:00:00Z';
    expect(shouldResetActionCount(earlierToday, now)).toBe(false);
  });

  it('returns true across month boundary', () => {
    const now = new Date('2026-07-01T00:00:00Z');
    const lastMonth = '2026-06-30T23:59:00Z';
    expect(shouldResetActionCount(lastMonth, now)).toBe(true);
  });

  it('returns true across year boundary', () => {
    const now = new Date('2027-01-01T00:00:00Z');
    const lastYear = '2026-12-31T23:59:00Z';
    expect(shouldResetActionCount(lastYear, now)).toBe(true);
  });
});

describe('computeCorrectDailyLimit', () => {
  it('returns current limit when warm_up_stage < 2', () => {
    expect(computeCorrectDailyLimit('instagram', 1, 100)).toBe(100);
  });

  it('returns higher of current and recommended limit', () => {
    expect(computeCorrectDailyLimit('instagram', 3, 10)).toBe(15);
  });

  it('keeps current limit if higher than recommended', () => {
    expect(computeCorrectDailyLimit('instagram', 4, 100)).toBe(100);
  });

  it('uses correct limits per platform', () => {
    expect(computeCorrectDailyLimit('tiktok', 3, 5)).toBe(20);
    expect(computeCorrectDailyLimit('facebook', 3, 5)).toBe(15);
  });
});

describe('resetAccountActionCount', () => {
  const baseAccount: ResetAccountFixture = {
    id: 'acc-1',
    platform: 'instagram' as const,
    warm_up_stage: 3,
    current_action_count: 45,
    daily_action_limit: 100,
    last_action_reset_at: '2026-06-28T12:00:00Z',
  };

  beforeEach(() => {
    mockUpdateAccount.mockReset();
    mockUpdateAccount.mockResolvedValue({ id: 'acc-1' } as UpdateAccountResult);
  });

  it('skips reset when already reset today', async () => {
    const now = new Date('2026-06-28T14:00:00Z');
    const result = await resetAccountActionCount(
      { ...baseAccount, last_action_reset_at: '2026-06-28T12:00:00Z' },
      now,
    );
    expect(result.wasReset).toBe(false);
    expect(result.previousCount).toBe(45);
    expect(mockUpdateAccount).not.toHaveBeenCalled();
  });

  it('resets count when new day starts', async () => {
    const now = new Date('2026-06-29T14:00:00Z');
    const result = await resetAccountActionCount(baseAccount, now);
    expect(result.wasReset).toBe(true);
    expect(result.previousCount).toBe(45);
    expect(mockUpdateAccount).toHaveBeenCalledWith('acc-1', {
      current_action_count: 0,
      last_action_reset_at: now.toISOString(),
    });
  });

  it('updates daily_limit when recommended is higher', async () => {
    const now = new Date('2026-06-29T14:00:00Z');
    const account = { ...baseAccount, daily_action_limit: 5 };
    const result = await resetAccountActionCount(account, now);
    expect(result.wasReset).toBe(true);
    expect(mockUpdateAccount).toHaveBeenCalledWith('acc-1', expect.objectContaining({
      daily_action_limit: 15,
    }));
  });

  it('does not reduce daily_limit when current is higher than recommended', async () => {
    const now = new Date('2026-06-29T14:00:00Z');
    const account = { ...baseAccount, daily_action_limit: 200 };
    const result = await resetAccountActionCount(account, now);
    expect(result.wasReset).toBe(true);
    expect(mockUpdateAccount).toHaveBeenCalledWith('acc-1', expect.not.objectContaining({
      daily_action_limit: expect.anything(),
    }));
  });
});

describe('runDailyActionReset', () => {
  const makeAccount = (id: string, overrides: Partial<ResetAccountFixture> = {}): ResetAccountFixture => ({
    id,
    platform: 'instagram' as const,
    warm_up_stage: 3,
    current_action_count: 30,
    daily_action_limit: 100,
    last_action_reset_at: '2026-06-28T12:00:00Z',
    ...overrides,
  });

  beforeEach(() => {
    mockUpdateAccount.mockReset();
    mockUpdateAccount.mockResolvedValue({ id: 'mock' } as UpdateAccountResult);
  });

  it('resets all accounts on a new day', async () => {
    const now = new Date('2026-06-29T12:00:00Z');
    const accounts = [makeAccount('a1'), makeAccount('a2'), makeAccount('a3')];
    const result = await runDailyActionReset(accounts, now);
    expect(result.reset).toBe(3);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('skips accounts already reset today', async () => {
    const now = new Date('2026-06-28T14:00:00Z');
    const accounts = [makeAccount('a1', { last_action_reset_at: '2026-06-28T10:00:00Z' })];
    const result = await runDailyActionReset(accounts, now);
    expect(result.reset).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('collects errors without throwing', async () => {
    const now = new Date('2026-06-29T12:00:00Z');
    mockUpdateAccount.mockRejectedValue(new Error('Network error'));
    const accounts = [makeAccount('a1')];
    const result = await runDailyActionReset(accounts, now);
    expect(result.reset).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Network error');
  });

  it('handles mixed results', async () => {
    const now = new Date('2026-06-29T12:00:00Z');
    mockUpdateAccount
      .mockResolvedValueOnce({ id: 'a1' } as UpdateAccountResult)
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce({ id: 'a3' } as UpdateAccountResult);
    const accounts = [makeAccount('a1'), makeAccount('a2'), makeAccount('a3')];
    const result = await runDailyActionReset(accounts, now);
    expect(result.reset).toBe(2);
    expect(result.errors).toHaveLength(1);
  });
});
