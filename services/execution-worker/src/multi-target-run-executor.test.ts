import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  aggregateRunResults: vi.fn(),
  createClient: vi.fn(),
  createDeviceWorker: vi.fn(),
  finalizeOwnedRun: vi.fn(),
  isRunCancelled: vi.fn(),
  loadMultiTargetRunContext: vi.fn(),
  markOwnedRunStatus: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));
vi.mock('./multi-target-run-context', () => ({ loadMultiTargetRunContext: mocks.loadMultiTargetRunContext }));
vi.mock('./worker-step-store', () => ({ aggregateRunResults: mocks.aggregateRunResults }));
vi.mock('./worker-run-store', () => ({
  finalizeOwnedRun: mocks.finalizeOwnedRun,
  isRunCancelled: mocks.isRunCancelled,
  markOwnedRunStatus: mocks.markOwnedRunStatus,
}));
vi.mock('./device-worker-runtime', () => ({
  createDeviceWorker: mocks.createDeviceWorker,
  hasCompiledDeviceWorker: () => true,
}));

import type { WorkerConfig } from './run-claim-coordinator';
import { MultiTargetRunExecutor } from './multi-target-run-executor';

const config: WorkerConfig = {
  port: 4310,
  pollIntervalMs: 1000,
  leaseTtlMs: 30_000,
  maxActiveClaims: 2,
  instanceId: 'worker-test',
  supabaseUrl: 'http://127.0.0.1:54321',
  supabaseServiceRoleKey: 'synthetic-service-key',
  credentialVaultWorkerToken: 'synthetic-vault-token',
  gatewayBaseUrl: 'http://127.0.0.1:8080',
  mobileMcpBridgeUrl: 'http://127.0.0.1:8765',
  deviceBackend: 'mobile-mcp',
  commandTimeoutMs: 1000,
};

function createContext(deviceCount: number) {
  return {
    runId: 'run-1',
    claimToken: 'claim-1',
    targetType: 'MULTI_DEVICE',
    triggeredByUserId: 'user-1',
    inputVariables: {},
    devices: Array.from({ length: deviceCount }, (_, index) => ({
      id: `device-${index + 1}`,
      name: `Device ${index + 1}`,
    })),
    definition: { version: 1, meta: {}, inputs: {}, target: {}, execution: {}, steps: [] },
    retryBackoffPolicy: undefined,
    targetFailurePolicy: 'skip_failed_target',
    maxPilotTargetCount: 10,
    summaryJson: {},
    resolvedDeviceIdsPersisted: true,
  };
}

function createWorker(result: { status: string; error?: { code: string; message: string } }) {
  const worker = new EventEmitter();
  queueMicrotask(() => worker.emit('message', { type: 'DONE', result }));
  return worker;
}

function setup(deviceCount: number, results: { status: string; error?: { code: string; message: string } }[]) {
  vi.clearAllMocks();
  mocks.createClient.mockReturnValue({});
  mocks.loadMultiTargetRunContext.mockResolvedValue(createContext(deviceCount));
  mocks.isRunCancelled.mockResolvedValue(false);
  mocks.aggregateRunResults.mockResolvedValue({ avgCompletionRate: 1 });
  mocks.finalizeOwnedRun.mockResolvedValue(undefined);
  mocks.markOwnedRunStatus.mockResolvedValue(undefined);
  mocks.createDeviceWorker.mockImplementation((_dirname, workerData) => {
    const index = Number(String(workerData.device.id).split('-')[1]) - 1;
    return createWorker(results[index]);
  });
}

describe('MultiTargetRunExecutor characterization', () => {
  it('dispatches ten devices once each within one concurrent chunk', async () => {
    setup(10, Array.from({ length: 10 }, () => ({ status: 'COMPLETED' })));
    const releaseClaim = vi.fn();

    await new MultiTargetRunExecutor(config, releaseClaim).executeClaimedRun('run-1', 'claim-1');

    expect(mocks.createDeviceWorker).toHaveBeenCalledTimes(10);
    expect(mocks.createDeviceWorker.mock.calls.map((call) => call[1].device.id)).toEqual(
      Array.from({ length: 10 }, (_, index) => `device-${index + 1}`)
    );
    expect(mocks.finalizeOwnedRun).toHaveBeenCalledWith(
      {},
      'run-1',
      'claim-1',
      'COMPLETED',
      expect.objectContaining({ totalDevices: 10, succeeded: 10, failed: 0, cancelled: 0 })
    );
    expect(releaseClaim).toHaveBeenCalledWith('run-1', 'claim-1');
  });

  it('aggregates mixed device outcomes as PARTIAL_SUCCESS', async () => {
    setup(2, [
      { status: 'COMPLETED' },
      { status: 'FAILED', error: { code: 'DEVICE_ERROR', message: 'synthetic failure' } },
    ]);

    await new MultiTargetRunExecutor(config, vi.fn()).executeClaimedRun('run-1', 'claim-1');

    expect(mocks.finalizeOwnedRun).toHaveBeenCalledWith(
      {},
      'run-1',
      'claim-1',
      'PARTIAL_SUCCESS',
      expect.objectContaining({ totalDevices: 2, succeeded: 1, failed: 1, cancelled: 0 })
    );
  });
});
