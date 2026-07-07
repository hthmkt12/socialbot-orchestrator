import { describe, expect, it, vi } from 'vitest';
import {
  handleCancelControlAction,
  type ControlRunRecord,
  type WorkflowRunControlStore,
} from '../../packages/shared/src';

describe('workflow run control', () => {
  it('OP-ERR-013 treats terminal run cancellation as a replay-safe no-op', async () => {
    const run: ControlRunRecord = {
      id: 'run-terminal',
      status: 'COMPLETED',
      summaryJson: null,
    };
    const store: WorkflowRunControlStore = {
      getRun: vi.fn(),
      queuePendingRun: vi.fn(),
      updateRunSummary: vi.fn().mockResolvedValue(undefined),
      cancelActiveRun: vi.fn(),
      cleanupCancelledRun: vi.fn(),
    };

    const result = await handleCancelControlAction(store, run, '2026-07-07T00:00:00.000Z');

    expect(result).toMatchObject({
      success: true,
      action: 'cancel',
      runId: 'run-terminal',
      status: 'COMPLETED',
      outcome: 'already_finished',
      replaySafe: true,
    });
    expect(store.updateRunSummary).toHaveBeenCalledOnce();
    expect(store.cancelActiveRun).not.toHaveBeenCalled();
    expect(store.cleanupCancelledRun).not.toHaveBeenCalled();
  });
});
