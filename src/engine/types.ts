import type { Device, ExecutionProfile, RunStatus, RunStepStatus } from '../lib/database.types';

export type OnErrorPolicy = 'stop' | 'continue' | 'skip';

export interface CancellationToken {
  cancelled: boolean;
  reason?: string;
  cancel(reason?: string): void;
}

export function createCancellationToken(): CancellationToken {
  const token: CancellationToken = {
    cancelled: false,
    reason: undefined,
    cancel(reason?: string) {
      token.cancelled = true;
      token.reason = reason ?? 'Cancelled by user';
    },
  };
  return token;
}

export interface StructuredError {
  code: string;
  message: string;
  stepId?: string;
  stepType?: string;
  attempt?: number;
  timestamp: string;
  details?: Record<string, unknown>;
}

export function buildStructuredError(
  code: string,
  message: string,
  opts?: {
    stepId?: string;
    stepType?: string;
    attempt?: number;
    details?: Record<string, unknown>;
  }
): StructuredError {
  return {
    code,
    message,
    stepId: opts?.stepId,
    stepType: opts?.stepType,
    attempt: opts?.attempt,
    timestamp: new Date().toISOString(),
    details: opts?.details,
  };
}

export interface ExecutionContext {
  runId: string;
  deviceId: string;
  device: Device;
  triggeredByUserId: string;
  inputVariables: Record<string, unknown>;
  stepOutputs: Map<string, Record<string, unknown>>;
  executionProfile: ExecutionProfile | null;
  onErrorPolicy: OnErrorPolicy;
  cancellation: CancellationToken;
  defaultTimeoutMs: number;
  defaultMaxRetries: number;
  onStepStart?: (stepId: string, stepIndex: number) => void;
  onStepComplete?: (stepId: string, status: RunStepStatus, output: Record<string, unknown>) => void;
  onRunStatusChange?: (status: RunStatus) => void;
  onScreenshot?: (stepId: string, base64: string) => Promise<string | null>;
  onApprovalNeeded?: (stepId: string, reason: string, stepType?: string) => Promise<boolean>;
}

export interface DeviceRunResult {
  deviceId: string;
  success: boolean;
  stepsCompleted: number;
  stepsTotal: number;
  error?: StructuredError;
  failureScreenshotArtifactId?: string | null;
}

export interface RunSummary {
  totalDevices: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  partial: number;
  avgCompletionRate: number;
  deviceResults: DeviceRunResult[];
}

export interface StepOutput {
  stepId: string;
  status: 'success' | 'failed' | 'skipped' | 'waiting_approval';
  output?: Record<string, unknown>;
  error?: { code: string; message: string; details?: Record<string, unknown> };
  approvalId?: string;
  startedAt: string;
  completedAt?: string;
  retries: number;
}

export interface ExecutionResult {
  runId: string;
  deviceId: string;
  status: 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'WAITING_APPROVAL';
  completedSteps: number;
  totalSteps: number;
  error?: { code: string; message: string; details?: Record<string, unknown> };
  outputs: Map<string, StepOutput>;
}

export interface MultiDeviceResult {
  runId: string;
  overallStatus: 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'PARTIAL' | 'WAITING_APPROVAL';
  deviceResults: Map<string, ExecutionResult>;
  totalDevices: number;
  successfulDevices: number;
  failedDevices: number;
}
