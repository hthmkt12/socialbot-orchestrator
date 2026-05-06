import type { MacroDefinition } from '../contracts/macro';
import type { Device } from '../lib/database.types';
import { buildApprovalHandler, buildScreenshotHandler } from './orchestrator-handlers';
import type { ExecutionContext as RunnerContext, OnErrorPolicy } from './types';
import type { CancellationToken } from './types';

interface BuildRunnerContextArgs {
  definition: MacroDefinition;
  device: Device;
  inputs: Record<string, string>;
  runId: string;
  token: CancellationToken;
  userId: string;
}

export function buildRunnerContext({
  definition,
  device,
  inputs,
  runId,
  token,
  userId,
}: BuildRunnerContextArgs): RunnerContext {
  return {
    runId,
    deviceId: device.id,
    device,
    triggeredByUserId: userId,
    inputVariables: inputs,
    stepOutputs: new Map(),
    executionProfile: null,
    onErrorPolicy: definition.execution.onError as OnErrorPolicy,
    cancellation: token,
    defaultTimeoutMs: definition.execution.defaultTimeoutMs,
    defaultMaxRetries: definition.execution.maxRetries,
    onScreenshot: buildScreenshotHandler(runId, device.id),
    onApprovalNeeded: buildApprovalHandler(runId, userId, token),
  };
}
