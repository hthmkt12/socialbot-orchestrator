import type { SupabaseClient } from '@supabase/supabase-js';
import type { MacroDefinition, MacroStep } from '../../../src/contracts/macro';
import type { Device } from '../../../src/lib/database.types';
import { evaluateCondition, resolveParams, resolveTemplate } from '../../../src/engine/resolver.js';
import { ExecutionContext } from './engine/execution-context.js';
import { StepTimeoutError, withTimeout } from '../../../src/engine/step-timeout.js';
import { applyAntiDetection, randomDelayMs } from '../../../src/lib/anti-detection-helpers.js';
import { handlePotentialBlock } from '../../../src/lib/account-block-detector.js';
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
  isRunCancelled,
  loadLatestApprovalForStep,
  markOwnedRunStatus,
} from './worker-run-store.js';
import { loadPersistedRunSteps, persistRunStep, type StoredRunStepRecord } from './worker-step-store.js';
import { budgetCheckForStep, recordStepAction } from './account-action-policy.js';
import { persistStepArtifacts } from './step-artifact-policy.js';
import { isRecord } from './step-dispatch-results.js';
import { redactSensitiveText } from './credential-redaction.js';

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
  /** Credential vault connection params for decrypt */
  credentialVault?: {
    supabaseUrl: string;
    supabaseServiceRoleKey: string;
    credentialVaultWorkerToken: string;
  };
}

type StepExecutionStatus = 'SUCCESS' | 'SKIPPED' | 'FAILED' | 'CANCELLED' | 'WAITING_APPROVAL';
type TraversalStatus = 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'WAITING_APPROVAL';
type ApprovalGateStatus = 'APPROVED' | 'WAITING_APPROVAL' | 'CANCELLED';

export class SingleDeviceStepRunner {
  private readonly stepOutputs = new Map<string, Record<string, unknown>>();
  private readonly persistedSteps = new Map<string, StoredRunStepRecord>();
  private executionContext!: ExecutionContext;

  /**
   * Transient sensitive variables (e.g. decrypted account passwords) held in
   * memory ONLY for the duration of the step that needs them. Never persisted
   * to the database, logs, or artifacts. Cleared after each step execution.
   */
  private readonly sensitiveInputVariables = new Map<string, string>();

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

  /**
   * Resolve sensitive credential variables for a step.
   * If the step's params contain `{{accountPassword}}`, fetch and decrypt
   * the credential, storing it in sensitiveInputVariables.
   * Called BEFORE resolveParams so the value is available during resolution.
   * Plaintext is held in memory only and is never persisted.
   */
  private async resolveSensitiveVariables(step: MacroStep): Promise<void> {
    const accountId = this.params.inputVariables?.accountId as string | undefined;
    if (!accountId) return;

    // Check if any param value references {{accountPassword}}
    const paramJson = JSON.stringify(step.params);
    if (!paramJson.includes('{{accountPassword}}')) return;

    // Avoid re-fetching if already decrypted for this run
    if (this.sensitiveInputVariables.has('accountPassword')) return;

    try {
      const { fetchAndDecryptCredential } = await import('./credential-decrypt-client.js');
      if (!this.params.credentialVault) throw new Error('Credential vault is not configured');
      const result = await fetchAndDecryptCredential(
        this.params.credentialVault,
        this.params.runId,
        this.params.claimToken,
        accountId
      );
      this.sensitiveInputVariables.set('accountPassword', result.plaintext);
    } catch {
      // Mark as failed so the step produces a safe error; don't throw here
      this.sensitiveInputVariables.set('accountPassword', '__DECRYPT_FAILED__');
    }
  }

  /**
   * Remove sensitive values (e.g. plaintext passwords) from step output
   * before persistence. For input_text steps, redact the 'text' field.
   * Also applies literal-value redaction for any active sensitive variables.
   */
  private scrubSensitiveOutput(
    output: Record<string, unknown>,
    stepType: string
  ): Record<string, unknown> {
    let scrubbed = { ...output };
    if (stepType === 'input_text') {
      if ('text' in scrubbed) {
        scrubbed.text = '[REDACTED]';
      }
    }
    // Apply literal-value redaction for any active sensitive variables
    const sensitiveValues = this.getActiveSensitiveValues();
    if (sensitiveValues.length > 0) {
      scrubbed = redactSensitiveText(scrubbed, sensitiveValues) as Record<string, unknown>;
    }
    return scrubbed;
  }

