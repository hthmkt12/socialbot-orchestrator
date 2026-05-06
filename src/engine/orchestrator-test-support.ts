import { vi } from 'vitest';
import { emptyAggregateRunSummary } from './orchestrator-test-helpers';

export function getWorkflowRunStatuses(
  updateCalls: Array<{ payload: Record<string, unknown> }>
) {
  return updateCalls.map((call) => call.payload.status);
}

export function everyWorkflowRunMatches(
  updateCalls: Array<{ matchValue?: string }>,
  runId: string
) {
  return updateCalls.every((call) => call.matchValue === runId);
}

export function resetOrchestratorTestDoubles({
  aggregateRunResultsMock,
  createApprovalRequestMock,
  emptySummary = emptyAggregateRunSummary,
  executeForDeviceMock,
  getLaixiClientMock,
  releaseAllRunLocksMock,
  supabaseFromMock,
  updateCalls,
  workflowRunsEqMock,
  workflowRunsUpdateMock,
}: {
  aggregateRunResultsMock: ReturnType<typeof vi.fn>;
  createApprovalRequestMock: ReturnType<typeof vi.fn>;
  emptySummary?: typeof emptyAggregateRunSummary;
  executeForDeviceMock: ReturnType<typeof vi.fn>;
  getLaixiClientMock: ReturnType<typeof vi.fn>;
  releaseAllRunLocksMock: ReturnType<typeof vi.fn>;
  supabaseFromMock: ReturnType<typeof vi.fn>;
  updateCalls: Array<unknown>;
  workflowRunsEqMock: ReturnType<typeof vi.fn>;
  workflowRunsUpdateMock: ReturnType<typeof vi.fn>;
}) {
  updateCalls.length = 0;
  executeForDeviceMock.mockReset();
  aggregateRunResultsMock.mockReset();
  getLaixiClientMock.mockReset();
  releaseAllRunLocksMock.mockReset();
  createApprovalRequestMock.mockReset();
  workflowRunsEqMock.mockClear();
  workflowRunsUpdateMock.mockClear();
  supabaseFromMock.mockClear();
  getLaixiClientMock.mockReturnValue({ kind: 'mock-client' });
  releaseAllRunLocksMock.mockResolvedValue(undefined);
  aggregateRunResultsMock.mockResolvedValue(emptySummary);
}
