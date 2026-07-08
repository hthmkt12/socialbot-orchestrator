import type { SupabaseClient } from '@supabase/supabase-js';
import type { MacroDefinition, MacroStep } from '../../../src/contracts/macro';
import type { Device } from '../../../src/lib/database.types';
import { evaluateCondition, resolveParams, resolveTemplate } from '../../../src/engine/resolver.js';
import { ExecutionContext } from './engine/execution-context.js';
import { StepTimeoutError, withTimeout } from '../../../src/engine/step-timeout.js';
import { applyAntiDetection, randomDelayMs } from '../../../src/lib/anti-detection-helpers.js';
import { checkActionBudget, getTodayActionCounts, type BudgetCheckResult } from '../../../src/lib/action-budget-enforcer.js';
import type { BudgetedAccountActionType } from '../../../src/lib/action-budget-types.js';
import { handlePotentialBlock } from '../../../src/lib/account-block-detector.js';
import type { Account, AccountActionHistory } from '../../../src/lib/database.types';
import type { DeviceStepBackend } from './device-step-backend.js';
import {
  getRetryDelayMs,
  normalizeRetryBackoffPolicy,
  shouldRetryWithBackoff,
  type RetryBackoffPolicy,
} from './retry-backoff-policy.js';
import {
  createLogArtifact,
  createApprovalRequest,
  createScreenshotArtifact,
  isRunCancelled,
  loadLatestApprovalForStep,
  markOwnedRunStatus,
} from './worker-run-store.js';
import { loadPersistedRunSteps, persistRunStep, type StoredRunStepRecord } from './worker-step-store.js';

type StepExecutionStatus = 'SUCCESS' | 'SKIPPED' | 'FAILED' | 'CANCELLED' | 'WAITING_APPROVAL';
type TraversalStatus = 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'WAITING_APPROVAL';
type ApprovalGateStatus = 'APPROVED' | 'WAITING_APPROVAL' | 'CANCELLED';

export interface RunnerParams {
  supabase: SupabaseClient;
  backend: DeviceStepBackend;
  runId: string;
  claimToken: string;
  device: Device;
  definition: MacroDefinition;
  retryBackoffPolicy?: RetryBackoffPolicy;
  triggeredByUserId: string;
  inputVariables: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractInlineLogText(output: Record<string, unknown>) {
  const candidates = [output.result, output.output, output.message];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return null;
}

export class SingleDeviceStepRunner {
  private readonly stepOutputs = new Map<string, Record<string, unknown>>();
  private readonly persistedSteps = new Map<string, StoredRunStepRecord>();
  private executionContext!: ExecutionContext;

  constructor(private readonly params: RunnerParams) {}

  async run() {
    this.executionContext = new ExecutionContext(this.params.inputVariables);
    await this.hydratePersistedState();
    const completed = await this.runSteps(this.params.definition.steps, 0);
    return { totalSteps: this.countSteps(this.params.definition.steps), ...completed };
  }

  private async hydratePersistedState() {
    const persisted = await loadPersistedRunSteps(this.params.supabase, this.params.runId, this.params.device.id);
    for (const [stepId, record] of persisted.entries()) {
      this.persistedSteps.set(stepId, record);
      if (record.status === 'SUCCESS' && isRecord(record.output)) {
        this.stepOutputs.set(stepId, record.output);
      }
    }
  }

