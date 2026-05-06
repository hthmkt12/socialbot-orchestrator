import type { MacroStep } from '../contracts/macro';
import { StepTimeoutError } from './step-timeout';
import type { RunnerStepResult } from './runner-step-types';
import { buildStructuredError, type ExecutionContext, type StructuredError } from './types';

const BASE_RETRY_DELAY_MS = 1_000;

interface PersistFailedStepFinal {
  (
    runId: string,
    step: MacroStep,
    deviceId: string,
    stepIndex: number,
    status: 'FAILED',
    retryCount: number,
    output?: Record<string, unknown>,
    errorPayload?: StructuredError | { code: string; message: string; timestamp: string },
    screenshotArtifactId?: string | null
  ): Promise<void>;
}

export async function finalizeFailedRunnerDeviceStep({
  attempt,
  captureFailureScreenshot,
  ctx,
  error,
  persistStepFinal,
  step,
  stepIndex,
}: {
  attempt: number;
  captureFailureScreenshot(step: MacroStep, ctx: ExecutionContext): Promise<string | null>;
  ctx: ExecutionContext;
  error: StructuredError;
  persistStepFinal: PersistFailedStepFinal;
  step: MacroStep;
  stepIndex: number;
}): Promise<RunnerStepResult> {
  const failureScreenshotId = await captureFailureScreenshot(step, ctx);
  await persistStepFinal(
    ctx.runId,
    step,
    ctx.deviceId,
    stepIndex,
    'FAILED',
    attempt,
    undefined,
    error,
    failureScreenshotId
  );
  return { status: 'failed', error, failureScreenshotId };
}

export function buildRunnerDeviceStepError(
  err: unknown,
  step: MacroStep,
  attempt: number,
  timeoutMs: number
): StructuredError {
  const isTimeout = err instanceof StepTimeoutError;
  const message = err instanceof Error ? err.message : String(err);

  return buildStructuredError(isTimeout ? 'STEP_TIMEOUT' : 'STEP_EXCEPTION', message, {
    stepId: step.id,
    stepType: step.type,
    attempt,
    details: isTimeout ? { timeoutMs } : undefined,
  });
}

export function shouldRetryRunnerDeviceStepError(err: unknown, attempt: number, maxRetries: number) {
  return attempt < maxRetries && !(err instanceof StepTimeoutError);
}

export function waitForRunnerDeviceStepRetry(attempt: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, BASE_RETRY_DELAY_MS * Math.pow(2, attempt));
  });
}
