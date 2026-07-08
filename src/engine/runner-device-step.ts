import type { LaixiClient } from '../adapters/laixi/client';
import { executeStepOnDevice } from '../adapters/laixi/mapper';
import type { MacroStep } from '../contracts/macro';
import { handlePotentialBlock } from '../lib/account-block-detector';
import { recordAccountAction } from '../lib/account-service-helpers';
import type { AccountActionType, RunStepStatus } from '../lib/database.types';
import { supabase } from '../lib/supabase';
import { resolveParams } from './resolver';
import {
  buildRunnerDeviceStepError,
  finalizeFailedRunnerDeviceStep,
  shouldRetryRunnerDeviceStepError,
  waitForRunnerDeviceStepRetry,
} from './runner-device-step-helpers';
import { withTimeout } from './step-timeout';
import type { RunnerStepResult } from './runner-step-types';
import { buildStructuredError, type ExecutionContext, type StructuredError } from './types';

interface RunnerDeviceStepDeps {
  captureFailureScreenshot(step: MacroStep, ctx: ExecutionContext): Promise<string | null>;
  client: LaixiClient;
  ctx: ExecutionContext;
  persistStep(
    runId: string,
    step: MacroStep,
    deviceId: string,
    stepIndex: number,
    status: RunStepStatus,
    retryCount: number,
    output?: Record<string, unknown>,
    error?: string
  ): Promise<void>;
  persistStepFinal(
    runId: string,
    step: MacroStep,
    deviceId: string,
    stepIndex: number,
    status: RunStepStatus,
    retryCount: number,
    output?: Record<string, unknown>,
    errorPayload?: StructuredError | { code: string; message: string; timestamp: string },
    screenshotArtifactId?: string | null
  ): Promise<void>;
  step: MacroStep;
  stepIndex: number;
}

export async function executeRunnerDeviceStep({
  captureFailureScreenshot,
  client,
  ctx,
  persistStep,
  persistStepFinal,
  step,
  stepIndex,
}: RunnerDeviceStepDeps): Promise<RunnerStepResult> {
  if (step.policy?.requiresApproval && ctx.onApprovalNeeded) {
    await persistStep(ctx.runId, step, ctx.deviceId, stepIndex, 'WAITING_APPROVAL', 0);
    const approved = await ctx.onApprovalNeeded(step.id, `Approval required for ${step.type}`, step.type);
    if (!approved) {
      await persistStep(ctx.runId, step, ctx.deviceId, stepIndex, 'CANCELLED', 0);
      return { status: 'cancelled' };
    }
  }

  const maxRetries = Math.max(0, step.policy?.maxRetries ?? ctx.defaultMaxRetries ?? 0);
  const timeoutMs = step.policy?.timeoutMs ?? ctx.defaultTimeoutMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (ctx.cancellation.cancelled) {
      await persistStep(ctx.runId, step, ctx.deviceId, stepIndex, 'CANCELLED', attempt);
      return { status: 'cancelled' };
    }

    const status: RunStepStatus = attempt > 0 ? 'RETRYING' : 'RUNNING';
    await persistStep(ctx.runId, step, ctx.deviceId, stepIndex, status, attempt);

    const resolvedParams = resolveParams(
      step.params as Record<string, unknown>,
      ctx.inputVariables,
      ctx.stepOutputs
    );

    try {
      const result = await withTimeout(
        executeStepOnDevice(client, step, ctx.device, resolvedParams),
        step.id,
        timeoutMs
      );

      if (result.success) {
        ctx.stepOutputs.set(step.id, result.output);

        if (result.screenshotBase64 && ctx.onScreenshot) {
          await ctx.onScreenshot(step.id, result.screenshotBase64);
        }

        await persistStep(ctx.runId, step, ctx.deviceId, stepIndex, 'SUCCESS', attempt, result.output);
        await recordSelectedAccountActionIfPresent(ctx, step, resolvedParams, true);
        ctx.onStepComplete?.(step.id, 'SUCCESS', result.output);
        return { status: 'success' };
      }

      if (attempt < maxRetries) {
        await persistStep(
          ctx.runId,
          step,
          ctx.deviceId,
          stepIndex,
          'RETRYING',
          attempt,
          undefined,
          result.error
        );
        await waitForRunnerDeviceStepRetry(attempt);
        continue;
      }

      const error = buildStructuredError('STEP_FAILED', result.error || `Step ${step.id} failed`, {
        stepId: step.id,
        stepType: step.type,
        attempt,
        details: { resolvedParams, output: result.output },
      });
      await markSelectedAccountBlockedIfDetected(ctx, error.message);
      const failureResult = await finalizeFailedRunnerDeviceStep({
        attempt,
        captureFailureScreenshot,
        ctx,
        error,
        persistStepFinal,
        step,
        stepIndex,
      });
      ctx.onStepComplete?.(step.id, 'FAILED', result.output);
      return failureResult;
    } catch (err) {
      const error = buildRunnerDeviceStepError(err, step, attempt, timeoutMs);

      if (shouldRetryRunnerDeviceStepError(err, attempt, maxRetries)) {
        await persistStep(ctx.runId, step, ctx.deviceId, stepIndex, 'RETRYING', attempt, undefined, error.message);
        await waitForRunnerDeviceStepRetry(attempt);
        continue;
      }

      const failureResult = await finalizeFailedRunnerDeviceStep({
        attempt,
        captureFailureScreenshot,
        ctx,
        error,
        persistStepFinal,
        step,
        stepIndex,
      });
      await markSelectedAccountBlockedIfDetected(ctx, error.message);
      ctx.onStepComplete?.(step.id, 'FAILED', {});
      return failureResult;
    }
  }

  const error = buildStructuredError('STEP_FAILED', `Step ${step.id} did not execute`);
  await markSelectedAccountBlockedIfDetected(ctx, error.message);
  await persistStepFinal(ctx.runId, step, ctx.deviceId, stepIndex, 'FAILED', 0, undefined, error, null);
  return { status: 'failed', error };
}

