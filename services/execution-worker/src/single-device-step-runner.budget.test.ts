import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MacroDefinition, MacroStep } from '../../../src/contracts/macro';
import type { Account, AccountActionHistory, Device } from '../../../src/lib/database.types';

const persistedSteps: unknown[] = [];

vi.mock('./worker-step-store.js', () => ({
  loadPersistedRunSteps: vi.fn().mockResolvedValue(new Map()),
  persistRunStep: vi.fn(async (_supabase, params) => {
    persistedSteps.push(params);
  }),
}));

vi.mock('./worker-run-store.js', () => ({
  createApprovalRequest: vi.fn(),
  createLogArtifact: vi.fn().mockResolvedValue(null),
  createScreenshotArtifact: vi.fn().mockResolvedValue(null),
  isRunCancelled: vi.fn().mockResolvedValue(false),
  loadLatestApprovalForStep: vi.fn().mockResolvedValue(null),
  markOwnedRunStatus: vi.fn(),
}));

import { SingleDeviceStepRunner } from './single-device-step-runner';
import { createLogArtifact } from './worker-run-store.js';

const mockCreateLogArtifact = vi.mocked(createLogArtifact);

const device: Device = {
  id: 'device-1',
  laixi_device_id: 'serial-1',
  name: 'Android 1',
  model: 'Pixel',
  brand: 'Google',
  android_version: '14',
  screen_width: 1080,
  screen_height: 2400,
  status: 'ONLINE',
  last_seen_at: '2026-07-07T00:00:00.000Z',
  heartbeat_freshness: 'fresh',
  last_error_message: null,
  last_error_at: null,
  metadata_json: {},
  created_at: '2026-07-07T00:00:00.000Z',
  updated_at: '2026-07-07T00:00:00.000Z',
};

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 'account-1',
    user_id: 'user-1',
    username: 'social-user',
    encrypted_password: 'ciphertext',
    platform: 'instagram',
    warm_up_started_at: null,
    warm_up_stage: 3,
    daily_action_limit: 10,
    current_action_count: 0,
    last_action_reset_at: null,
    is_blocked: false,
    detected_block_reason: null,
    created_at: '2026-07-07T00:00:00.000Z',
    updated_at: '2026-07-07T00:00:00.000Z',
    ...overrides,
  };
}

function history(actionType = 'like'): AccountActionHistory {
  return {
    id: crypto.randomUUID(),
    account_id: 'account-1',
    action_type: actionType as AccountActionHistory['action_type'],
    step_id: 'existing-step',
    source_run_id: null,
    source_step_id: null,
    success: true,
    error_message: null,
    created_at: new Date().toISOString(),
  };
}

function definition(step: MacroStep): MacroDefinition {
  return {
    version: 1,
    meta: { key: 'budget-test', name: 'Budget test' },
    inputs: {},
    target: { mode: 'single_device' },
    execution: { defaultTimeoutMs: 1000, maxRetries: 0, onError: 'stop' },
    steps: [step],
  };
}

function retryDefinition(step: MacroStep): MacroDefinition {
  return {
    ...definition(step),
    execution: { defaultTimeoutMs: 1000, maxRetries: 2, onError: 'stop' },
  };
}

function budgetedStep(id = 'like-step'): MacroStep {
  return {
    id,
    type: 'tap',
    params: { x: 100, y: 200, actionBudgetType: 'like' },
  };
}

function makeSupabase(args: { account?: Account | null; history?: AccountActionHistory[] } = {}) {
  const historyInserts: unknown[] = [];
  const accountUpdates: unknown[] = [];
  const rpcCalls: unknown[] = [];
  const currentAccount = args.account === undefined ? account() : args.account;
  const currentHistory = args.history ?? [];

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'accounts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: currentAccount, error: null }),
            }),
          }),
          update: vi.fn((payload) => {
            accountUpdates.push(payload);
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
        };
      }

      if (table === 'account_action_history') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockResolvedValue({ data: currentHistory, error: null }),
            }),
          }),
          insert: vi.fn((payload) => {
            historyInserts.push(payload);
            return Promise.resolve({ error: null });
          }),
        };
      }

      return {};
    }),
    rpc: vi.fn((name: string, payload: unknown) => {
      rpcCalls.push({ name, payload });
      return Promise.resolve({ data: null, error: null });
    }),
  };

  return { supabase, historyInserts, accountUpdates, rpcCalls };
}

function runnerFor(args: {
  supabase: ReturnType<typeof makeSupabase>['supabase'];
  step: MacroStep;
  backendResult: { success: boolean; output: Record<string, unknown>; error?: string };
  definitionOverride?: MacroDefinition;
  retryBackoffPolicy?: ConstructorParameters<typeof SingleDeviceStepRunner>[0]['retryBackoffPolicy'];
}) {
  return new SingleDeviceStepRunner({
    supabase: args.supabase as never,
    backend: {
      connect: vi.fn(),
      disconnect: vi.fn(),
      executeStep: vi.fn().mockResolvedValue(args.backendResult),
    },
    runId: 'run-1',
    claimToken: 'claim-1',
    device,
    definition: args.definitionOverride ?? definition(args.step),
    retryBackoffPolicy: args.retryBackoffPolicy,
    triggeredByUserId: 'user-1',
    inputVariables: { accountId: 'account-1' },
  });
}