  private async runSteps(steps: MacroStep[], baseIndex: number): Promise<{ completedSteps: number; status: TraversalStatus }> {
    let completedSteps = 0;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const existing = this.persistedSteps.get(step.id);

      if (await isRunCancelled(this.params.supabase, this.params.runId, this.params.claimToken)) {
        await this.saveStep({
          runId: this.params.runId,
          step,
          deviceId: this.params.device.id,
          stepIndex: baseIndex + i,
          status: 'CANCELLED',
          retryCount: existing?.retryCount ?? 0,
        });
        return { completedSteps, status: 'CANCELLED' };
      }

      if (existing?.status === 'FAILED') return { completedSteps, status: 'FAILED' };
      if (existing?.status === 'CANCELLED') return { completedSteps, status: 'CANCELLED' };
      if (this.shouldSkipStep(step, existing)) {
        completedSteps += 1;
        continue;
      }

      const result = await this.executeStep(step, baseIndex + i);
      if (result.status === 'SUCCESS' || result.status === 'SKIPPED') {
        completedSteps += 1;

        /* Anti-detection cooldown: pause between steps to simulate human pacing.
           Only applies when antiDetection config is set and step actually ran. */
        if (result.status === 'SUCCESS' && this.params.definition.antiDetection && i < steps.length - 1) {
          const [minCd, maxCd] = this.params.definition.antiDetection.cooldownBetweenActionsMs;
          await new Promise((r) => setTimeout(r, randomDelayMs(minCd, maxCd)));
        }

        continue;
      }
      return { completedSteps, status: result.status };
    }

    return { completedSteps, status: 'COMPLETED' };
  }

  private shouldSkipStep(step: MacroStep, existing?: StoredRunStepRecord) {
    if (!existing || (existing.status !== 'SUCCESS' && existing.status !== 'SKIPPED')) return false;
    return step.type !== 'conditional';
  }

  private async executeStep(step: MacroStep, stepIndex: number): Promise<{ status: StepExecutionStatus }> {
    if (step.type === 'conditional') return this.handleConditional(step, stepIndex);
    if (step.type === 'group' && step.steps) return this.handleGroup(step, stepIndex);
    if (step.type === 'loop' && step.steps) return this.handleLoop(step, stepIndex);
    if (step.type === 'try_catch' && step.steps) return this.handleTryCatch(step, stepIndex);
    if (step.type === 'while_loop' && step.steps) return this.handleWhileLoop(step, stepIndex);
    if (step.type === 'foreach' && step.steps) return this.handleForeachLoop(step, stepIndex);
    if (step.type === 'approval_checkpoint') return this.handleApprovalCheckpoint(step, stepIndex);
    if (step.policy?.requiresApproval) {
      const gate = await this.resolveApprovalGate(step, stepIndex, `Approval required for ${step.type}`);
      if (gate !== 'APPROVED') return { status: gate === 'WAITING_APPROVAL' ? 'WAITING_APPROVAL' : 'CANCELLED' };
    }
    return this.executeDeviceStepWithRetry(step, stepIndex);
  }

  private clearPersistedSteps(steps: MacroStep[]) {
    for (const step of steps) {
      this.persistedSteps.delete(step.id);
      if (step.steps) {
        this.clearPersistedSteps(step.steps);
      }
      if (step.then) {
        this.clearPersistedSteps(step.then);
      }
      if (step.else) {
        this.clearPersistedSteps(step.else);
      }
      if (step.catch) {
        this.clearPersistedSteps(step.catch);
      }
    }
  }

  private async handleLoop(step: MacroStep, stepIndex: number): Promise<{ status: StepExecutionStatus }> {
    const loopCount = Number(resolveTemplate(String(step.params?.count ?? '1'), this.params.inputVariables, this.stepOutputs)) || 1;
    
    await this.saveStep({
      runId: this.params.runId,
      step,
      deviceId: this.params.device.id,
      stepIndex,
      status: 'RUNNING',
      retryCount: 0,
    });

    let localCompleted = 0;
    
    for (let i = 0; i < loopCount; i++) {
      if (step.steps) {
        this.clearPersistedSteps(step.steps);
      }
      const res = await this.executeSubSequence(step.steps || [], stepIndex + localCompleted + 1);
      localCompleted += res.completedSteps;
      if (res.status !== 'COMPLETED') {
        await this.saveStep({
          runId: this.params.runId,
          step,
          deviceId: this.params.device.id,
          stepIndex,
          status: res.status,
          retryCount: 0,
        });
        return { status: res.status };
      }
    }

    await this.saveStep({
      runId: this.params.runId,
      step,
      deviceId: this.params.device.id,
      stepIndex,
      status: 'SUCCESS',
      retryCount: 0,
    });
    return { status: 'SUCCESS' };
  }

