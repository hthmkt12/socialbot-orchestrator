/**
 * Warm-up advancement scheduler.
 *
 * Provides a daily check mechanism that can be triggered on app startup
 * or from the dashboard to automatically advance accounts whose warm-up
 * stage thresholds have been met.
 *
 * The scheduler tracks last-check time in localStorage to avoid
 * redundant advancement checks within the same day.
 */
import { updateAccount } from './account-service-helpers';
import { getAccountsReadyForAdvancement, buildAdvancementUpdates } from './account-warmup-auto-advance';
import type { Account } from './database.types';

const STORAGE_KEY = 'laixi_warmup_last_check';

/**
 * Returns the ISO date string of the last advancement check run,
 * or null if no check has been recorded.
 */
export function getLastAdvancementCheck(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Records that an advancement check was performed now.
 */
export function markAdvancementCheckPerformed(now = new Date()): void {
  try {
    localStorage.setItem(STORAGE_KEY, now.toISOString());
  } catch {
    // localStorage may be unavailable in some environments
  }
}

/**
 * Returns true if the last check was performed on a previous calendar date
 * (i.e., at least one full day has elapsed since the last check).
 */
export function shouldRunDailyCheck(now = new Date()): boolean {
  const lastCheck = getLastAdvancementCheck();
  if (!lastCheck) return true;

  const last = new Date(lastCheck);
  return (
    last.getUTCFullYear() !== now.getUTCFullYear() ||
    last.getUTCMonth() !== now.getUTCMonth() ||
    last.getUTCDate() !== now.getUTCDate()
  );
}

export interface DailyCheckResult {
  advanced: number;
  failed: number;
  errors: string[];
}

/**
 * Runs a single advancement check cycle:
 * 1. Identifies accounts ready to advance (stage >= 2, < 5, days threshold met)
 * 2. Updates each account to its recommended stage
 * 3. Records the check timestamp
 *
 * Returns a summary of what happened.
 *
 * Call this on app startup or from a periodic timer.
 */
export async function runDailyAdvancementCheck(
  accounts: Pick<Account, 'id' | 'username' | 'platform' | 'warm_up_stage' | 'warm_up_started_at' | 'daily_action_limit' | 'current_action_count' | 'is_blocked'>[],
): Promise<DailyCheckResult> {
  const ready = getAccountsReadyForAdvancement(accounts);
  if (ready.length === 0) {
    markAdvancementCheckPerformed(now);
    return { advanced: 0, failed: 0, errors: [] };
  }

  const updates = buildAdvancementUpdates(ready);
  let advanced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const update of updates) {
    try {
      await updateAccount(update.id, {
        warm_up_stage: update.warm_up_stage,
        daily_action_limit: update.daily_action_limit,
      });
      advanced++;
    } catch (err) {
      failed++;
      errors.push(`Account ${update.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  markAdvancementCheckPerformed(now);
  return { advanced, failed, errors };
}
