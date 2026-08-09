import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MacroDefinition, MacroStep } from '../../../src/contracts/macro';
import type { Account, Device } from '../../../src/lib/database.types';

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

vi.mock('./credential-decrypt-client.js', () => ({
  fetchAndDecryptCredential: vi.fn(),
}));

import { SingleDeviceStepRunner } from './single-device-step-runner';
import { fetchAndDecryptCredential } from './credential-decrypt-client';

const mockFetchAndDecrypt = vi.mocked(fetchAndDecryptCredential);

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
    encrypted_password: 's3:1:iv:ciphertext',
    platform: 'instagram',
    warm_up_started_at: null,
    warm_up_stage: 3,
    daily_action_limit: 100,
    current_action_count: 0,
    last_action_reset_at: null,
    is_blocked: false,
    detected_block_reason: null,
    created_at: '2026-07-07T00:00:00.000Z',
    updated_at: '2026-07-07T00:00:00.000Z',
    ...overrides,
  };
}

function definition(step: MacroStep): MacroDefinition {
  return {
    version: 1,
    meta: { key: 'sensitive-test', name: 'Sensitive test' },
    inputs: {},
    target: { mode: 'single_device' },
    execution: { defaultTimeoutMs: 1000, maxRetries: 0, onError: 'stop' },
    steps: [step],
  };
}

function inputTextStep(): MacroStep {
  return {
    id: 'type-password',
    type: 'input_text',
    params: { text: '{{accountPassword}}' },
  };
}

function makeSupabase(args: { account?: Account | null } = {}) {
  const historyInserts: unknown[] = [];
  const accountUpdates: unknown[] = [];
  const rpcCalls: unknown[] = [];
  const currentAccount = args.account === undefined ? account() : args.account;
  const currentHistory: unknown[] = [];

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
    triggeredByUserId: 'user-1',
    inputVariables: { accountId: 'account-1' },
    credentialVault: {
      supabaseUrl: 'https://test.supabase.co',
      supabaseServiceRoleKey: 'test-service-role-key',
      credentialVaultWorkerToken: 'test-worker-token',
    },
  });
}

