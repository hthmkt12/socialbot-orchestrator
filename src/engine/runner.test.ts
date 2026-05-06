import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MacroStep } from '../contracts/macro';
import { attachRunnerHarness, baseRunnerDevice, createExecutionContext } from './runner-test-helpers';

const acquireDeviceLockMock = vi.fn();
const releaseDeviceLockMock = vi.fn();
const renewDeviceLockMock = vi.fn();
const executeStepOnDeviceMock = vi.fn();

vi.mock('./device-lock', () => ({
  acquireDeviceLock: acquireDeviceLockMock,
  releaseDeviceLock: releaseDeviceLockMock,
  renewDeviceLock: renewDeviceLockMock,
}));

vi.mock('../adapters/laixi/mapper', () => ({
  executeStepOnDevice: executeStepOnDeviceMock,
}));

const { WorkflowRunner } = await import('./runner');

function createRunner() {
  return attachRunnerHarness(new WorkflowRunner({} as never));
}

describe('WorkflowRunner', () => {
  beforeEach(() => {
    acquireDeviceLockMock.mockReset();
    releaseDeviceLockMock.mockReset();
    renewDeviceLockMock.mockReset();
    executeStepOnDeviceMock.mockReset();
    acquireDeviceLockMock.mockResolvedValue({ acquired: true, lockId: 'lock-1' });
    releaseDeviceLockMock.mockResolvedValue(undefined);
    renewDeviceLockMock.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns DEVICE_LOCKED when device lock acquisition fails', async () => {
    acquireDeviceLockMock.mockResolvedValue({ acquired: false, reason: 'busy elsewhere' });
    const runner = createRunner();

    const result = await runner.executeForDevice([], createExecutionContext());

    expect(result.success).toBe(false);
    expect(result.stepsTotal).toBe(0);
    expect(result.error?.code).toBe('DEVICE_LOCKED');
    expect(releaseDeviceLockMock).not.toHaveBeenCalled();
  });

  it('continues after a failed step when onErrorPolicy is continue', async () => {
    executeStepOnDeviceMock
      .mockResolvedValueOnce({ success: false, output: {}, error: 'tap failed' })
      .mockResolvedValueOnce({ success: true, output: { appPackage: 'settings' } });

    const runner = createRunner();
    const steps: MacroStep[] = [
      { id: 'tap-1', type: 'tap', params: { x: 0.5, y: 0.5 } },
      { id: 'current-1', type: 'get_current_app', params: {} },
    ];

    const result = await runner.executeForDevice(steps, createExecutionContext({ onErrorPolicy: 'continue' }));

    expect(result.success).toBe(true);
    expect(result.stepsCompleted).toBe(1);
    expect(result.stepsTotal).toBe(2);
    expect(result.error).toBeUndefined();
    expect(executeStepOnDeviceMock).toHaveBeenCalledTimes(2);
    expect(releaseDeviceLockMock).toHaveBeenCalledWith(baseRunnerDevice.id, 'run-1');
  });

  it('retries a failed device step and succeeds on a later attempt', async () => {
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: TimerHandler) => {
      if (typeof fn === 'function') fn();
      return 0 as never;
    }) as unknown as typeof setTimeout);

    executeStepOnDeviceMock
      .mockResolvedValueOnce({ success: false, output: {}, error: 'transient' })
      .mockResolvedValueOnce({ success: true, output: { text: 'done' } });

    const runner = createRunner();
    const steps: MacroStep[] = [
      {
        id: 'input-1',
        type: 'input_text',
        params: { text: 'hello' },
        policy: { maxRetries: 1, timeoutMs: 0 },
      },
    ];

    const result = await runner.executeForDevice(steps, createExecutionContext());

    expect(result.success).toBe(true);
    expect(result.stepsCompleted).toBe(1);
    expect(executeStepOnDeviceMock).toHaveBeenCalledTimes(2);
  });

  it('cancels when approval-gated device step is rejected', async () => {
    const runner = createRunner();
    const steps: MacroStep[] = [
      { id: 'adb-1', type: 'adb', params: { command: 'shell input keyevent 3' }, policy: { requiresApproval: true } },
    ];

    const result = await runner.executeForDevice(steps, createExecutionContext({
      onApprovalNeeded: vi.fn().mockResolvedValue(false),
    }));

    expect(result.success).toBe(false);
    expect(result.stepsCompleted).toBe(0);
    expect(executeStepOnDeviceMock).not.toHaveBeenCalled();
  });

  it('runs conditional branches and records prior step outputs for later steps', async () => {
    executeStepOnDeviceMock.mockResolvedValueOnce({ success: true, output: { appName: 'settings' } });

    const runner = createRunner();
    const ctx = createExecutionContext();
    const steps: MacroStep[] = [
      {
        id: 'if-1',
        type: 'conditional',
        params: { left: '{{appName}}', operator: 'equals', right: 'settings' },
        then: [{ id: 'launch-1', type: 'launch_app', params: { appName: '{{appName}}' } }],
        else: [{ id: 'stop-1', type: 'stop', params: { reason: 'wrong app' } }],
      },
    ];

    const result = await runner.executeForDevice(steps, ctx);

    expect(result.success).toBe(true);
    expect(result.stepsCompleted).toBe(1);
    expect(ctx.stepOutputs.get('if-1')).toMatchObject({ conditionMet: true });
    expect(executeStepOnDeviceMock).toHaveBeenCalledTimes(1);
  });
});
