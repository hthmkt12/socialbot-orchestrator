import type { Device, ExecutionProfile } from '../lib/database.types';
import { vi } from 'vitest';
import { createCancellationToken, type ExecutionContext } from './types';

export const baseRunnerDevice: Device = {
  id: 'device-row-1',
  laixi_device_id: 'laixi-1',
  name: 'Pixel',
  model: 'Pixel 8',
  brand: 'Google',
  android_version: '14',
  screen_width: 1080,
  screen_height: 2400,
  status: 'ONLINE',
  last_seen_at: null,
  heartbeat_freshness: 'fresh',
  last_error_message: null,
  last_error_at: null,
  metadata_json: {},
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

export function createExecutionContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  const executionProfile: ExecutionProfile | null = null;
  return {
    runId: 'run-1',
    deviceId: baseRunnerDevice.id,
    device: baseRunnerDevice,
    triggeredByUserId: 'user-1',
    inputVariables: { appName: 'settings' },
    stepOutputs: new Map(),
    executionProfile,
    onErrorPolicy: 'stop',
    cancellation: createCancellationToken(),
    defaultTimeoutMs: 1000,
    defaultMaxRetries: 0,
    ...overrides,
  };
}

type RunnerTestHarness = {
  captureFailureScreenshot: () => Promise<string | null>;
  persistStep: (...args: unknown[]) => Promise<void>;
  persistStepFinal: (...args: unknown[]) => Promise<void>;
  startLockRenewal: (deviceId: string, runId: string) => void;
  stopLockRenewal: (deviceId: string) => void;
};

export function attachRunnerHarness<T extends object>(runner: T): T {
  const runnerHarness = runner as RunnerTestHarness;
  vi.spyOn(runnerHarness, 'startLockRenewal').mockImplementation(() => {});
  vi.spyOn(runnerHarness, 'stopLockRenewal').mockImplementation(() => {});
  vi.spyOn(runnerHarness, 'persistStep').mockResolvedValue(undefined);
  vi.spyOn(runnerHarness, 'persistStepFinal').mockResolvedValue(undefined);
  vi.spyOn(runnerHarness, 'captureFailureScreenshot').mockResolvedValue(null);
  return runner;
}
