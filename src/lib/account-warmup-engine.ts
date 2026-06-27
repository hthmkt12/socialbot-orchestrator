/**
 * Account warm-up progression engine.
 *
 * Determines the current warm-up stage and recommended daily action limit
 * for social media accounts based on elapsed time since warm-up started.
 * Stages ramp action limits gradually to avoid bot detection on new accounts.
 */
import type { Account, AccountPlatform } from './database.types';

export interface WarmUpStage {
  stage: number;
  label: string;
  description: string;
  /** Min days since warm-up start to enter this stage. */
  minDays: number;
  /** Recommended max daily actions at this stage. */
  recommendedLimit: number;
}

/** Stage progression rules per platform. */
const STAGE_CONFIG: Record<AccountPlatform, WarmUpStage[]> = {
  instagram: [
    { stage: 1, label: 'Inactive', description: 'Account registered, not yet warming up', minDays: 0, recommendedLimit: 0 },
    { stage: 2, label: 'Day 1-3', description: 'Light browsing, 3-5 follows/likes per day', minDays: 0, recommendedLimit: 5 },
    { stage: 3, label: 'Day 4-7', description: 'Moderate engagement, 10-15 actions per day', minDays: 4, recommendedLimit: 15 },
    { stage: 4, label: 'Ramping', description: 'Increasing activity, 25-40 actions per day', minDays: 8, recommendedLimit: 40 },
    { stage: 5, label: 'Full Speed', description: 'Production-level engagement', minDays: 15, recommendedLimit: 100 },
  ],
  tiktok: [
    { stage: 1, label: 'Inactive', description: 'Account registered, not yet warming up', minDays: 0, recommendedLimit: 0 },
    { stage: 2, label: 'Day 1-3', description: 'Scroll and watch, 5-8 likes per day', minDays: 0, recommendedLimit: 8 },
    { stage: 3, label: 'Day 4-7', description: 'Moderate likes and follows', minDays: 4, recommendedLimit: 20 },
    { stage: 4, label: 'Ramping', description: 'Higher engagement volume', minDays: 8, recommendedLimit: 50 },
    { stage: 5, label: 'Full Speed', description: 'Production-level engagement', minDays: 14, recommendedLimit: 120 },
  ],
  facebook: [
    { stage: 1, label: 'Inactive', description: 'Account registered, not yet warming up', minDays: 0, recommendedLimit: 0 },
    { stage: 2, label: 'Day 1-5', description: 'Light browsing, 3-5 actions per day', minDays: 0, recommendedLimit: 5 },
    { stage: 3, label: 'Day 6-12', description: 'Moderate posting and engagement', minDays: 6, recommendedLimit: 15 },
    { stage: 4, label: 'Ramping', description: 'Growing activity', minDays: 13, recommendedLimit: 35 },
    { stage: 5, label: 'Full Speed', description: 'Production-level engagement', minDays: 21, recommendedLimit: 80 },
  ],
};

/** Returns stage config for a platform. */
export function getStageConfig(platform: AccountPlatform): WarmUpStage[] {
  return STAGE_CONFIG[platform];
}

/** Returns the stage definition for a given stage number. */
export function getStageInfo(platform: AccountPlatform, stage: number): WarmUpStage {
  const stages = STAGE_CONFIG[platform];
  return stages[Math.min(Math.max(stage, 1), stages.length) - 1];
}

/** Calculates days elapsed since warm-up started. Returns 0 if not started. */
export function daysInWarmUp(warmUpStartedAt: string | null, now = new Date()): number {
  if (!warmUpStartedAt) return 0;
  const started = new Date(warmUpStartedAt);
  const diffMs = now.getTime() - started.getTime();
  return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
}

/**
 * Computes what warm-up stage an account should be at based on elapsed days.
 * Returns the highest stage whose minDays threshold has been met.
 * Stage 1 (Inactive) is returned if warm-up hasn't started.
 */
export function computeRecommendedStage(account: Pick<Account, 'platform' | 'warm_up_started_at'>): number {
  if (!account.warm_up_started_at) return 1;

  const elapsed = daysInWarmUp(account.warm_up_started_at);
  const stages = STAGE_CONFIG[account.platform];

  let recommended = 1;
  for (const stage of stages) {
    if (stage.stage > 1 && elapsed >= stage.minDays) {
      recommended = stage.stage;
    }
  }
  return recommended;
}

/** Returns recommended daily action limit for the given account state. */
export function recommendedDailyLimit(account: Pick<Account, 'platform' | 'warm_up_stage'>): number {
  const info = getStageInfo(account.platform, account.warm_up_stage);
  return info.recommendedLimit;
}

/**
 * Checks whether an account can perform more actions today.
 * Returns `{ allowed: boolean; remaining: number; reason?: string }`.
 */
export function canPerformAction(account: Pick<Account, 'is_blocked' | 'daily_action_limit' | 'current_action_count' | 'warm_up_stage'>) {
  if (account.is_blocked) {
    return { allowed: false, remaining: 0, reason: 'Account is blocked' };
  }
  if (account.warm_up_stage === 1) {
    return { allowed: false, remaining: 0, reason: 'Account warm-up not started' };
  }
  const remaining = Math.max(0, account.daily_action_limit - account.current_action_count);
  if (remaining === 0) {
    return { allowed: false, remaining: 0, reason: 'Daily action limit reached' };
  }
  return { allowed: true, remaining };
}

/**
 * Returns a Supabase-compatible update payload to advance an account's warm-up.
 * Returns null if the account is already at the recommended stage or higher.
 */
export function computeWarmUpAdvancement(
  account: Pick<Account, 'platform' | 'warm_up_started_at' | 'warm_up_stage' | 'daily_action_limit'>,
) {
  const recommended = computeRecommendedStage(account);
  if (recommended <= account.warm_up_stage) return null;

  const newStageInfo = getStageInfo(account.platform, recommended);
  return {
    warm_up_stage: recommended,
    daily_action_limit: Math.max(account.daily_action_limit, newStageInfo.recommendedLimit),
  };
}
