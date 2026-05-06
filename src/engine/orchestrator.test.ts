import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  baseDefinition,
  baseDevice,
  baseRunInputs,
  createCancelledRunResult,
  createRunExecutionResult,
  createWorkflowRunsSupabaseMock,
  deferred,
  emptyAggregateRunSummary,
  expectedPartialWorkflowSummary,
  partialAggregateRunSummary,
  secondaryDevice,
} from './orchestrator-test-helpers';
import {
  everyWorkflowRunMatches,
  getWorkflowRunStatuses,
  resetOrchestratorTestDoubles,
} from './orchestrator-test-support';

const executeForDeviceMock = vi.fn();
const aggregateRunResultsMock = vi.fn();
const getLaixiClientMock = vi.fn();
const releaseAllRunLocksMock = vi.fn();
const createApprovalRequestMock = vi.fn();
const {
  supabaseFromMock,
  updateCalls,
  workflowRunsEqMock,
  workflowRunsUpdateMock,
} = createWorkflowRunsSupabaseMock();

vi.mock('./runner', () => ({
  WorkflowRunner: class MockWorkflowRunner {
    executeForDevice = executeForDeviceMock;
    aggregateRunResults = aggregateRunResultsMock;
  },
}));

vi.mock('../adapters/laixi/client', () => ({
  getLaixiClient: getLaixiClientMock,
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: supabaseFromMock,
  },
}));

vi.mock('./device-lock', () => ({
  releaseAllRunLocks: releaseAllRunLocksMock,
}));

vi.mock('../lib/approval-service', () => ({
  createApprovalRequest: createApprovalRequestMock,
}));

const { RunOrchestrator } = await import('./orchestrator');

describe('RunOrchestrator', () => {
  beforeEach(() => {
    resetOrchestratorTestDoubles({
      aggregateRunResultsMock,
      createApprovalRequestMock,
      emptySummary: emptyAggregateRunSummary,
      executeForDeviceMock,
      getLaixiClientMock,
      releaseAllRunLocksMock,
      supabaseFromMock,
      updateCalls,
      workflowRunsEqMock,
      workflowRunsUpdateMock,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps a successful single-device run to COMPLETED and updates workflow status', async () => {
    executeForDeviceMock.mockImplementation(async (_steps, ctx) => {
      ctx.stepOutputs.set('launch-1', { appPackage: 'settings' });
      return {
        deviceId: baseDevice.id,
        success: true,
        stepsCompleted: 1,
        stepsTotal: 1,
      };
    });

    const orchestrator = new RunOrchestrator();
    const result = await orchestrator.executeRun('run-1', baseDevice, baseDefinition, baseRunInputs, 'user-1');

    expect(result.status).toBe('COMPLETED');
    expect(result.completedSteps).toBe(1);
    expect(result.outputs.get('launch-1')).toMatchObject({ appPackage: 'settings' });
    expect(getWorkflowRunStatuses(updateCalls)).toEqual(['RUNNING', 'COMPLETED']);
    expect(everyWorkflowRunMatches(updateCalls, 'run-1')).toBe(true);
  });

  it('marks a run CANCELLED when cancellation is requested during execution', async () => {
    const pendingResult = deferred<ReturnType<typeof createCancelledRunResult>>();

    executeForDeviceMock.mockImplementation(() => pendingResult.promise);

    const orchestrator = new RunOrchestrator();
    const executionPromise = orchestrator.executeRun('run-cancel', baseDevice, baseDefinition, baseRunInputs, 'user-1');

    orchestrator.requestCancellation('run-cancel');
    pendingResult.resolve(createCancelledRunResult(baseDevice.id));

    const result = await executionPromise;

    expect(result.status).toBe('CANCELLED');
    expect(getWorkflowRunStatuses(updateCalls)).toEqual(['RUNNING', 'CANCELLED']);
  });

  it('returns PARTIAL for mixed multi-device results and persists summary_json', async () => {
    executeForDeviceMock
      .mockResolvedValueOnce(createRunExecutionResult({
        deviceId: 'device-1',
        success: true,
        stepsCompleted: 1,
        stepsTotal: 1,
      }))
      .mockResolvedValueOnce(createRunExecutionResult({
        deviceId: 'device-2',
        success: false,
        stepsCompleted: 0,
        stepsTotal: 1,
        error: {
          code: 'STEP_FAILED',
          message: 'tap failed',
          timestamp: '2026-05-05T00:00:00.000Z',
        },
      }));

    aggregateRunResultsMock.mockResolvedValue(partialAggregateRunSummary);

    const orchestrator = new RunOrchestrator();
    const result = await orchestrator.executeMultiDeviceRun(
      'run-multi',
      'user-1',
      [baseDevice, secondaryDevice],
      baseDefinition,
      baseRunInputs
    );

    expect(result.overallStatus).toBe('PARTIAL');
    expect(result.successfulDevices).toBe(1);
    expect(result.failedDevices).toBe(1);
    expect(getWorkflowRunStatuses(updateCalls)).toEqual(['RUNNING', 'PARTIAL_SUCCESS', undefined]);
    expect(updateCalls[updateCalls.length - 1]?.payload.summary_json).toMatchObject(expectedPartialWorkflowSummary);
  });

  it('cancelRun updates the run, releases locks, and clears the active token', async () => {
    const pendingResult = deferred<ReturnType<typeof createCancelledRunResult>>();

    executeForDeviceMock.mockImplementation(() => pendingResult.promise);

    const orchestrator = new RunOrchestrator();
    const executionPromise = orchestrator.executeRun('run-stop', baseDevice, baseDefinition, baseRunInputs, 'user-1');

    await orchestrator.cancelRun('run-stop');
    pendingResult.resolve(createCancelledRunResult(baseDevice.id));

    const result = await executionPromise;

    expect(result.status).toBe('CANCELLED');
    expect(releaseAllRunLocksMock).toHaveBeenCalledWith('run-stop');
    expect(getWorkflowRunStatuses(updateCalls)).toEqual(['RUNNING', 'CANCELLED', 'CANCELLED']);
  });
});
