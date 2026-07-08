import type { SupabaseClient } from '@supabase/supabase-js';
import type { MacroStep } from '../../../src/contracts/macro';
import { checkActionBudget, getTodayActionCounts, type BudgetCheckResult } from '../../../src/lib/action-budget-enforcer.js';
import type { BudgetedAccountActionType } from '../../../src/lib/action-budget-types.js';
import type { Account, AccountActionHistory } from '../../../src/lib/database.types';

export const BUDGETED_ACTION_TYPES = new Set<string>(['like', 'follow', 'comment', 'post', 'share']);
export const HISTORY_ACTION_TYPES = new Set<string>(['like', 'follow', 'comment', 'post', 'share', 'instagram_pilot_open']);

export async function budgetCheckForStep(
  supabase: SupabaseClient,
  step: MacroStep,
  inputVariables: Record<string, unknown>
): Promise<BudgetCheckResult | null> {
  const actionType = step.params?.actionBudgetType;
  if (typeof actionType !== 'string' || !BUDGETED_ACTION_TYPES.has(actionType)) return null;

  const accountId = inputVariables?.accountId;
  if (typeof accountId !== 'string') return null;

  const { data: account } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', accountId)
    .maybeSingle();

  if (!account) return null;

  if ((account as Account).is_blocked) {
    return {
      allowed: false,
      dailyRemaining: 0,
      dailyBudget: 0,
      hourlyRemaining: 0,
      hourlyBudget: 0,
      reason: `Account blocked: ${(account as Account).detected_block_reason ?? 'unknown'}`,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data: history } = await supabase
    .from('account_action_history')
    .select('*')
    .eq('account_id', accountId)
    .gte('created_at', today.toISOString());

  const todayCounts = getTodayActionCounts((history ?? []) as AccountActionHistory[], accountId);
  return checkActionBudget(account as Account, actionType as BudgetedAccountActionType, todayCounts);
}

export async function recordStepAction(
  supabase: SupabaseClient,
  step: MacroStep,
  runId: string,
  inputVariables: Record<string, unknown>,
  success: boolean
): Promise<void> {
  const actionType = step.params?.actionHistoryType ?? step.params?.actionBudgetType;
  if (typeof actionType !== 'string' || !HISTORY_ACTION_TYPES.has(actionType)) return;

  const accountId = inputVariables?.accountId;
  if (typeof accountId !== 'string') return;

  try {
    await supabase.from('account_action_history').insert({
      account_id: accountId,
      action_type: actionType,
      step_id: null,
      source_run_id: runId,
      source_step_id: step.id,
      success,
    });

    if (success && BUDGETED_ACTION_TYPES.has(actionType)) {
      const { error: rpcError } = await supabase.rpc('increment_account_action_count', {
        p_account_id: accountId,
      });

      if (rpcError) {
        console.warn(
          `[execution-worker] run ${runId} step ${step.id} failed to increment action count:`,
          rpcError
        );
      }
    }
  } catch {
    /* Best-effort recording: don't fail the step if tracking fails. */
  }
}
