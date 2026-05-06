import type { MacroStep } from '../contracts/macro';
import { evaluateCondition, resolveTemplate } from './resolver';
import type { RunnerStepFlowDeps, RunnerStepFlowResult, RunnerStepResult } from './runner-step-types';
import type { ExecutionContext } from './types';

type RunNestedSteps = (
  steps: MacroStep[],
  ctx: ExecutionContext,
  baseIndex: number,
  deps: RunnerStepFlowDeps
) => Promise<RunnerStepFlowResult>;

export async function handleConditionalRunnerStep(
  step: MacroStep,
  ctx: ExecutionContext,
  stepIndex: number,
  deps: RunnerStepFlowDeps,
  runNestedSteps: RunNestedSteps
): Promise<RunnerStepResult['status']> {
  const params = step.params as Record<string, unknown>;
  const left = resolveTemplate(String(params.left ?? ''), ctx.inputVariables, ctx.stepOutputs);
  const right = resolveTemplate(String(params.right ?? ''), ctx.inputVariables, ctx.stepOutputs);
  const operator = String(params.operator ?? 'equals');
  const conditionMet = evaluateCondition(left, operator, right);

  const output = { conditionMet, left, operator, right };
  ctx.stepOutputs.set(step.id, output);
  await deps.persistStep(ctx.runId, step, ctx.deviceId, stepIndex, 'SUCCESS', 0, output);

  const takenBranch = conditionMet ? step.then : step.else;
  const skippedBranch = conditionMet ? step.else : step.then;
  const takenCount = takenBranch ? deps.countSteps(takenBranch) : 0;

  if (takenBranch?.length) {
    const { aborted } = await runNestedSteps(takenBranch, ctx, stepIndex + 1, deps);
    if (aborted && ctx.cancellation.cancelled) return 'cancelled';
    if (aborted) return 'failed';
  }

  if (skippedBranch?.length) {
    await Promise.all(
      skippedBranch.map((branchStep, branchIndex) =>
        deps.persistStep(
          ctx.runId,
          branchStep,
          ctx.deviceId,
          stepIndex + 1 + takenCount + branchIndex,
          'SKIPPED',
          0
        )
      )
    );
  }

  return 'success';
}

export async function handleApprovalCheckpointRunnerStep(
  step: MacroStep,
  ctx: ExecutionContext,
  stepIndex: number,
  deps: RunnerStepFlowDeps
): Promise<RunnerStepResult['status']> {
  const reason = String((step.params as Record<string, unknown>).reason ?? 'Approval required');
  await deps.persistStep(ctx.runId, step, ctx.deviceId, stepIndex, 'WAITING_APPROVAL', 0);

  if (ctx.onApprovalNeeded) {
    const approved = await ctx.onApprovalNeeded(step.id, reason, step.type);
    if (!approved) {
      await deps.persistStep(ctx.runId, step, ctx.deviceId, stepIndex, 'CANCELLED', 0);
      return 'cancelled';
    }
  }

  await deps.persistStep(
    ctx.runId,
    step,
    ctx.deviceId,
    stepIndex,
    'SUCCESS',
    0,
    { approved: true, reason }
  );
  return 'success';
}