function retryRunnerFor(args: {
  supabase: ReturnType<typeof makeSupabase>['supabase'];
  step: MacroStep;
  backendResults: Array<{ success: boolean; output: Record<string, unknown>; error?: string }>;
}) {
  const executeStep = vi.fn();
  for (const result of args.backendResults) {
    executeStep.mockResolvedValueOnce(result);
  }

  return {
    executeStep,
    runner: new SingleDeviceStepRunner({
      supabase: args.supabase as never,
      backend: {
        connect: vi.fn(),
        disconnect: vi.fn(),
        executeStep,
      },
      runId: 'run-1',
      claimToken: 'claim-1',
      device,
      definition: retryDefinition(args.step),
      retryBackoffPolicy: {
        maxRetries: 2,
        baseDelayMs: 0,
        maxDelayMs: 0,
        maxElapsedMs: 1000,
      },
      triggeredByUserId: 'user-1',
      inputVariables: { accountId: 'account-1' },
    }),
  };
}

describe('single-device step runner account budgets', () => {
  beforeEach(() => {
    persistedSteps.length = 0;
    vi.clearAllMocks();
  });

  it('WORK-CAN-009 blocks budgeted steps when the daily action budget is exhausted', async () => {
    const supabase = makeSupabase({
      account: account({ daily_action_limit: 5 }),
      history: [history(), history()],
    });

    const result = await runnerFor({
      supabase: supabase.supabase,
      step: budgetedStep(),
      backendResult: { success: true, output: { ok: true } },
    }).run();

    expect(result.status).toBe('FAILED');
    expect(persistedSteps).toContainEqual(expect.objectContaining({
      status: 'FAILED',
      errorPayload: expect.objectContaining({ code: 'BUDGET_EXCEEDED' }),
    }));
    expect(supabase.historyInserts).toHaveLength(0);
    expect(supabase.rpcCalls).toHaveLength(0);
  });

  it('WORK-CAN-010 records action history and increments account count after a successful budgeted step', async () => {
    const supabase = makeSupabase({
      account: account({ daily_action_limit: 10 }),
      history: [],
    });

    const result = await runnerFor({
      supabase: supabase.supabase,
      step: budgetedStep(),
      backendResult: { success: true, output: { ok: true } },
    }).run();

    expect(result.status).toBe('COMPLETED');
    expect(supabase.historyInserts).toEqual([
      {
        account_id: 'account-1',
        action_type: 'like',
        step_id: null,
        source_run_id: 'run-1',
        source_step_id: 'like-step',
        success: true,
      },
    ]);
    expect(supabase.rpcCalls).toEqual([
      {
        name: 'increment_account_action_count',
        payload: { p_account_id: 'account-1' },
      },
    ]);
  });

  it('records Instagram pilot open history without consuming the action budget counter', async () => {
    const supabase = makeSupabase({
      account: account({ daily_action_limit: 10 }),
      history: [],
    });

    const result = await runnerFor({
      supabase: supabase.supabase,
      step: {
        id: 'capture_pilot_evidence',
        type: 'screenshot',
        params: { actionHistoryType: 'instagram_pilot_open' },
      },
      backendResult: { success: true, output: { screenshot: true } },
    }).run();

    expect(result.status).toBe('COMPLETED');
    expect(supabase.historyInserts).toEqual([
      {
        account_id: 'account-1',
        action_type: 'instagram_pilot_open',
        step_id: null,
        source_run_id: 'run-1',
        source_step_id: 'capture_pilot_evidence',
        success: true,
      },
    ]);
    expect(supabase.rpcCalls).toHaveLength(0);
  });

  it('WORK-CAN-011 marks an account blocked when a failed step contains a block signature', async () => {
    const supabase = makeSupabase({
      account: account({ daily_action_limit: 10 }),
      history: [],
    });

    const result = await runnerFor({
      supabase: supabase.supabase,
      step: budgetedStep('blocked-step'),
      backendResult: {
        success: false,
        output: {},
        error: 'Action blocked. Try again later.',
      },
    }).run();

    expect(result.status).toBe('FAILED');
    expect(supabase.accountUpdates).toEqual([
      expect.objectContaining({
        is_blocked: true,
        detected_block_reason: 'Detected keyword: "action blocked"',
      }),
    ]);
    expect(mockCreateLogArtifact).toHaveBeenCalledWith(
      supabase.supabase,
      'run-1',
      'device-1',
      'blocked-step',
      'Action blocked. Try again later.',
      expect.objectContaining({ source: 'step-error' })
    );
  });

  it('WORK-NO-007 retries only within policy and records retry reason metadata', async () => {
    const supabase = makeSupabase({
      account: account({ daily_action_limit: 10 }),
      history: [],
    });
    const { runner, executeStep } = retryRunnerFor({
      supabase: supabase.supabase,
      step: budgetedStep('retry-step'),
      backendResults: [
        { success: false, output: {}, error: 'Transient bridge error' },
        { success: true, output: { ok: true } },
      ],
    });

    const result = await runner.run();

    expect(result.status).toBe('COMPLETED');
    expect(executeStep).toHaveBeenCalledTimes(2);
    expect(persistedSteps).toContainEqual(expect.objectContaining({
      status: 'RETRYING',
      retryCount: 1,
      output: expect.objectContaining({
        retryReason: 'Transient bridge error',
        nextRetryDelayMs: 0,
      }),
    }));
  });
});
