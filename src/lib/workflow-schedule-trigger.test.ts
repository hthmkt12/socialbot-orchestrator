import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildScheduleTargetSelector,
  computeScheduleNextRunIso,
  WorkflowScheduleTrigger,
} from '../../services/execution-worker/src/workflow-schedule-trigger';

type TriggerSchedule = {
  triggerSchedule: (schedule: Record<string, unknown>, nowIso: string, skipRunCreation?: boolean) => Promise<void>;
};

function workerConfig() {
  return {
    port: 0,
    pollIntervalMs: 1000,
    leaseTtlMs: 1000,
    maxActiveClaims: 1,
    instanceId: 'test-worker',
    supabaseUrl: 'https://example.supabase.co',
    supabaseServiceRoleKey: 'service-role',
    gatewayBaseUrl: 'http://127.0.0.1:3001',
    mobileMcpBridgeUrl: 'http://127.0.0.1:8765',
    deviceBackend: 'mobile-mcp' as const,
    commandTimeoutMs: 1000,
  };
}

function dueSchedule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'schedule-1',
    cron_expression: '*/5 * * * *',
    timezone: 'UTC',
    target_type: 'ALL_DEVICES',
    macro_version_id: 'version-1',
    input_variables: {},
    created_by: 'user-1',
    name: 'Scheduled run',
    last_run_at: null,
    is_active: true,
    next_run_at: '2026-07-07T00:00:00.000Z',
    ...overrides,
  };
}

function makeTableMock(options: {
  claimData?: unknown;
  macroVersion?: unknown;
  insertError?: unknown;
}) {
  const claimData = Object.prototype.hasOwnProperty.call(options, 'claimData')
    ? options.claimData
    : { id: 'schedule-1' };
  const macroVersion = Object.prototype.hasOwnProperty.call(options, 'macroVersion')
    ? options.macroVersion
    : { id: 'version-1', status: 'ACTIVE' };
  const runInsert = vi.fn().mockResolvedValue({ error: options.insertError ?? null });
  const updateMaybeSingle = vi.fn().mockResolvedValue({ data: claimData, error: null });
  const updateSelect = vi.fn().mockReturnValue({ maybeSingle: updateMaybeSingle });
  const updateOr = vi.fn().mockReturnValue({ select: updateSelect });
  const updateEq = vi.fn().mockReturnValue({ or: updateOr });
  const update = vi.fn().mockReturnValue({ eq: updateEq });
  const macroMaybeSingle = vi.fn().mockResolvedValue({ data: macroVersion, error: null });
  const macroEq = vi.fn().mockReturnValue({ maybeSingle: macroMaybeSingle });
  const macroSelect = vi.fn().mockReturnValue({ eq: macroEq });
  const from = vi.fn((table: string) => {
    if (table === 'workflow_schedules') return { update };
    if (table === 'macro_versions') return { select: macroSelect };
    if (table === 'workflow_runs') return { insert: runInsert };
    return {};
  });

  return { from, runInsert, updateMaybeSingle, macroSelect };
}

describe('workflow schedule trigger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('SCH-CAN-002 computes a next run timestamp from cron and timezone', () => {
    expect(computeScheduleNextRunIso('*/5 * * * *', 'UTC')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('SCH-ERR-004 rejects schedule targets without the required selector', () => {
    expect(buildScheduleTargetSelector({
      target_type: 'SINGLE_DEVICE',
      target_device_id: undefined,
      target_group_id: undefined,
    })).toEqual({ ok: false, error: 'Schedule target device is required' });
  });

  it('SCH-NO-001 creates only a queued workflow run after claiming a valid schedule', async () => {
    const table = makeTableMock({});
    const trigger = new WorkflowScheduleTrigger(workerConfig(), { from: table.from } as never) as unknown as TriggerSchedule;

    await trigger.triggerSchedule(dueSchedule(), '2026-07-07T00:00:00.000Z');

    expect(table.runInsert).toHaveBeenCalledWith(expect.objectContaining({
      macro_version_id: 'version-1',
      status: 'QUEUED',
      summary_json: expect.objectContaining({ source: 'schedule', scheduleId: 'schedule-1' }),
    }));
  });

  it('SCH-CAN-004 does not create a duplicate run when the schedule claim loses the race', async () => {
    const table = makeTableMock({ claimData: null });
    const trigger = new WorkflowScheduleTrigger(workerConfig(), { from: table.from } as never) as unknown as TriggerSchedule;

    await trigger.triggerSchedule(dueSchedule(), '2026-07-07T00:00:00.000Z');

    expect(table.runInsert).not.toHaveBeenCalled();
  });

  it('SCH-ERR-003 does not create a run for a missing macro version', async () => {
    const table = makeTableMock({ macroVersion: null });
    const trigger = new WorkflowScheduleTrigger(workerConfig(), { from: table.from } as never) as unknown as TriggerSchedule;

    await trigger.triggerSchedule(dueSchedule(), '2026-07-07T00:00:00.000Z');

    expect(table.runInsert).not.toHaveBeenCalled();
  });
});
