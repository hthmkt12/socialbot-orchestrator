import type { MacroStep } from '../contracts/macro';
import type { ExecutionContext } from './types';
import {
  handleApprovalCheckpointRunnerStep,
  handleConditionalRunnerStep,
} from './runner-control-flow';
import type { RunnerStepFlowDeps, RunnerStepFlowResult, RunnerStepResult } from './runner-step-types';

export async function runStepsWithFlow(
  steps: MacroStep[],
  ctx: ExecutionContext,
  baseIndex: number,
  deps: RunnerStepFlowDeps
): Promise<RunnerStepFlowResult> {
  let completed = 0;
  let lastError = undefined;
  let failureScreenshotId: string | null | undefined;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepIndex = baseIndex + i;

    if (ctx.cancellation.cancelled) {
      await deps.persistStep(ctx.runId, step, ctx.deviceId, stepIndex, 'CANCELLED', 0);
      return { completed, aborted: true, lastError };
    }

    ctx.onStepStart?.(step.id, stepIndex);
    const result = await executeFlowStep(step, ctx, stepIndex, deps);

    if (result.status === 'success' || result.status === 'skipped') {
      completed++;
      continue;
    }

    if (result.status === 'cancelled' || result.status === 'waiting_approval') {
      return { completed, aborted: true, lastError };
    }

    lastError = result.error;
    failureScreenshotId = result.failureScreenshotId;

    if (ctx.onErrorPolicy === 'continue' || ctx.onErrorPolicy === 'skip') {
      continue;
    }

    return { completed, aborted: true, lastError, failureScreenshotId };
  }

  return { completed, aborted: false, lastError, failureScreenshotId };
}

export function countRunnerSteps(steps: MacroStep[]): number {
  let count = 0;
  for (const step of steps) {
    count++;
    if (step.then) count += countRunnerSteps(step.then);
    if (step.else) count += countRunnerSteps(step.else);
    if (step.steps) count += countRunnerSteps(step.steps);
  }
  return count;
}

async function executeFlowStep(
  step: MacroStep,
  ctx: ExecutionContext,
  stepIndex: number,
  deps: RunnerStepFlowDeps
): Promise<RunnerStepResult> {
  if (step.type === 'conditional') {
    const status = await handleConditionalRunnerStep(step, ctx, stepIndex, deps, runStepsWithFlow);
    return { status };
  }

  if (step.type === 'group' && step.steps) {
    return handleGroupStep(step, ctx, stepIndex, deps);
  }

  if (step.type === 'approval_checkpoint') {
    const status = await handleApprovalCheckpointRunnerStep(step, ctx, stepIndex, deps);
    return { status };
  }

  return deps.executeDeviceStep(step, ctx, stepIndex);
}

async function handleGroupStep(
  step: MacroStep,
  ctx: ExecutionContext,
  stepIndex: number,
  deps: RunnerStepFlowDeps
): Promise<RunnerStepResult> {
  await deps.persistStep(ctx.runId, step, ctx.deviceId, stepIndex, 'RUNNING', 0);

  const { completed, aborted, lastError, failureScreenshotId } = await runStepsWithFlow(
    step.steps ?? [],
    ctx,
    stepIndex + 1,
    deps
  );

  if (aborted && ctx.cancellation.cancelled) {
    await deps.persistStep(ctx.runId, step, ctx.deviceId, stepIndex, 'CANCELLED', 0);
    return { status: 'cancelled' };
  }

  if (aborted) {
    await deps.persistStep(
      ctx.runId,
      step,
      ctx.deviceId,
      stepIndex,
      'FAILED',
      0,
      undefined,
      lastError ? JSON.stringify(lastError) : 'Group step failed'
    );
    return { status: 'failed', error: lastError, failureScreenshotId };
  }

  const groupName = (step.params as Record<string, unknown>)?.name;
  await deps.persistStep(
    ctx.runId,
    step,
    ctx.deviceId,
    stepIndex,
    'SUCCESS',
    0,
    { groupName, stepsCompleted: completed }
  );
  return { status: 'success' };
}
