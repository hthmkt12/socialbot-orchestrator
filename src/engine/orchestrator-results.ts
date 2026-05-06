import type { MacroDefinition } from '../contracts/macro';
import type { DeviceRunResult, ExecutionResult, StepOutput } from './types';
import type { ExecutionContext as RunnerContext } from './types';

export function buildExecutionResult(
  runId: string,
  deviceId: string,
  ctx: RunnerContext,
  result: DeviceRunResult,
  cancelled: boolean
): ExecutionResult {
  return {
    runId,
    deviceId,
    status: result.success ? 'COMPLETED' : cancelled ? 'CANCELLED' : 'FAILED',
    completedSteps: result.stepsCompleted,
    totalSteps: result.stepsTotal,
    error: result.error
      ? {
          code: result.error.code,
          message: result.error.message,
          details: result.error.details,
        }
      : undefined,
    outputs: ctx.stepOutputs as unknown as Map<string, StepOutput>,
  };
}

export function buildExecutionErrorResult(
  runId: string,
  deviceId: string,
  definition: MacroDefinition,
  error: unknown
): ExecutionResult {
  return {
    runId,
    deviceId,
    status: 'FAILED',
    completedSteps: 0,
    totalSteps: definition.steps.length,
    error: {
      code: 'EXECUTION_ERROR',
      message: error instanceof Error ? error.message : String(error),
    },
    outputs: new Map(),
  };
}

export function buildWorkflowSummaryUpdate(
  totalDevices: number,
  successfulDevices: number,
  failedDevices: number,
  cancelledDevices: number,
  summary: {
    avgCompletionRate: number;
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
  }
) {
  return {
    totalDevices,
    succeeded: successfulDevices,
    failed: failedDevices,
    cancelled: cancelledDevices,
    partial: totalDevices - successfulDevices - failedDevices - cancelledDevices,
    avgCompletionRate: summary.avgCompletionRate,
    totalSteps: summary.totalSteps,
    completedSteps: summary.completedSteps,
    failedSteps: summary.failedSteps,
  };
}

export function resolveSingleRunStatus(success: boolean, cancelled: boolean): 'COMPLETED' | 'FAILED' | 'CANCELLED' {
  if (success) return 'COMPLETED';
  if (cancelled) return 'CANCELLED';
  return 'FAILED';
}

export function resolveMultiRunStatus(
  tokenCancelled: boolean,
  successfulDevices: number,
  failedDevices: number,
  totalDevices: number
): 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'PARTIAL' | 'WAITING_APPROVAL' {
  if (tokenCancelled && successfulDevices === 0) return 'CANCELLED';
  if (successfulDevices === totalDevices) return 'COMPLETED';
  if (failedDevices === totalDevices) return 'FAILED';
  return 'PARTIAL';
}
