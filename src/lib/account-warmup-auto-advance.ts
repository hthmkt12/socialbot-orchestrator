/**
 * Warm-up auto-advancement engine.
 *
 * Determines which accounts are ready to advance to the next warm-up stage,
 * generates batch update payloads, and estimates when the next advancement
 * will be available.
 */
import type { Account } from './database.types';
import {
  computeRecommendedStage,
  daysInWarmUp,
  getStageConfig,
  getStageInfo,
} from './account-warmup-engine';

export interface AdvancementResult {
  accountId: string;
  username: string;
  platform: string;
  currentStage: number;
  targetStage: number;
  targetLabel: string;
  newDailyLimit: number;
}

export interface AdvancementCandidate {
  account: Account;
  result: AdvancementResult;
}

export interface NextAdvancementEstimate {
  accountId: string;
  username: string;
  platform: string;
  currentStage: number;
  nextStage: number;
  nextLabel: string;
  daysElapsed: number;
  daysRequired: number;
  daysRemaining: number;
  /** ISO date string when advancement is expected, or null if max stage. */
  estimatedDate: string | null;
}

/**
 * Returns accounts that are currently eligible to advance to a higher
 * warm-up stage based purely on elapsed days since warm-up started.
 *
 * An account is "ready to advance" when:
 * - It has started warm-up (stage >= 2)
 * - It has not reached the final stage (stage < 5)
 * - computeRecommendedStage() returns a higher stage than current
 */
export function getAccountsReadyForAdvancement(
  accounts: Pick<Account, 'id' | 'username' | 'platform' | 'warm_up_stage' | 'warm_up_started_at' | 'daily_action_limit' | 'current_action_count' | 'is_blocked'>[],
): AdvancementCandidate[] {
  const ready: AdvancementCandidate[] = [];

  for (const account of accounts) {
    if (account.is_blocked) continue;
    if (account.warm_up_stage < 2 || account.warm_up_stage >= 5) continue;

    const recommended = computeRecommendedStage({ platform: account.platform, warm_up_started_at: account.warm_up_started_at });
    if (recommended <= account.warm_up_stage) continue;

    const stageInfo = getStageInfo(account.platform, recommended);
    ready.push({
      account: account as Account,
      result: {
        accountId: account.id,
        username: account.username,
        platform: account.platform,
        currentStage: account.warm_up_stage,
        targetStage: recommended,
        targetLabel: stageInfo.label,
        newDailyLimit: Math.max(account.daily_action_limit, stageInfo.recommendedLimit),
      },
    });
  }

  return ready;
}

/**
 * Computes advancement estimates for all warm-up accounts.
 * Shows how close each account is to its next stage advancement.
 */
export function getAdvancementEstimates(
  accounts: Pick<Account, 'id' | 'username' | 'platform' | 'warm_up_stage' | 'warm_up_started_at'>[],
  now = new Date(),
): NextAdvancementEstimate[] {
  const estimates: NextAdvancementEstimate[] = [];

  for (const account of accounts) {
    if (account.warm_up_stage < 2 || account.warm_up_stage >= 5) continue;

    const stages = getStageConfig(account.platform);
    const nextStageIdx = account.warm_up_stage; // stage is 1-indexed, array is 0-indexed
    const nextStageConfig = stages[nextStageIdx]; // next stage config
    if (!nextStageConfig) continue;

    const elapsed = daysInWarmUp(account.warm_up_started_at, now);
    const daysRequired = nextStageConfig.minDays;
    const daysRemaining = Math.max(0, daysRequired - elapsed);

    const estimatedDate = new Date(now.getTime() + daysRemaining * 24 * 60 * 60 * 1000);

    estimates.push({
      accountId: account.id,
      username: account.username,
      platform: account.platform,
      currentStage: account.warm_up_stage,
      nextStage: nextStageConfig.stage,
      nextLabel: nextStageConfig.label,
      daysElapsed: elapsed,
      daysRequired,
      daysRemaining,
      estimatedDate: estimatedDate.toISOString(),
    });
  }

  return estimates;
}

/**
 * Builds batch update payloads for advancing ready accounts.
 * Each entry is `{ id, ...updates }` compatible with useUpdateAccount.
 */
export function buildAdvancementUpdates(
  candidates: AdvancementCandidate[],
): { id: string; warm_up_stage: number; daily_action_limit: number }[] {
  return candidates.map((c) => ({
    id: c.result.accountId,
    warm_up_stage: c.result.targetStage,
    daily_action_limit: c.result.newDailyLimit,
  }));
}
