/**
 * React hook for warm-up auto-advancement.
 *
 * Provides ready-to-advance detection, batch advancement mutation,
 * and estimation of upcoming stage transitions.
 */
import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateAccount } from '../lib/account-service-helpers';
import {
  getAccountsReadyForAdvancement,
  getAdvancementEstimates,
  buildAdvancementUpdates,
} from '../lib/account-warmup-auto-advance';
import type { Account } from '../lib/database.types';
import type { AdvancementResult, NextAdvancementEstimate } from '../lib/account-warmup-auto-advance';

export interface WarmUpAutoAdvanceState {
  /** Accounts eligible for stage advancement right now. */
  readyAccounts: AdvancementResult[];
  /** Advancement timeline for all warming-up accounts. */
  estimates: NextAdvancementEstimate[];
  /** Total number of accounts in warm-up (stages 2-4). */
  warmingUpCount: number;
  /** Count of accounts at full speed (stage 5). */
  fullSpeedCount: number;
}

/**
 * Derives auto-advance state from a list of accounts.
 * Pure computation — no side effects.
 */
export function useWarmUpAdvancementState(
  accounts: Account[] | undefined,
): WarmUpAutoAdvanceState {
  return useMemo(() => {
    if (!accounts) {
      return { readyAccounts: [], estimates: [], warmingUpCount: 0, fullSpeedCount: 0 };
    }

    const ready = getAccountsReadyForAdvancement(accounts);
    const estimates = getAdvancementEstimates(accounts);
    const warmingUpCount = accounts.filter((a) => a.warm_up_stage >= 2 && a.warm_up_stage < 5).length;
    const fullSpeedCount = accounts.filter((a) => a.warm_up_stage >= 5).length;

    return {
      readyAccounts: ready.map((c) => c.result),
      estimates,
      warmingUpCount,
      fullSpeedCount,
    };
  }, [accounts]);
}

/**
 * Mutation that advances a batch of accounts to their recommended stages.
 * Calls updateAccount for each candidate sequentially.
 */
export function useAdvanceAccounts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (candidates: AdvancementResult[]) => {
      const updates = buildAdvancementUpdates(
        candidates.map((r) => ({
          result: r,
          account: {} as Account,
        })),
      );

      const results: { id: string; success: boolean; error?: string }[] = [];
      for (const update of updates) {
        try {
          await updateAccount(update.id, {
            warm_up_stage: update.warm_up_stage,
            daily_action_limit: update.daily_action_limit,
          });
          results.push({ id: update.id, success: true });
        } catch (err) {
          results.push({ id: update.id, success: false, error: String(err) });
        }
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}
