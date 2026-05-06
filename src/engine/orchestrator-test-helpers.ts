import type { MacroDefinition } from '../contracts/macro';
import type { Device } from '../lib/database.types';
export {
  createWorkflowRunsSupabaseMock,
  deferred,
} from './orchestrator-test-mock-builders';

export const baseDevice: Device = {
  id: 'device-1',
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

export const baseDefinition: MacroDefinition = {
  version: 1,
  meta: { key: 'launch_app_and_capture', name: 'Launch App And Capture' },
  inputs: {},
  target: { mode: 'single_device' },
  execution: {
    defaultTimeoutMs: 1000,
    maxRetries: 1,
    onError: 'stop',
  },
  steps: [{ id: 'launch-1', type: 'launch_app', params: { appName: '{{appName}}' } }],
};

export const baseRunInputs = { appName: 'settings' };
export const secondaryDevice: Device = {
  ...baseDevice,
  id: 'device-2',
  laixi_device_id: 'laixi-2',
  name: 'Pixel 2',
};

export const emptyAggregateRunSummary = {
  totalDevices: 0,
  successfulDevices: 0,
  failedDevices: 0,
  totalSteps: 0,
  completedSteps: 0,
  failedSteps: 0,
  avgCompletionRate: 0,
};

export const partialAggregateRunSummary = {
  totalDevices: 2,
  successfulDevices: 1,
  failedDevices: 1,
  totalSteps: 2,
  completedSteps: 1,
  failedSteps: 1,
  avgCompletionRate: 0.5,
};

export const expectedPartialWorkflowSummary = {
  totalDevices: 2,
  succeeded: 1,
  failed: 1,
  cancelled: 0,
  partial: 0,
  avgCompletionRate: 0.5,
  totalSteps: 2,
  completedSteps: 1,
  failedSteps: 1,
};

export interface MockRunExecutionResult {
  deviceId: string;
  success: boolean;
  stepsCompleted: number;
  stepsTotal: number;
  error?: { code: string; message: string; timestamp: string };
}

export function createRunExecutionResult(result: MockRunExecutionResult) {
  return result;
}

export function createCancelledRunResult(deviceId: string, message = 'cancelled') {
  return createRunExecutionResult({
    deviceId,
    success: false,
    stepsCompleted: 0,
    stepsTotal: 1,
    error: {
      code: 'STEP_FAILED',
      message,
      timestamp: '2026-05-05T00:00:00.000Z',
    },
  });
}
