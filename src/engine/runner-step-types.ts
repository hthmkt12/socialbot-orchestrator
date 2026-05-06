import type { MacroStep } from '../contracts/macro';
import type { ExecutionContext, StructuredError } from './types';

export interface RunnerStepResult {
  status: 'success' | 'failed' | 'skipped' | 'cancelled' | 'waiting_approval';
  error?: StructuredError;
  failureScreenshotId?: string | null;
}

export interface RunnerStepFlowResult {
  completed: number;
  aborted: boolean;
  lastError?: StructuredError;
  failureScreenshotId?: string | null;
}

export interface RunnerStepPersistence {
  persistStep(
    runId: string,
    step: MacroStep,
    deviceId: string,
    stepIndex: number,
    status: string,
    retryCount: number,
    output?: Record<string, unknown>,
    error?: string
  ): Promise<void>;
}

export interface RunnerStepFlowDeps extends RunnerStepPersistence {
  countSteps(steps: MacroStep[]): number;
  executeDeviceStep(
    step: MacroStep,
    ctx: ExecutionContext,
    stepIndex: number
  ): Promise<RunnerStepResult>;
}
