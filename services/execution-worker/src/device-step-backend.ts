import type { MacroStep } from '../../../src/contracts/macro';
import type { Device } from '../../../src/lib/database.types';
import type { StepExecutionResult } from './execute-device-step.js';

export interface DeviceStepExecutionArgs {
  step: MacroStep;
  runId: string;
  device: Device;
  resolvedParams: Record<string, unknown>;
  isCancelled: () => Promise<boolean>;
}

export interface DeviceStepBackend {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  executeStep(args: DeviceStepExecutionArgs): Promise<StepExecutionResult>;
}