async function markSelectedAccountBlockedIfDetected(ctx: ExecutionContext, errorMessage: string) {
  const accountId = ctx.inputVariables.accountId;
  if (typeof accountId !== 'string' || accountId.length === 0) return;

  await handlePotentialBlock(supabase, accountId, errorMessage);
}

async function recordSelectedAccountActionIfPresent(
  ctx: ExecutionContext,
  step: MacroStep,
  resolvedParams: Record<string, unknown>,
  success: boolean
) {
  const accountId = ctx.inputVariables.accountId;
  const actionType = resolvedParams.actionHistoryType ?? step.params.actionHistoryType ?? resolvedParams.actionBudgetType ?? step.params.actionBudgetType;
  if (typeof accountId !== 'string' || accountId.length === 0) return;
  if (!isAccountActionType(actionType)) return;

  try {
    await recordAccountAction({
      account_id: accountId,
      action_type: actionType,
      step_id: null,
      source_run_id: ctx.runId,
      source_step_id: step.id,
      success,
    });
    if (success && isBudgetedAccountActionType(actionType)) await incrementSelectedAccountActionCount(accountId);
  } catch {
    // Best effort: action history should never change execution outcome.
  }
}

function isAccountActionType(value: unknown): value is AccountActionType {
  return isBudgetedAccountActionType(value) || value === 'instagram_pilot_open';
}

function isBudgetedAccountActionType(value: unknown): value is Exclude<AccountActionType, 'instagram_pilot_open'> {
  return value === 'like' || value === 'follow' || value === 'comment' || value === 'post' || value === 'share';
}

async function incrementSelectedAccountActionCount(accountId: string) {
  const { data, error } = await supabase
    .from('accounts')
    .select('current_action_count')
    .eq('id', accountId)
    .maybeSingle();

  if (error || !data) return;

  const currentCount = typeof data.current_action_count === 'number' ? data.current_action_count : 0;
  await supabase
    .from('accounts')
    .update({
      current_action_count: currentCount + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', accountId);
}
