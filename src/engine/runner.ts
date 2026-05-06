import type { LaixiClient } from '../adapters/laixi/client';
import type { MacroStep } from '../contracts/macro';
import type { RunStepStatus } from '../lib/database.types';
import { acquireDeviceLock, releaseDeviceLock } from './device-lock';
import { executeRunnerDeviceStep } from './runner-device-step';
import { captureRunnerFailureScreenshot } from './runner-failure-screenshot';
import { startRunnerLockRenewal, stopRunnerLockRenewal } from './runner-lock-renewal';
import { aggregatePersistedRunResults, persistRunnerStepFinal } from './runner-persistence';
import { countRunnerSteps, runStepsWithFlow } from './runner-step-flow';
import { buildStructuredError, type DeviceRunResult, type ExecutionContext, type StructuredError } from './types';

export class WorkflowRunner {
  private client: LaixiClient;
  private lockRenewTimers = new Map<string, ReturnType<typeof setInterval>>();

  constructor(client: LaixiClient) {
    this.client = client;
  }

  async executeForDevice(steps: MacroStep[], ctx: ExecutionContext): Promise<DeviceRunResult> {
    const stepsTotal = countRunnerSteps(steps);
    const lockResult = await acquireDeviceLock(ctx.deviceId, ctx.runId);

    if (!lockResult.acquired) {
      return {
        deviceId: ctx.deviceId,
        success: false,
        stepsCompleted: 0,
        stepsTotal,
        error: buildStructuredError('DEVICE_LOCKED', lockResult.reason || 'Device is locked'),
      };
    }

    this.startLockRenewal(ctx.deviceId, ctx.runId);

    try {
      const result = await runStepsWithFlow(steps, ctx, 0, {
        countSteps: countRunnerSteps,
        executeDeviceStep: (step, stepCtx, stepIndex) =>
          executeRunnerDeviceStep({
            captureFailureScreenshot: this.captureFailureScreenshot.bind(this),
            client: this.client,
            ctx: stepCtx,
            persistStep: this.persistStep.bind(this),
            persistStepFinal: this.persistStepFinal.bind(this),
            step,
            stepIndex,
          }),
        persistStep: this.persistStep.bind(this),
      });

      return {
        deviceId: ctx.deviceId,
        success: !result.aborted,
        stepsCompleted: result.completed,
        stepsTotal,
        error: result.aborted ? result.lastError : undefined,
        failureScreenshotArtifactId: result.failureScreenshotId,
      };
    } catch (err) {
      return {
        deviceId: ctx.deviceId,
        success: false,
        stepsCompleted: 0,
        stepsTotal,
        error: buildStructuredError('RUNNER_CRASH', err instanceof Error ? err.message : String(err), {
          details: err instanceof Error ? { stack: err.stack } : undefined,
        }),
      };
    } finally {
      this.stopLockRenewal(ctx.deviceId);
      await releaseDeviceLock(ctx.deviceId, ctx.runId);
    }
  }

  private startLockRenewal(deviceId: string, runId: string) {
    startRunnerLockRenewal(this.lockRenewTimers, deviceId, runId);
  }

  private stopLockRenewal(deviceId: string) {
    stopRunnerLockRenewal(this.lockRenewTimers, deviceId);
  }

  private async captureFailureScreenshot(
    step: MacroStep,
    ctx: ExecutionContext
  ): Promise<string | null> {
    return captureRunnerFailureScreenshot(this.client, step, ctx);
  }

  private async persistStep(
    runId: string,
    step: MacroStep,
    deviceId: string,
    stepIndex: number,
    status: RunStepStatus,
    retryCount: number,
    output?: Record<string, unknown>,
    error?: string
  ): Promise<void> {
    await this.persistStepFinal(
      runId,
      step,
      deviceId,
      stepIndex,
      status,
      retryCount,
      output,
      error ? { code: 'ERROR', message: error, timestamp: new Date().toISOString() } : undefined,
      null
    );
  }

  private async persistStepFinal(
    runId: string,
    step: MacroStep,
    deviceId: string,
    stepIndex: number,
    status: RunStepStatus,
    retryCount: number,
    output?: Record<string, unknown>,
    errorPayload?: StructuredError | { code: string; message: string; timestamp: string },
    screenshotArtifactId?: string | null
  ): Promise<void> {
    await persistRunnerStepFinal(
      runId,
      step,
      deviceId,
      stepIndex,
      status,
      retryCount,
      output,
      errorPayload,
      screenshotArtifactId
    );
  }

  async aggregateRunResults(runId: string) {
    return aggregatePersistedRunResults(runId);
  }
}
