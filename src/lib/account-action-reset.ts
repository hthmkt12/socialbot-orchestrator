/**
 * Daily action count reset for social accounts.
 *
 * Resets `current_action_count` to 0 when a new calendar day starts.
 * Also adjusts `daily_action_limit` based on current warm-up stage
 * if it has changed since the last reset.
 */
import { updateAccount } from './account-service-helpers';
import { getStageInfo } from './account-warmup-engine';
import type { Account, AccountPlatform } from './database.types';

export interface ResetResult {
  accountId: string;
  wasReset: boolean;
  previousCount: number;
}

/**
 * Checks if an account's action count needs to be reset for a new day.
 * Returns true when `last_action_reset_at` is null or from a previous date.
 */
export function shouldResetActionCount(
  lastResetAt: string | null,
  now = new Date(),
): boolean {
  if (!lastResetAt) return true;

  const last = new Date(lastResetAt);
  return (
    last.getUTCFullYear() !== now.getUTCFullYear() ||
    last.getUTCMonth() !== now.getUTCMonth() ||
    last.getUTCDate() !== now.getUTCDate()
  );
}

/**
 * Computes the correct daily action limit for an account based on
 * its warm-up stage and platform configuration.
 */
export function computeCorrectDailyLimit(
  platform: AccountPlatform,
  warmUpStage: number,
  currentLimit: number,
): number {
  if (warmUpStage < 2) return currentLimit;
  const stageInfo = getStageInfo(platform, warmUpStage);
  return Math.max(currentLimit, stageInfo.recommendedLimit);
}

/**
 * Resets the action count for a single account if a new day has started.
 * Returns what action was taken.
 */
export async function resetAccountActionCount(
  account: Pick<Account, 'id' | 'platform' | 'warm_up_stage' | 'current_action_count' | 'daily_action_limit' | 'last_action_reset_at'>,
  now = new Date(),
): Promise<ResetResult> {
  if (!shouldResetActionCount(account.last_action_reset_at, now)) {
    return { accountId: account.id, wasReset: false, previousCount: account.current_action_count };
  }

  const correctLimit = computeCorrectDailyLimit(
    account.platform,
    account.warm_up_stage,
    account.daily_action_limit,
  );

  await updateAccount(account.id, {
    current_action_count: 0,
    last_action_reset_at: now.toISOString(),
    ...(correctLimit !== account.daily_action_limit ? { daily_action_limit: correctLimit } : {}),
  });

  return { accountId: account.id, wasReset: true, previousCount: account.current_action_count };
}

export interface BatchResetResult {
  reset: number;
  skipped: number;
  errors: string[];
}

/**
 * Runs a daily reset check across all accounts.
 * Call this at app startup or from a periodic timer.
 * Safe to call multiple times — only resets once per calendar day per account.
 */
export async function runDailyActionReset(
  accounts: Pick<Account, 'id' | 'platform' | 'warm_up_stage' | 'current_action_count' | 'daily_action_limit' | 'last_action_reset_at'>[],
  now = new Date(),
): Promise<BatchResetResult> {
  let reset = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const account of accounts) {
    try {
      const result = await resetAccountActionCount(account, now);
      if (result.wasReset) reset++;
      else skipped++;
    } catch (err) {
      errors.push(`Account ${account.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { reset, skipped, errors };
}
