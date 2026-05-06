import type { WorkflowRunControlResponse, WorkflowRunControlSummary } from './execution-contract';

export type RunControlAction = 'start' | 'cancel';

export type RunControlOutcome =
  | 'queued'
  | 'already_queued'
  | 'already_running'
  | 'already_waiting_approval'
  | 'cancelled'
  | 'already_cancelled'
  | 'already_finished';

export const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED', 'CANCELLED', 'PARTIAL_SUCCESS']);
export const ACTIVE_RUN_STATUSES = ['PENDING', 'QUEUED', 'RUNNING', 'WAITING_APPROVAL'];
export const ACTIVE_STEP_STATUSES = ['PENDING', 'RUNNING', 'RETRYING', 'WAITING_APPROVAL'];

export interface ControlRunRecord {
  id: string;
  status: string;
  summaryJson: Record<string, unknown> | null;
}

export interface WorkflowRunControlStore {
  getRun(runId: string): Promise<ControlRunRecord | null>;
  queuePendingRun(runId: string, summaryJson: Record<string, unknown>): Promise<ControlRunRecord | null>;
  updateRunSummary(runId: string, summaryJson: Record<string, unknown>): Promise<void>;
  cancelActiveRun(runId: string, now: string, summaryJson: Record<string, unknown>): Promise<ControlRunRecord | null>;
  cleanupCancelledRun(runId: string, now: string): Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function buildControlSummary(
  summaryJson: unknown,
  action: RunControlAction,
  observedStatus: string,
  now: string,
  accepted: boolean
) {
  const summary = isRecord(summaryJson) ? summaryJson : {};
  const control = isRecord(summary.control) ? summary.control : {};
  const key = action === 'start' ? 'dispatch' : 'cancel';
  const section = isRecord(control[key]) ? control[key] : {};
  const requestCount = Number(section.requestCount ?? 0);

  return {
    ...summary,
    control: {
      ...control,
      lastAction: action,
      lastActionAt: now,
      lastKnownRunStatus: observedStatus,
      [key]: {
        ...section,
        firstRequestedAt: typeof section.firstRequestedAt === 'string' ? section.firstRequestedAt : now,
        lastRequestedAt: now,
        requestCount: Number.isFinite(requestCount) ? requestCount + 1 : 1,
        lastObservedStatus: observedStatus,
        ...(accepted ? { acceptedAt: now } : {}),
      },
    },
  };
}

export function readControl(summaryJson: unknown) {
  if (!isRecord(summaryJson) || !isRecord(summaryJson.control)) return undefined;
  return summaryJson.control;
}

export function startReplayOutcome(status: string): RunControlOutcome {
  if (status === 'QUEUED') return 'already_queued';
  if (status === 'RUNNING') return 'already_running';
  if (status === 'WAITING_APPROVAL') return 'already_waiting_approval';
  if (status === 'CANCELLED') return 'already_cancelled';
  return 'already_finished';
}

export function cancelReplayOutcome(status: string): RunControlOutcome {
  return status === 'CANCELLED' ? 'already_cancelled' : 'already_finished';
}

function successResponse(
  action: RunControlAction,
  runId: string,
  status: string,
  outcome: RunControlOutcome,
  summaryJson: Record<string, unknown>
): WorkflowRunControlResponse {
  return {
    success: true,
    action,
    runId,
    status,
    outcome,
    replaySafe: true,
    control: readControl(summaryJson) as WorkflowRunControlSummary | undefined,
  };
}

export async function handleStartControlAction(
  store: WorkflowRunControlStore,
  run: ControlRunRecord,
  now: string = new Date().toISOString()
) {
  if (run.status === 'PENDING') {
    const queuedSummary = buildControlSummary(run.summaryJson, 'start', 'QUEUED', now, true);
    const queued = await store.queuePendingRun(run.id, queuedSummary);
    if (queued) return successResponse('start', run.id, 'QUEUED', 'queued', queued.summaryJson ?? queuedSummary);
  }

  const freshRun = await store.getRun(run.id);
  if (!freshRun) throw new Error(`Run ${run.id} not found`);

  const observedStatus = freshRun.status === 'PENDING' ? 'QUEUED' : freshRun.status;
  const replaySummary = buildControlSummary(freshRun.summaryJson, 'start', observedStatus, now, false);
  if (freshRun.status === 'PENDING') {
    const queued = await store.queuePendingRun(run.id, replaySummary);
    if (!queued) throw new Error(`Run ${run.id} could not be queued`);
    return successResponse('start', run.id, 'QUEUED', 'queued', queued.summaryJson ?? replaySummary);
  }

  await store.updateRunSummary(run.id, replaySummary);
  return successResponse('start', run.id, freshRun.status, startReplayOutcome(freshRun.status), replaySummary);
}

export async function handleCancelControlAction(
  store: WorkflowRunControlStore,
  run: ControlRunRecord,
  now: string = new Date().toISOString()
) {
  if (TERMINAL_STATUSES.has(run.status)) {
    const replaySummary = buildControlSummary(run.summaryJson, 'cancel', run.status, now, run.status === 'CANCELLED');
    await store.updateRunSummary(run.id, replaySummary);
    return successResponse('cancel', run.id, run.status, cancelReplayOutcome(run.status), replaySummary);
  }

  const cancelledSummary = buildControlSummary(run.summaryJson, 'cancel', 'CANCELLED', now, true);
  const cancelled = await store.cancelActiveRun(run.id, now, cancelledSummary);
  if (!cancelled) {
    const freshRun = await store.getRun(run.id);
    if (!freshRun) throw new Error(`Run ${run.id} not found`);
    const replaySummary = buildControlSummary(freshRun.summaryJson, 'cancel', freshRun.status, now, freshRun.status === 'CANCELLED');
    await store.updateRunSummary(run.id, replaySummary);
    return successResponse('cancel', run.id, freshRun.status, cancelReplayOutcome(freshRun.status), replaySummary);
  }

  await store.cleanupCancelledRun(run.id, now);
  return successResponse('cancel', run.id, 'CANCELLED', 'cancelled', cancelled.summaryJson ?? cancelledSummary);
}