  private async handleTryCatch(step: MacroStep, stepIndex: number): Promise<{ status: StepExecutionStatus }> {
    await this.saveStep({
      runId: this.params.runId,
      step,
      deviceId: this.params.device.id,
      stepIndex,
      status: 'RUNNING',
      retryCount: 0,
    });

    const tryRes = await this.runSteps(step.steps ?? [], stepIndex + 1);

    if (tryRes.status === 'FAILED') {
      // Caught the error, run the catch block
      if (step.catch && step.catch.length > 0) {
         const catchRes = await this.runSteps(step.catch, stepIndex + 1 + tryRes.completedSteps);
         if (catchRes.status !== 'COMPLETED') {
            await this.saveStep({
              runId: this.params.runId,
              step,
              deviceId: this.params.device.id,
              stepIndex,
              status: catchRes.status === 'WAITING_APPROVAL' ? 'WAITING_APPROVAL' : 'FAILED',
              retryCount: 0,
            });
            return { status: catchRes.status === 'WAITING_APPROVAL' ? 'WAITING_APPROVAL' : 'FAILED' };
         }
      }

      // Override failure because we caught it
      await this.saveStep({
        runId: this.params.runId,
        step,
        deviceId: this.params.device.id,
        stepIndex,
        status: 'SUCCESS',
        retryCount: 0,
        output: { caughtError: true }
      });
      return { status: 'SUCCESS' };
    }

    if (tryRes.status !== 'COMPLETED') {
      await this.saveStep({
        runId: this.params.runId,
        step,
        deviceId: this.params.device.id,
        stepIndex,
        status: tryRes.status === 'WAITING_APPROVAL' ? 'WAITING_APPROVAL' : 'CANCELLED',
        retryCount: 0,
      });
      return { status: tryRes.status === 'WAITING_APPROVAL' ? 'WAITING_APPROVAL' : 'CANCELLED' };
    }

    await this.saveStep({
      runId: this.params.runId,
      step,
      deviceId: this.params.device.id,
      stepIndex,
      status: 'SUCCESS',
      retryCount: 0,
    });
    return { status: 'SUCCESS' };
  }


  private async handleForeachLoop(step: MacroStep, stepIndex: number): Promise<{ status: StepExecutionStatus }> {
    const arraySourceVar = String(step.params?.arraySourceVar ?? '');
    const itemName = String(step.params?.itemName ?? 'item');
    
    // Resolve the array source variable, which could be from inputs or step outputs
    // We treat arraySourceVar as a template string, e.g. "{{hashtags}}"
    let rawArrayValue: unknown;
    if (arraySourceVar.includes('{{') && arraySourceVar.includes('}}')) {
       // if it's templated, we can try to resolve it directly from the context, 
       // but typically it might just be the variable name like "hashtags"
       // Let's check executionContext first
       const cleanVar = arraySourceVar.replace(/[{}]/g, '');
       rawArrayValue = this.executionContext.get(cleanVar);
       if (!rawArrayValue) {
           rawArrayValue = this.params.inputVariables[cleanVar];
       }
    } else {
       rawArrayValue = this.executionContext.get(arraySourceVar) ?? this.params.inputVariables[arraySourceVar];
    }
    
    // Parse it if it's a JSON string, or use directly if it's an array
    let items: unknown[] = [];
    if (Array.isArray(rawArrayValue)) {
      items = rawArrayValue;
    } else if (typeof rawArrayValue === 'string') {
      try {
        const parsed = JSON.parse(rawArrayValue);
        if (Array.isArray(parsed)) items = parsed;
        else items = rawArrayValue.split(',').map(s => s.trim());
      } catch {
        items = rawArrayValue.split(',').map(s => s.trim());
      }
    }

    await this.saveStep({
      runId: this.params.runId,
      step,
      deviceId: this.params.device.id,
      stepIndex,
      status: 'RUNNING',
      retryCount: 0,
    });

    let localCompleted = 0;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      // Inject the current item into the context and inputVariables so it's available for this iteration
      this.executionContext.set(itemName, item);
      const originalInput = this.params.inputVariables[itemName];
      this.params.inputVariables[itemName] = item;
      
      if (step.steps) {
        this.clearPersistedSteps(step.steps);
      }
      const res = await this.executeSubSequence(step.steps || [], stepIndex + localCompleted + 1);
      localCompleted += res.completedSteps;
      
      // Restore previous state if needed, though for a loop we just overwrite
      if (originalInput !== undefined) {
         this.params.inputVariables[itemName] = originalInput;
      } else {
         delete this.params.inputVariables[itemName];
      }

      if (res.status !== 'COMPLETED') {
        await this.saveStep({
          runId: this.params.runId,
          step,
          deviceId: this.params.device.id,
          stepIndex,
          status: res.status,
          retryCount: 0,
        });
        return { status: res.status };
      }
    }

