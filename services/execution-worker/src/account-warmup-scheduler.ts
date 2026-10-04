import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { WorkerConfig } from './run-claim-coordinator';

export interface WarmUpStageConfig {
  stage: number;
  label: string;
  minDays: number;
  recommendedLimit: number;
}

export const WARMUP_STAGE_CONFIG: Record<string, WarmUpStageConfig[]> = {
  instagram: [
    { stage: 1, label: 'Inactive', minDays: 0, recommendedLimit: 0 },
    { stage: 2, label: 'Day 1-3', minDays: 0, recommendedLimit: 5 },
    { stage: 3, label: 'Day 4-7', minDays: 4, recommendedLimit: 15 },
    { stage: 4, label: 'Ramping', minDays: 8, recommendedLimit: 40 },
    { stage: 5, label: 'Full Speed', minDays: 15, recommendedLimit: 100 },
  ],
  tiktok: [
    { stage: 1, label: 'Inactive', minDays: 0, recommendedLimit: 0 },
    { stage: 2, label: 'Day 1-3', minDays: 0, recommendedLimit: 8 },
    { stage: 3, label: 'Day 4-7', minDays: 4, recommendedLimit: 20 },
    { stage: 4, label: 'Ramping', minDays: 8, recommendedLimit: 50 },
    { stage: 5, label: 'Full Speed', minDays: 14, recommendedLimit: 120 },
  ],
  facebook: [
    { stage: 1, label: 'Inactive', minDays: 0, recommendedLimit: 0 },
    { stage: 2, label: 'Day 1-5', minDays: 0, recommendedLimit: 5 },
    { stage: 3, label: 'Day 6-12', minDays: 6, recommendedLimit: 15 },
    { stage: 4, label: 'Ramping', minDays: 13, recommendedLimit: 35 },
    { stage: 5, label: 'Full Speed', minDays: 21, recommendedLimit: 80 },
  ],
};

export function daysInWarmUp(warmUpStartedAt: string | null, now = new Date()): number {
  if (!warmUpStartedAt) return 0;
  const diffMs = now.getTime() - new Date(warmUpStartedAt).getTime();
  return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
}

export function computeRecommendedStage(
  platform: string,
  warmUpStartedAt: string | null,
  now = new Date()
): number {
  if (!warmUpStartedAt) return 1;
  const stages = WARMUP_STAGE_CONFIG[platform] ?? WARMUP_STAGE_CONFIG.instagram;
  const elapsed = daysInWarmUp(warmUpStartedAt, now);

  let recommended = 1;
  for (const s of stages) {
    if (s.stage > 1 && elapsed >= s.minDays) {
      recommended = s.stage;
    }
  }
  return recommended;
}

export function getRecommendedDailyLimit(platform: string, stage: number): number {
  const stages = WARMUP_STAGE_CONFIG[platform] ?? WARMUP_STAGE_CONFIG.instagram;
  const found = stages.find((s) => s.stage === stage);
  return found?.recommendedLimit ?? 0;
}

export function shouldResetDailyActionCount(lastResetAt: string | null, now = new Date()): boolean {
  if (!lastResetAt) return true;
  const last = new Date(lastResetAt);
  return (
    last.getUTCFullYear() !== now.getUTCFullYear() ||
    last.getUTCMonth() !== now.getUTCMonth() ||
    last.getUTCDate() !== now.getUTCDate()
  );
}

export interface AccountRecord {
  id: string;
  username: string;
  platform: string;
  warm_up_stage: number;
  warm_up_started_at: string | null;
  daily_action_limit: number;
  current_action_count: number;
  last_action_reset_at?: string | null;
  is_blocked: boolean;
}

export interface SchedulerCycleResult {
  processedCount: number;
  resetCount: number;
  advancedCount: number;
  errors: string[];
}

export class AccountWarmupScheduler {
  private readonly supabase: SupabaseClient;
  private timer: NodeJS.Timeout | null = null;
  private pollInFlight = false;
  private lastRunAt: string | null = null;
  private lastCycleResult: SchedulerCycleResult = {
    processedCount: 0,
    resetCount: 0,
    advancedCount: 0,
    errors: [],
  };

  constructor(config: WorkerConfig, supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient ?? createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
  }

  start(intervalMs = 60000) {
    console.log('[execution-worker] account warmup scheduler ready');
    this.timer = setInterval(() => void this.poll(), intervalMs);
    this.timer.unref();
    void this.poll();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getHealthSnapshot() {
    return {
      lastRunAt: this.lastRunAt,
      lastProcessedCount: this.lastCycleResult.processedCount,
      lastResetCount: this.lastCycleResult.resetCount,
      lastAdvancedCount: this.lastCycleResult.advancedCount,
      errorCount: this.lastCycleResult.errors.length,
    };
  }

  async poll(now = new Date()): Promise<SchedulerCycleResult> {
    if (this.pollInFlight) {
      return this.lastCycleResult;
    }

    this.pollInFlight = true;
    const result: SchedulerCycleResult = {
      processedCount: 0,
      resetCount: 0,
      advancedCount: 0,
      errors: [],
    };

    try {
      const { data: accounts, error } = await this.supabase
        .from('accounts')
        .select('*');

      if (error) {
        throw new Error(`Failed to query accounts: ${error.message}`);
      }

      const list = (accounts ?? []) as AccountRecord[];
      result.processedCount = list.length;

      for (const account of list) {
        if (account.is_blocked) continue;

        let needsUpdate = false;
        const updates: Partial<AccountRecord> = {};

        // 1. Check daily action count reset
        if (shouldResetDailyActionCount(account.last_action_reset_at ?? null, now)) {
          updates.current_action_count = 0;
          updates.last_action_reset_at = now.toISOString();
          result.resetCount++;
          needsUpdate = true;
        }

        // 2. Check stage advancement (only for active warm-up accounts in stages 2..4)
        if (account.warm_up_stage >= 2 && account.warm_up_stage < 5 && account.warm_up_started_at) {
          const recommended = computeRecommendedStage(account.platform, account.warm_up_started_at, now);
          if (recommended > account.warm_up_stage) {
            const recommendedLimit = getRecommendedDailyLimit(account.platform, recommended);
            updates.warm_up_stage = recommended;
            updates.daily_action_limit = Math.max(account.daily_action_limit, recommendedLimit);
            result.advancedCount++;
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          const { error: updateError } = await this.supabase
            .from('accounts')
            .update(updates)
            .eq('id', account.id);

          if (updateError) {
            result.errors.push(`Account ${account.id} update failed: ${updateError.message}`);
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(msg);
      console.error(`[execution-worker] warmup scheduler cycle failed: ${msg}`);
    } finally {
      this.lastRunAt = now.toISOString();
      this.lastCycleResult = result;
      this.pollInFlight = false;
    }

    return result;
  }
}