  /** Get the array of currently active sensitive literal values (excluding placeholders). */
  private getActiveSensitiveValues(): string[] {
    const values: string[] = [];
    for (const value of this.sensitiveInputVariables.values()) {
      if (value && value !== '__DECRYPT_FAILED__' && value.length > 0) {
        values.push(value);
      }
    }
    return values;
  }

  /** Redact a string using active sensitive literals. */
  private redactSensitiveString(text: string): string {
    const sensitiveValues = this.getActiveSensitiveValues();
    if (sensitiveValues.length === 0) return text;
    return redactSensitiveText(text, sensitiveValues) as string;
  }

  /** Redact an object using active sensitive literals. */
  private redactSensitiveObject<T>(obj: T): T {
    const sensitiveValues = this.getActiveSensitiveValues();
    if (sensitiveValues.length === 0) return obj;
    return redactSensitiveText(obj, sensitiveValues) as T;
  }

  private async executeDeviceStepWithRetry(step: MacroStep, stepIndex: number): Promise<{ status: StepExecutionStatus }> {
    try {
    /* Action budget check: before executing a budget-consuming step, verify the
       account has remaining capacity for this action type today. */
    const budgetCheck = await budgetCheckForStep(this.params.supabase, step, this.params.inputVariables);
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

    /* Resolve sensitive credential variables (e.g. {{accountPassword}}) BEFORE
       the retry loop so the decrypted value persists across retry attempts.
       Plaintext is held in sensitiveInputVariables (in-memory only, never persisted). */
    await this.resolveSensitiveVariables(step);

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

      // Overlay sensitive variables (never persisted - only used for device execution)
      // resolveParams has already replaced {{accountPassword}} with '' because the
      // sensitive value is NOT in inputVariables. We re-apply the template here using
      // the original raw params as the source so the plaintext is injected correctly.
      for (const [key, value] of this.sensitiveInputVariables) {
        if (value === '__DECRYPT_FAILED__') {
          // Handle decrypt failure - fail the step with a safe error
          await this.saveStep({
            runId: this.params.runId,
            step,
            deviceId: this.params.device.id,
            stepIndex,
            status: 'FAILED',
            retryCount: attempt,
            errorPayload: {
              code: 'CREDENTIAL_DECRYPT_FAILED',
              message: 'Failed to decrypt account credential. Check SERVER_CREDENTIAL_KEY or LEGACY_PILOT_KEY configuration.',
              timestamp: new Date().toISOString(),
            },
          });
          return { status: 'FAILED' as const };
        }
        // Re-resolve from raw params so {{accountPassword}} is replaced with plaintext
        for (const [paramKey, paramValue] of Object.entries(step.params)) {
          if (typeof paramValue === 'string' && paramValue.includes(`{{${key}}}`)) {
            resolvedParams[paramKey] = resolveTemplate(paramValue, { ...this.params.inputVariables, [key]: value }, this.stepOutputs);
          }
        }
      }

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
          // Redact before artifact persistence as well as run-step persistence.
          // adb/run_autox inline logs are extracted from result.output.
          const safeOutput = this.scrubSensitiveOutput(result.output, step.type);
          const activeSensitiveValues = this.getActiveSensitiveValues();
          const screenshotArtifactId = activeSensitiveValues.length > 0
            ? await persistStepArtifacts(
              this.params.supabase,
              this.params.runId,
              this.params.device.id,
              step.id,
              step.type,
              { ...result, output: safeOutput },
              activeSensitiveValues
            )
            : await persistStepArtifacts(
              this.params.supabase,
              this.params.runId,
              this.params.device.id,
              step.id,
              step.type,
              { ...result, output: safeOutput }
            );

          await this.saveStep({
            runId: this.params.runId,
            step,
            deviceId: this.params.device.id,
            stepIndex,
            status: 'SUCCESS',
            retryCount: attempt,
            output: safeOutput,
            screenshotArtifactId,
          });
          await recordStepAction(this.params.supabase, step, this.params.runId, this.params.inputVariables, true);
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
            output: this.redactSensitiveObject({
              retryAttempt: attempt + 1,
              retryReason: result.error ?? `Step ${step.id} failed`,
              nextRetryDelayMs: nextDelayMs,
              elapsedMs: Date.now() - startedAtMs,
            }),
          });
          await new Promise((resolve) => setTimeout(resolve, nextDelayMs));
          continue;
        }

        const cancelled = result.error?.startsWith('Cancelled') ?? false;
        if (!cancelled) {
          const safeErrorText = this.redactSensitiveString(result.error ?? `Step ${step.id} failed`);
          const activeSensitiveValues = this.getActiveSensitiveValues();
          const logMetadata = {
            stepType: step.type,
            source: 'step-error',
          };
          if (activeSensitiveValues.length > 0) {
            await createLogArtifact(this.params.supabase, this.params.runId, this.params.device.id, step.id, safeErrorText, logMetadata, activeSensitiveValues);
          } else {
            await createLogArtifact(this.params.supabase, this.params.runId, this.params.device.id, step.id, safeErrorText, logMetadata);
          }

          // Block detection — pass redacted text to avoid persisting sensitive literals
          const accountId = this.params.inputVariables?.accountId as string | undefined;
          if (accountId && result.error) {
            await handlePotentialBlock(this.params.supabase, accountId, safeErrorText);
          }
        }
        await this.saveStep({
          runId: this.params.runId,
          step,
          deviceId: this.params.device.id,
          stepIndex,
          status: cancelled ? 'CANCELLED' : 'FAILED',
          retryCount: attempt,
          errorPayload: cancelled ? null : this.redactSensitiveObject({
            code: 'STEP_FAILED',
            message: result.error ?? `Step ${step.id} failed`,
            retryAttempt: attempt,
            terminalFailureReason: 'Retry policy exhausted or elapsed budget reached',
            timestamp: new Date().toISOString(),
          }),
        });
        return { status: cancelled ? 'CANCELLED' : 'FAILED' };
      } catch (error) {
        const code = error instanceof StepTimeoutError ? 'STEP_TIMEOUT' : 'STEP_EXCEPTION';
        const rawMessage = error instanceof Error ? error.message : String(error);
        const message = this.redactSensitiveString(rawMessage);
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
            output: this.redactSensitiveObject({
              retryAttempt: attempt + 1,
              retryReason: message,
              nextRetryDelayMs: nextDelayMs,
              elapsedMs: Date.now() - startedAtMs,
            }),
          });
          await new Promise((resolve) => setTimeout(resolve, nextDelayMs));
          continue;
        }

        const activeSensitiveValues = this.getActiveSensitiveValues();
        const logMetadata = {
          stepType: step.type,
          source: 'step-exception',
          code,
        };
        if (activeSensitiveValues.length > 0) {
          await createLogArtifact(this.params.supabase, this.params.runId, this.params.device.id, step.id, message, logMetadata, activeSensitiveValues);
        } else {
          await createLogArtifact(this.params.supabase, this.params.runId, this.params.device.id, step.id, message, logMetadata);
        }

        // Block detection on exception message — use redacted text
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
          errorPayload: this.redactSensitiveObject({
            code,
            message,
            retryAttempt: attempt,
            terminalFailureReason: error instanceof StepTimeoutError
              ? 'Step timeout is not retried'
              : 'Retry policy exhausted or elapsed budget reached',
            timestamp: new Date().toISOString(),
          }),
        });
        return { status: 'FAILED' as const };
      }
    }

    return { status: 'FAILED' as const };
    } finally {
      // Clear sensitive variables after step execution (success, failure, or exception)
      this.sensitiveInputVariables.clear();
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
