import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  acquireDeviceLock: vi.fn(),
  releaseDeviceLock: vi.fn(),
  renewDeviceLock: vi.fn(),
  runnerRun: vi.fn(),
}));

vi.mock('./worker-device-locks.js', () => ({
  acquireDeviceLock: mocks.acquireDeviceLock,
  releaseDeviceLock: mocks.releaseDeviceLock,
  renewDeviceLock: mocks.renewDeviceLock,
}));

vi.mock('./single-device-step-runner.js', () => ({
  SingleDeviceStepRunner: vi.fn(function MockSingleDeviceStepRunner() {
    return { run: mocks.runnerRun };
  }),
}));

import { executeOwnedDeviceRun } from './execute-owned-device-run.js';
import { globalDeviceQuarantineCircuitBreaker } from './device-quarantine-circuit-breaker.js';
import { globalDeviceActionGuardrail } from './device-action-guardrail.js';

function params() {
  return {
    supabase: {},
    backend: {},
    runId: 'run-1',
    claimToken: 'claim-1',
    device: { id: 'device-1' },
    definition: {},
    triggeredByUserId: 'user-1',
    inputVariables: {},
  } as never;
}

describe('executeOwnedDeviceRun lock ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalDeviceQuarantineCircuitBreaker.clear();
    globalDeviceActionGuardrail.reset();
    mocks.acquireDeviceLock.mockResolvedValue({ acquired: true });
    mocks.releaseDeviceLock.mockResolvedValue(undefined);
    mocks.renewDeviceLock.mockResolvedValue(true);
    mocks.runnerRun.mockResolvedValue({ status: 'COMPLETED' });
  });

  it.each([
    ['COMPLETED', 'COMPLETED'],
    ['FAILED', 'FAILED'],
    ['CANCELLED', 'CANCELLED'],
    ['WAITING_APPROVAL', 'WAITING_APPROVAL'],
  ] as const)('releases lock once after %s', async (runnerStatus, expectedStatus) => {
    mocks.runnerRun.mockResolvedValue({ status: runnerStatus });

    const result = await executeOwnedDeviceRun(params());

    expect(result.status).toBe(expectedStatus);
    expect(mocks.releaseDeviceLock).toHaveBeenCalledTimes(1);
    expect(mocks.releaseDeviceLock).toHaveBeenCalledWith({}, 'device-1', 'run-1');
  });

  it('releases lock after runner exception', async () => {
    mocks.runnerRun.mockRejectedValue(new Error('synthetic runner failure'));

    const result = await executeOwnedDeviceRun(params());

    expect(result).toEqual({
      status: 'FAILED',
      error: { code: 'EXECUTION_ERROR', message: 'synthetic runner failure' },
    });
    expect(mocks.releaseDeviceLock).toHaveBeenCalledTimes(1);
  });

  it('does not release a lock when acquisition fails', async () => {
    mocks.acquireDeviceLock.mockResolvedValue({ acquired: false, reason: 'owned by another run' });

    const result = await executeOwnedDeviceRun(params());

    expect(result).toEqual({
      status: 'FAILED',
      error: { code: 'DEVICE_LOCKED', message: 'owned by another run' },
    });
    expect(mocks.runnerRun).not.toHaveBeenCalled();
    expect(mocks.releaseDeviceLock).not.toHaveBeenCalled();
  });

  it('does not release a lock when acquisition throws before ownership exists', async () => {
    mocks.acquireDeviceLock.mockRejectedValue(new Error('lock lookup failed'));

    const result = await executeOwnedDeviceRun(params());

    expect(result.status).toBe('FAILED');
    expect(result.error?.message).toBe('lock lookup failed');
    expect(mocks.releaseDeviceLock).not.toHaveBeenCalled();
  });

  it('rejects execution when device is quarantined', async () => {
    globalDeviceQuarantineCircuitBreaker.recordFailure('device-1');
    globalDeviceQuarantineCircuitBreaker.recordFailure('device-1');
    globalDeviceQuarantineCircuitBreaker.recordFailure('device-1');

    const result = await executeOwnedDeviceRun(params());

    expect(result.status).toBe('FAILED');
    expect(result.error?.code).toBe('DEVICE_QUARANTINED');
    expect(mocks.acquireDeviceLock).not.toHaveBeenCalled();
  });

  it('rejects execution when device rate limit guardrail is exceeded', async () => {
    // Use the global guardrail and fill it
    for (let i = 0; i < 500; i++) {
      globalDeviceActionGuardrail.recordAction('device-1');
    }

    const result = await executeOwnedDeviceRun(params());

    expect(result.status).toBe('FAILED');
    expect(result.error?.code).toBe('DEVICE_RATE_LIMIT_EXCEEDED');
    expect(mocks.acquireDeviceLock).not.toHaveBeenCalled();
  });
});