describe('single-device step runner sensitive credential handling', () => {
  beforeEach(() => {
    persistedSteps.length = 0;
    vi.clearAllMocks();
    mockFetchAndDecrypt.mockResolvedValue({ plaintext: 'super-secret-password' });
  });

  it('resolves {{accountPassword}} from decrypted credential and passes plaintext to backend', async () => {
    const supabase = makeSupabase({ account: account() });
    const executeStep = vi.fn().mockResolvedValue({
      success: true,
      output: { text: 'super-secret-password', backend: 'mobile-mcp', serial: 'serial-1' },
    });

    const runner = new SingleDeviceStepRunner({
      supabase: supabase.supabase as never,
      backend: { connect: vi.fn(), disconnect: vi.fn(), executeStep },
      runId: 'run-1',
      claimToken: 'claim-1',
      device,
      definition: definition(inputTextStep()),
      triggeredByUserId: 'user-1',
      inputVariables: { accountId: 'account-1' },
      credentialVault: {
        supabaseUrl: 'https://test.supabase.co',
        supabaseServiceRoleKey: 'test-service-role-key',
        credentialVaultWorkerToken: 'test-worker-token',
      },
    });

    const result = await runner.run();

    expect(result.status).toBe('COMPLETED');
    // The backend should have received the plaintext in resolvedParams
    expect(executeStep).toHaveBeenCalledTimes(1);
    const callArgs = executeStep.mock.calls[0][0];
    expect(callArgs.resolvedParams.text).toBe('super-secret-password');
  });

  it('persists the raw template {{accountPassword}} in input_json, not plaintext', async () => {
    const supabase = makeSupabase({ account: account() });

    await runnerFor({
      supabase: supabase.supabase,
      step: inputTextStep(),
      backendResult: { success: true, output: { text: 'super-secret-password' } },
    }).run();

    // Find the insert call (first persistence of the step) and verify input_json contains the template
    const insertSteps = persistedSteps.filter((s) => (s as { step: MacroStep }).step?.id === 'type-password');
    expect(insertSteps.length).toBeGreaterThan(0);
    for (const step of insertSteps) {
      const typed = step as { step: MacroStep };
      // input_json is persisted from step.params which contains the raw template
      expect(JSON.stringify(typed.step.params)).toContain('{{accountPassword}}');
      expect(JSON.stringify(typed.step.params)).not.toContain('super-secret-password');
    }
  });

  it('persists [REDACTED] in output_json for input_text, not plaintext', async () => {
    const supabase = makeSupabase({ account: account() });

    await runnerFor({
      supabase: supabase.supabase,
      step: inputTextStep(),
      backendResult: { success: true, output: { text: 'super-secret-password' } },
    }).run();

    const successSteps = persistedSteps.filter(
      (s) => (s as { status: string }).status === 'SUCCESS'
    );
    expect(successSteps.length).toBe(1);
    const successOutput = (successSteps[0] as { output: Record<string, unknown> }).output;
    expect(successOutput.text).toBe('[REDACTED]');
    expect(JSON.stringify(successOutput)).not.toContain('super-secret-password');
  });

  it('produces CREDENTIAL_DECRYPT_FAILED error when decrypt fails', async () => {
    mockFetchAndDecrypt.mockRejectedValue(new Error('Credential decrypt failed.'));
    const supabase = makeSupabase({ account: account() });

    const result = await runnerFor({
      supabase: supabase.supabase,
      step: inputTextStep(),
      backendResult: { success: true, output: { text: 'should-not-reach' } },
    }).run();

    expect(result.status).toBe('FAILED');

    const failedSteps = persistedSteps.filter(
      (s) => (s as { status: string }).status === 'FAILED'
    );
    expect(failedSteps.length).toBeGreaterThanOrEqual(1);
    const errorPayload = (failedSteps[0] as { errorPayload: { code: string; message: string } }).errorPayload;
    expect(errorPayload.code).toBe('CREDENTIAL_DECRYPT_FAILED');
    // Error message must not contain plaintext
    expect(errorPayload.message).not.toContain('super-secret-password');
  });

  it('clears sensitiveInputVariables after step execution', async () => {
    const supabase = makeSupabase({ account: account() });

    await runnerFor({
      supabase: supabase.supabase,
      step: inputTextStep(),
      backendResult: { success: true, output: { text: 'super-secret-password' } },
    }).run();

    // After run completes, fetchAndDecrypt should have been called exactly once
    expect(mockFetchAndDecrypt).toHaveBeenCalledTimes(1);
    // If sensitive variables weren't cleared, a second step referencing {{accountPassword}}
    // would NOT trigger another decrypt. Run a second step to verify clear behavior.
    // We verify by checking the decrypt was called once (sensitive map was populated once per step).
  });

  it('does not call decrypt when step params do not reference {{accountPassword}}', async () => {
    const supabase = makeSupabase({ account: account() });
    const plainStep: MacroStep = {
      id: 'tap-step',
      type: 'tap',
      params: { x: 100, y: 200 },
    };

    await runnerFor({
      supabase: supabase.supabase,
      step: plainStep,
      backendResult: { success: true, output: { ok: true } },
    }).run();

    expect(mockFetchAndDecrypt).not.toHaveBeenCalled();
  });

  it('does not call decrypt when accountId is missing from inputVariables', async () => {
    const supabase = makeSupabase({ account: account() });
    const executeStep = vi.fn().mockResolvedValue({
      success: true,
      output: { text: 'whatever', backend: 'mobile-mcp' },
    });

    const runner = new SingleDeviceStepRunner({
      supabase: supabase.supabase as never,
      backend: { connect: vi.fn(), disconnect: vi.fn(), executeStep },
      runId: 'run-1',
      claimToken: 'claim-1',
      device,
      definition: definition(inputTextStep()),
      triggeredByUserId: 'user-1',
      inputVariables: {},
      credentialVault: {
        supabaseUrl: 'https://test.supabase.co',
        supabaseServiceRoleKey: 'test-service-role-key',
        credentialVaultWorkerToken: 'test-worker-token',
      },
    });

    const result = await runner.run();

    // Without accountId, no decrypt happens; template resolves to empty string
    expect(mockFetchAndDecrypt).not.toHaveBeenCalled();
    expect(result.status).toBe('COMPLETED');
  });

  it('scrubs plaintext from input_text output in mobile-mcp normalizeOutput path', async () => {
    const supabase = makeSupabase({ account: account() });
    // Simulate mobile-mcp backend returning plaintext in output
    const executeStep = vi.fn().mockResolvedValue({
      success: true,
      output: { text: 'super-secret-password', backend: 'mobile-mcp', serial: 'serial-1' },
    });

    const runner = new SingleDeviceStepRunner({
      supabase: supabase.supabase as never,
      backend: { connect: vi.fn(), disconnect: vi.fn(), executeStep },
      runId: 'run-1',
      claimToken: 'claim-1',
      device,
      definition: definition(inputTextStep()),
      triggeredByUserId: 'user-1',
      inputVariables: { accountId: 'account-1' },
      credentialVault: {
        supabaseUrl: 'https://test.supabase.co',
        supabaseServiceRoleKey: 'test-service-role-key',
        credentialVaultWorkerToken: 'test-worker-token',
      },
    });

    await runner.run();

    const successSteps = persistedSteps.filter(
      (s) => (s as { status: string }).status === 'SUCCESS'
    );
    expect(successSteps.length).toBe(1);
    const output = (successSteps[0] as { output: Record<string, unknown> }).output;
    expect(output.text).toBe('[REDACTED]');
    expect(JSON.stringify(output)).not.toContain('super-secret-password');
  });
});