    await this.saveStep({
      runId: this.params.runId,
      step,
      deviceId: this.params.device.id,
      stepIndex,
      status: 'SUCCESS',
      retryCount: 0,
      output: { iterationsCompleted: items.length }
    });
    return { status: 'SUCCESS' };
  }

  // Helper method extracted from handleLoop and used in foreach
  private async executeSubSequence(steps: MacroStep[], startIndex: number): Promise<{ completedSteps: number; status: TraversalStatus }> {
     return this.runSteps(steps, startIndex);
  }

  private async handleWhileLoop(step: MacroStep, stepIndex: number): Promise<{ status: StepExecutionStatus }> {
    const maxIter = Number(resolveTemplate(String(step.params.maxIterations ?? '100'), this.params.inputVariables, this.stepOutputs)) || 100;

    await this.saveStep({
      runId: this.params.runId,
      step,
      deviceId: this.params.device.id,
      stepIndex,
      status: 'RUNNING',
      retryCount: 0,
    });

    let iter = 0;
    let localCompleted = 0;

    while (iter < maxIter) {
      const left = resolveTemplate(String(step.params.left ?? ''), this.params.inputVariables, this.stepOutputs);
      const right = resolveTemplate(String(step.params.right ?? ''), this.params.inputVariables, this.stepOutputs);
      const operator = String(step.params.operator ?? 'equals');
      const conditionMet = evaluateCondition(left, operator, right);

      if (!conditionMet) break;

      if (step.steps) {
        this.clearPersistedSteps(step.steps);
      }
      const res = await this.runSteps(step.steps ?? [], stepIndex + localCompleted + 1);
      localCompleted += res.completedSteps;

      if (res.status !== 'COMPLETED') {
        await this.saveStep({
          runId: this.params.runId,
          step,
          deviceId: this.params.device.id,
          stepIndex,
          status: res.status === 'WAITING_APPROVAL' ? 'WAITING_APPROVAL' : (res.status === 'CANCELLED' ? 'CANCELLED' : 'FAILED'),
          retryCount: 0,
        });
        return { status: res.status === 'WAITING_APPROVAL' ? 'WAITING_APPROVAL' : (res.status === 'CANCELLED' ? 'CANCELLED' : 'FAILED') };
      }
      iter++;
    }

    await this.saveStep({
      runId: this.params.runId,
      step,
      deviceId: this.params.device.id,
      stepIndex,
      status: 'SUCCESS',
      retryCount: 0,
      output: { iterations: iter }
    });
    return { status: 'SUCCESS' };
  }

  private async handleGroup(step: MacroStep, stepIndex: number): Promise<{ status: StepExecutionStatus }> {
    await this.saveStep({
      runId: this.params.runId,
      step,
      deviceId: this.params.device.id,
      stepIndex,
      status: 'RUNNING',
      retryCount: 0,
    });

    const nested = await this.runSteps(step.steps ?? [], stepIndex + 1);
    if (nested.status === 'WAITING_APPROVAL') {
      await this.saveStep({
        runId: this.params.runId,
        step,
        deviceId: this.params.device.id,
        stepIndex,
        status: 'WAITING_APPROVAL',
        retryCount: 0,
      });
      return { status: 'WAITING_APPROVAL' as const };
    }

    const status = nested.status === 'COMPLETED' ? 'SUCCESS' : nested.status === 'CANCELLED' ? 'CANCELLED' : 'FAILED';
    await this.saveStep({
      runId: this.params.runId,
      step,
      deviceId: this.params.device.id,
      stepIndex,
      status,
      retryCount: 0,
      output: status === 'SUCCESS' ? { stepsCompleted: nested.completedSteps, groupName: step.params.name } : undefined,
      errorPayload: status === 'FAILED'
        ? { code: 'GROUP_FAILED', message: 'Group step failed', timestamp: new Date().toISOString() }
        : null,
    });
    return { status };
  }

  private async handleConditional(step: MacroStep, stepIndex: number): Promise<{ status: StepExecutionStatus }> {
    const left = resolveTemplate(String(step.params.left ?? ''), this.params.inputVariables, this.stepOutputs);
    const right = resolveTemplate(String(step.params.right ?? ''), this.params.inputVariables, this.stepOutputs);
    const operator = String(step.params.operator ?? 'equals');
    const conditionMet = evaluateCondition(left, operator, right);

    await this.saveStep({
      runId: this.params.runId,
      step,
      deviceId: this.params.device.id,
      stepIndex,
      status: 'SUCCESS',
      retryCount: 0,
      output: { conditionMet, left, operator, right },
    });

    const takenBranch = conditionMet ? step.then : step.else;
    const skippedBranch = conditionMet ? step.else : step.then;
    const taken = takenBranch?.length
      ? await this.runSteps(takenBranch, stepIndex + 1)
      : { completedSteps: 0, status: 'COMPLETED' as const };

    if (taken.status !== 'COMPLETED') {
      return { status: taken.status === 'WAITING_APPROVAL' ? 'WAITING_APPROVAL' : taken.status === 'CANCELLED' ? 'CANCELLED' : 'FAILED' };
    }

    if (skippedBranch?.length) {
      const takenCount = this.countSteps(takenBranch ?? []);
      for (let i = 0; i < skippedBranch.length; i++) {
        await this.saveStep({
          runId: this.params.runId,
          step: skippedBranch[i],
          deviceId: this.params.device.id,
          stepIndex: stepIndex + 1 + takenCount + i,
          status: 'SKIPPED',
          retryCount: 0,
        });
      }
    }

    return { status: 'SUCCESS' as const };
  }

  private async handleApprovalCheckpoint(step: MacroStep, stepIndex: number): Promise<{ status: StepExecutionStatus }> {
    const reason = String(step.params.reason ?? 'Approval required');
    const gate = await this.resolveApprovalGate(step, stepIndex, reason);
    if (gate !== 'APPROVED') return { status: gate === 'WAITING_APPROVAL' ? 'WAITING_APPROVAL' : 'CANCELLED' };

    await this.saveStep({
      runId: this.params.runId,
      step,
      deviceId: this.params.device.id,
      stepIndex,
      status: 'SUCCESS',
      retryCount: 0,
      output: { approved: true, reason },
    });
    return { status: 'SUCCESS' as const };
  }

  private async resolveApprovalGate(step: MacroStep, stepIndex: number, reason: string): Promise<ApprovalGateStatus> {
    const approval = await loadLatestApprovalForStep(this.params.supabase, this.params.runId, step.id);
    if (approval?.status === 'APPROVED') return 'APPROVED';
    if (approval?.status === 'REJECTED' || approval?.status === 'EXPIRED') return 'CANCELLED';

    if (!approval) {
      await createApprovalRequest(
        this.params.supabase,
        this.params.runId,
        this.params.triggeredByUserId,
        step.id,
        step.type,
        reason
      );
    }

    await this.saveStep({
      runId: this.params.runId,
      step,
      deviceId: this.params.device.id,
      stepIndex,
      status: 'WAITING_APPROVAL',
      retryCount: this.persistedSteps.get(step.id)?.retryCount ?? 0,
    });
    await markOwnedRunStatus(this.params.supabase, this.params.runId, this.params.claimToken, 'WAITING_APPROVAL');
    return 'WAITING_APPROVAL';
  }

  private async executeDeviceStepWithRetry(step: MacroStep, stepIndex: number): Promise<{ status: StepExecutionStatus }> {
    /* Action budget check: before executing a budget-consuming step, verify the
       account has remaining capacity for this action type today. */
    const budgetCheck = await this.budgetCheckForStep(step);
    if (budgetCheck && !budgetCheck.allowed) {
      await this.saveStep({
        runId: this.params.runId,
        step,
        deviceId: this.params.device.id,
        stepIndex,
        status: 'FAILED',
        retryCount: 0,
        errorPayload: { code: 'BUDGET_EXCEEDED', message: budgetCheck.reason ?? 'Action budget exceeded', timestamp: new Date().toISOString() },
      });
      return { status: 'FAILED' as const };
    }

    const timeoutMs = step.policy?.timeoutMs ?? this.params.definition.execution.defaultTimeoutMs;
    const retryPolicy = normalizeRetryBackoffPolicy({
      ...this.params.retryBackoffPolicy,
      maxRetries: step.policy?.maxRetries ?? this.params.retryBackoffPolicy?.maxRetries ?? this.params.definition.execution.maxRetries,
    });
    const startedAtMs = Date.now();

    for (let attempt = 0; attempt <= retryPolicy.maxRetries; attempt++) {
      await this.saveStep({
        runId: this.params.runId,
        step,
        deviceId: this.params.device.id,
        stepIndex,
        status: attempt > 0 ? 'RETRYING' : 'RUNNING',
        retryCount: attempt,
        output: attempt > 0
          ? {
              retryAttempt: attempt,
              retryReason: 'Retry attempt started after previous failure',
              elapsedMs: Date.now() - startedAtMs,
            }
          : undefined,
      });

      const resolvedParams = resolveParams(step.params, this.params.inputVariables, this.stepOutputs);

      /* Apply anti-detection transforms (coordinate jitter, delay randomization)
         when the macro definition includes an antiDetection config. */
      const finalParams = this.params.definition.antiDetection
        ? applyAntiDetection(resolvedParams as { x?: number; y?: number; ms?: number }, this.params.definition.antiDetection)
        : resolvedParams;

      try {
        const result = await withTimeout(
          this.params.backend.executeStep({
            step,
            runId: this.params.runId,
            device: this.params.device,
            resolvedParams: finalParams,
            isCancelled: async () => isRunCancelled(this.params.supabase, this.params.runId, this.params.claimToken),
          }),
          step.id,
          timeoutMs
        );

        if (result.success) {
          const screenshotArtifactId = result.screenshotBase64
            ? await createScreenshotArtifact(this.params.supabase, this.params.runId, this.params.device.id, step.id, result.screenshotBase64)
            : null;
          const inlineLog = extractInlineLogText(result.output);
          if (inlineLog && (step.type === 'adb' || step.type === 'run_autox')) {
            await createLogArtifact(this.params.supabase, this.params.runId, this.params.device.id, step.id, inlineLog, {
              stepType: step.type,
              source: 'step-output',
            });
          }

          await this.saveStep({
            runId: this.params.runId,
            step,
            deviceId: this.params.device.id,
            stepIndex,
            status: 'SUCCESS',
            retryCount: attempt,
            output: result.output,
            screenshotArtifactId,
          });
          await this.recordStepAction(step, true);
          return { status: 'SUCCESS' as const };
        }

        const nextDelayMs = getRetryDelayMs(retryPolicy, attempt);
        if (shouldRetryWithBackoff({
          attempt,
          elapsedMs: Date.now() - startedAtMs,
          nextDelayMs,
          policy: retryPolicy,
        })) {
          await this.saveStep({
            runId: this.params.runId,
            step,
            deviceId: this.params.device.id,
            stepIndex,
            status: 'RETRYING',
            retryCount: attempt + 1,
            output: {
              retryAttempt: attempt + 1,
              retryReason: result.error ?? `Step ${step.id} failed`,
              nextRetryDelayMs: nextDelayMs,
              elapsedMs: Date.now() - startedAtMs,
            },
          });
          await new Promise((resolve) => setTimeout(resolve, nextDelayMs));
          continue;
        }

        const cancelled = result.error?.startsWith('Cancelled') ?? false;
        if (!cancelled) {
          await createLogArtifact(this.params.supabase, this.params.runId, this.params.device.id, step.id, result.error ?? `Step ${step.id} failed`, {
            stepType: step.type,
            source: 'step-error',
          });

          // Block detection
          const accountId = this.params.inputVariables?.accountId as string | undefined;
          if (accountId && result.error) {
            await handlePotentialBlock(this.params.supabase, accountId, result.error);
          }
        }
        await this.saveStep({
          runId: this.params.runId,
          step,
          deviceId: this.params.device.id,
          stepIndex,
          status: cancelled ? 'CANCELLED' : 'FAILED',
          retryCount: attempt,
          errorPayload: cancelled ? null : {
            code: 'STEP_FAILED',
            message: result.error ?? `Step ${step.id} failed`,
            retryAttempt: attempt,
            terminalFailureReason: 'Retry policy exhausted or elapsed budget reached',
            timestamp: new Date().toISOString(),
          },
        });
        return { status: cancelled ? 'CANCELLED' : 'FAILED' };
      } catch (error) {
        const code = error instanceof StepTimeoutError ? 'STEP_TIMEOUT' : 'STEP_EXCEPTION';
        const message = error instanceof Error ? error.message : String(error);
        const nextDelayMs = getRetryDelayMs(retryPolicy, attempt);
        if (!(error instanceof StepTimeoutError) && shouldRetryWithBackoff({
          attempt,
          elapsedMs: Date.now() - startedAtMs,
          nextDelayMs,
          policy: retryPolicy,
        })) {
          await this.saveStep({
            runId: this.params.runId,
            step,
            deviceId: this.params.device.id,
            stepIndex,
            status: 'RETRYING',
            retryCount: attempt + 1,
            output: {
              retryAttempt: attempt + 1,
              retryReason: message,
              nextRetryDelayMs: nextDelayMs,
              elapsedMs: Date.now() - startedAtMs,
            },
          });
          await new Promise((resolve) => setTimeout(resolve, nextDelayMs));
          continue;
        }

        await createLogArtifact(this.params.supabase, this.params.runId, this.params.device.id, step.id, message, {
          stepType: step.type,
          source: 'step-exception',
          code,
        });

        // Block detection on exception message
        const accountId = this.params.inputVariables?.accountId as string | undefined;
        if (accountId && message) {
          await handlePotentialBlock(this.params.supabase, accountId, message);
        }
        await this.saveStep({
          runId: this.params.runId,
          step,
          deviceId: this.params.device.id,
          stepIndex,
          status: 'FAILED',
          retryCount: attempt,
          errorPayload: {
            code,
            message,
            retryAttempt: attempt,
            terminalFailureReason: error instanceof StepTimeoutError
              ? 'Step timeout is not retried'
              : 'Retry policy exhausted or elapsed budget reached',
            timestamp: new Date().toISOString(),
          },
        });
        return { status: 'FAILED' as const };
      }
    }

    return { status: 'FAILED' as const };
  }

  /* ── Action budget helpers ── */

  private static readonly BUDGETED_ACTION_TYPES = new Set<string>(['like', 'follow', 'comment', 'post', 'share']);
  private static readonly HISTORY_ACTION_TYPES = new Set<string>(['like', 'follow', 'comment', 'post', 'share', 'instagram_pilot_open']);

  /** Check action budget for a step that declares `params.actionBudgetType`.
   *  Returns null when the step is not budget-gated. */
  private async budgetCheckForStep(step: MacroStep): Promise<BudgetCheckResult | null> {
    const actionType = step.params?.actionBudgetType;
    if (typeof actionType !== 'string' || !SingleDeviceStepRunner.BUDGETED_ACTION_TYPES.has(actionType)) return null;

    const accountId = this.params.inputVariables?.accountId;
    if (typeof accountId !== 'string') return null;

    const { data: account } = await this.params.supabase
      .from('accounts')
      .select('*')
      .eq('id', accountId)
      .maybeSingle();

    if (!account) return null; // account missing → don't block execution

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
    const { data: history } = await this.params.supabase
      .from('account_action_history')
      .select('*')
      .eq('account_id', accountId)
      .gte('created_at', today.toISOString());

    const todayCounts = getTodayActionCounts((history ?? []) as AccountActionHistory[], accountId);
    return checkActionBudget(account as Account, actionType as BudgetedAccountActionType, todayCounts);
  }

  /** Record a completed action in account_action_history and increment current_action_count. */
  private async recordStepAction(step: MacroStep, success: boolean): Promise<void> {
    const actionType = step.params?.actionHistoryType ?? step.params?.actionBudgetType;
    if (typeof actionType !== 'string' || !SingleDeviceStepRunner.HISTORY_ACTION_TYPES.has(actionType)) return;

    const accountId = this.params.inputVariables?.accountId;
    if (typeof accountId !== 'string') return;

    try {
      await this.params.supabase.from('account_action_history').insert({
        account_id: accountId,
        action_type: actionType,
        step_id: null,
        source_run_id: this.params.runId,
        source_step_id: step.id,
        success,
      });

      if (success && SingleDeviceStepRunner.BUDGETED_ACTION_TYPES.has(actionType)) {
        const { error: rpcError } = await this.params.supabase.rpc('increment_account_action_count', {
          p_account_id: accountId,
        });

        if (rpcError) {
          console.warn(
            `[execution-worker] run ${this.params.runId} step ${step.id} failed to increment action count:`,
            rpcError
          );
        }
      }
    } catch {
      /* Best-effort recording — don't fail the step if tracking fails. */
    }
  }

  private async saveStep(
    params: Parameters<typeof persistRunStep>[1]
  ) {
    await persistRunStep(this.params.supabase, params);
    const output = isRecord(params.output) ? params.output : {};

    this.persistedSteps.set(params.step.id, {
      stepId: params.step.id,
      status: params.status,
      output,
      retryCount: params.retryCount,
    });

    if (params.status === 'SUCCESS') {
      this.stepOutputs.set(params.step.id, output);
      
      if (params.step.type === 'extract_var' && params.step.params.variableName) {
        const variableName = String(params.step.params.variableName);
        this.executionContext.set(variableName, output.value);
        
        // Also mutate inputVariables so existing resolveTemplate logic sees it
        this.params.inputVariables[variableName] = output.value;
      }
    }
  }

  private countSteps(steps: MacroStep[]): number {
    let count = 0;
    for (const step of steps) {
      count += 1;
      if (step.then) count += this.countSteps(step.then);
      if (step.else) count += this.countSteps(step.else);
      if (step.steps) count += this.countSteps(step.steps);
    }
    return count;
  }
}