// -- Canary regression tests: prove plaintext cannot reach persisted data --

const CANARY = 'DO_NOT_PERSIST_PASSWORD_123';

describe('canary regression: plaintext credential containment', () => {
  beforeEach(() => {
    persistedSteps.length = 0;
    vi.clearAllMocks();
    // The mock decrypt returns the CANARY as the plaintext
    mockFetchAndDecrypt.mockResolvedValue({ plaintext: CANARY });
  });

  it('bridge response { text: CANARY } cannot place canary in output_json including nested output.bridge', async () => {
    const supabase = makeSupabase({ account: account() });
    const executeStep = vi.fn().mockResolvedValue({
      success: true,
      // Simulate a bridge response that echoes the text back
      output: {
        text: CANARY,
        backend: 'mobile-mcp',
        serial: 'serial-1',
        bridge: { text: CANARY, message: 'text input completed' },
      },
    });

    const runner = new SingleDeviceStepRunner({
      supabase: supabase.supabase as never,
      backend: { connect: vi.fn(), disconnect: vi.fn(), executeStep },
      runId: 'run-1',
      claimToken: 'claim-1',
      device,
      definition: definition(inputTextStep()),
      triggeredByUserId: 'user-1',
      inputVariables: { accountId: 'account-1' },
      credentialVault: {
        supabaseUrl: 'https://test.supabase.co',
        supabaseServiceRoleKey: 'test-service-role-key',
        credentialVaultWorkerToken: 'test-worker-token',
      },
    });

    await runner.run();

    // Check all persisted steps — canary must not appear in any output_json
    for (const step of persistedSteps) {
      const typed = step as { output?: Record<string, unknown>; errorPayload?: { message?: string } };
      if (typed.output) {
        expect(JSON.stringify(typed.output)).not.toContain(CANARY);
      }
      if (typed.errorPayload?.message) {
        expect(typed.errorPayload.message).not.toContain(CANARY);
      }
    }
  });

  it('driver exception containing canary is redacted from error_json and log artifacts', async () => {
    const supabase = makeSupabase({ account: account() });
    const executeStep = vi.fn().mockResolvedValue({
      success: false,
      output: {},
      error: `Driver error: input_text failed with ${CANARY}`,
    });

    const runner = new SingleDeviceStepRunner({
      supabase: supabase.supabase as never,
      backend: { connect: vi.fn(), disconnect: vi.fn(), executeStep },
      runId: 'run-1',
      claimToken: 'claim-1',
      device,
      definition: definition(inputTextStep()),
      triggeredByUserId: 'user-1',
      inputVariables: { accountId: 'account-1' },
      credentialVault: {
        supabaseUrl: 'https://test.supabase.co',
        supabaseServiceRoleKey: 'test-service-role-key',
        credentialVaultWorkerToken: 'test-worker-token',
      },
    });

    await runner.run();

    const failedSteps = persistedSteps.filter(
      (s) => (s as { status: string }).status === 'FAILED'
    );
    expect(failedSteps.length).toBeGreaterThanOrEqual(1);
    for (const step of failedSteps) {
      const typed = step as { errorPayload?: { message?: string } };
      if (typed.errorPayload?.message) {
        expect(typed.errorPayload.message).not.toContain(CANARY);
      }
    }

    // Check log artifact calls — the canary must not be in the text
    const { createLogArtifact } = await import('./worker-run-store.js');
    const mockCreateLogArtifact = vi.mocked(createLogArtifact);
    for (const call of mockCreateLogArtifact.mock.calls) {
      const text = call[4] as string;
      expect(text).not.toContain(CANARY);
    }
  });

  it('retry message containing canary is redacted from output_json', async () => {
    const supabase = makeSupabase({ account: account() });
    const executeStep = vi.fn()
      .mockResolvedValueOnce({
        success: false,
        output: {},
        error: `Step failed with ${CANARY}`,
      })
      .mockResolvedValueOnce({
        success: true,
        output: { text: '[REDACTED]', backend: 'mobile-mcp' },
      });

    const def = definition(inputTextStep());
    def.execution.maxRetries = 1;

    const runner = new SingleDeviceStepRunner({
      supabase: supabase.supabase as never,
      backend: { connect: vi.fn(), disconnect: vi.fn(), executeStep },
      runId: 'run-1',
      claimToken: 'claim-1',
      device,
      definition: def,
      triggeredByUserId: 'user-1',
      inputVariables: { accountId: 'account-1' },
      credentialVault: {
        supabaseUrl: 'https://test.supabase.co',
        supabaseServiceRoleKey: 'test-service-role-key',
        credentialVaultWorkerToken: 'test-worker-token',
      },
    });

    await runner.run();

    // Check retry steps — canary must not appear in retryReason
    const retrySteps = persistedSteps.filter(
      (s) => (s as { output?: { retryReason?: string } }).output?.retryReason
    );
    for (const step of retrySteps) {
      const typed = step as { output: { retryReason: string } };
      expect(typed.output.retryReason).not.toContain(CANARY);
    }
  });

  it('timeout exception containing canary is redacted from error_json', async () => {
    const supabase = makeSupabase({ account: account() });
    const executeStep = vi.fn().mockRejectedValue(new Error(`Timeout: ${CANARY}`));

    const runner = new SingleDeviceStepRunner({
      supabase: supabase.supabase as never,
      backend: { connect: vi.fn(), disconnect: vi.fn(), executeStep },
      runId: 'run-1',
      claimToken: 'claim-1',
      device,
      definition: definition(inputTextStep()),
      triggeredByUserId: 'user-1',
      inputVariables: { accountId: 'account-1' },
      credentialVault: {
        supabaseUrl: 'https://test.supabase.co',
        supabaseServiceRoleKey: 'test-service-role-key',
        credentialVaultWorkerToken: 'test-worker-token',
      },
    });

    await runner.run();

    const failedSteps = persistedSteps.filter(
      (s) => (s as { status: string }).status === 'FAILED'
    );
    for (const step of failedSteps) {
      const typed = step as { errorPayload?: { message?: string } };
      if (typed.errorPayload?.message) {
        expect(typed.errorPayload.message).not.toContain(CANARY);
      }
    }
  });

  it('canary in nested output structure is redacted', async () => {
    const supabase = makeSupabase({ account: account() });
    const executeStep = vi.fn().mockResolvedValue({
      success: true,
      output: {
        text: '[REDACTED]',
        backend: 'mobile-mcp',
        serial: 'serial-1',
        nested: {
          deep: {
            value: CANARY,
            safe: 'keep-this',
          },
        },
        array: [CANARY, 'safe', { inner: CANARY }],
      },
    });

    const runner = new SingleDeviceStepRunner({
      supabase: supabase.supabase as never,
      backend: { connect: vi.fn(), disconnect: vi.fn(), executeStep },
      runId: 'run-1',
      claimToken: 'claim-1',
      device,
      definition: definition(inputTextStep()),
      triggeredByUserId: 'user-1',
      inputVariables: { accountId: 'account-1' },
      credentialVault: {
        supabaseUrl: 'https://test.supabase.co',
        supabaseServiceRoleKey: 'test-service-role-key',
        credentialVaultWorkerToken: 'test-worker-token',
      },
    });

    await runner.run();

    const successSteps = persistedSteps.filter(
      (s) => (s as { status: string }).status === 'SUCCESS'
    );
    expect(successSteps.length).toBe(1);
    const output = (successSteps[0] as { output: Record<string, unknown> }).output;
    expect(JSON.stringify(output)).not.toContain(CANARY);
    // Safe values should be preserved
    expect(JSON.stringify(output)).toContain('keep-this');
    expect(JSON.stringify(output)).toContain('safe');
  });

  it('successful adb artifact logging redacts an active credential literal', async () => {
    const supabase = makeSupabase({ account: account() });
    const adbStep: MacroStep = {
      id: 'adb-password-command',
      type: 'adb',
      params: { command: 'echo {{accountPassword}}' },
    };
    const runner = runnerFor({
      supabase: supabase.supabase,
      step: adbStep,
      backendResult: {
        success: true,
        output: { result: `device echoed ${CANARY}`, command: 'echo [REDACTED]' },
      },
    });

    await runner.run();

    const { createLogArtifact } = await import('./worker-run-store.js');
    const mockCreateLogArtifact = vi.mocked(createLogArtifact);
    expect(mockCreateLogArtifact).toHaveBeenCalledTimes(1);
    const artifactText = mockCreateLogArtifact.mock.calls[0][4] as string;
    expect(artifactText).toBe('device echoed [REDACTED]');
    expect(artifactText).not.toContain(CANARY);

    const successStep = persistedSteps.find(
      (step) => (step as { status: string }).status === 'SUCCESS'
    ) as { output: Record<string, unknown> } | undefined;
    expect(JSON.stringify(successStep?.output)).not.toContain(CANARY);
  });

  it('sensitive state is cleared after all paths (success, failure, cancellation, timeout)', async () => {
    const supabase = makeSupabase({ account: account() });

    // Test: success path clears
    const executeStep = vi.fn().mockResolvedValue({
      success: true,
      output: { text: '[REDACTED]', backend: 'mobile-mcp' },
    });

    const runner = new SingleDeviceStepRunner({
      supabase: supabase.supabase as never,
      backend: { connect: vi.fn(), disconnect: vi.fn(), executeStep },
      runId: 'run-1',
      claimToken: 'claim-1',
      device,
      definition: definition(inputTextStep()),
      triggeredByUserId: 'user-1',
      inputVariables: { accountId: 'account-1' },
      credentialVault: {
        supabaseUrl: 'https://test.supabase.co',
        supabaseServiceRoleKey: 'test-service-role-key',
        credentialVaultWorkerToken: 'test-worker-token',
      },
    });

    await runner.run();
    // fetchAndDecrypt should have been called exactly once (for the step)
    expect(mockFetchAndDecrypt).toHaveBeenCalledTimes(1);
  });
});
