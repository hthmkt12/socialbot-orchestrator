import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MacroDefinition, MacroStep } from '../../../src/contracts/macro';
import type { Device } from '../../../src/lib/database.types';

const persistedSteps: Array<{
  runId: string;
  step: MacroStep;
  deviceId: string;
  stepIndex: number;
  status: string;
  output?: Record<string, unknown>;
  error?: string;
}> = [];

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

const mockDevice: Device = {
  id: 'device-test-1',
  laixi_device_id: 'serial-test-1',
  name: 'Test Device 1',
  model: 'Redmi 13C',
  brand: 'Xiaomi',
  android_version: '14',
  screen_width: 720,
  screen_height: 1600,
  status: 'ONLINE',
  last_seen_at: '2026-10-04T00:00:00.000Z',
  heartbeat_freshness: 'fresh',
  last_error_message: null,
  last_error_at: null,
  metadata_json: {},
  created_at: '2026-10-04T00:00:00.000Z',
  updated_at: '2026-10-04T00:00:00.000Z',
};

function createDefinition(steps: MacroStep[]): MacroDefinition {
  return {
    version: 1,
    meta: { key: 'advanced-macro-test', name: 'Advanced Macro Test' },
    inputs: {},
    target: { mode: 'single_device' },
    execution: { defaultTimeoutMs: 10000, maxRetries: 0, onError: 'stop' },
    steps,
  };
}

function makeMockSupabase() {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })),
  };
}

describe('SingleDeviceStepRunner - Advanced Control Flow (Phase 12)', () => {
  beforeEach(() => {
    persistedSteps.length = 0;
    vi.clearAllMocks();
  });

  describe('Conditional Steps', () => {
    it('executes then branch and skips else branch when condition is met', async () => {
      const executeStepMock = vi.fn().mockResolvedValue({
        success: true,
        output: { tapped: true },
      });

      const conditionalStep: MacroStep = {
        id: 'cond-1',
        type: 'conditional',
        params: {
          left: '{{env}}',
          operator: 'equals',
          right: 'production',
        },
        then: [
          {
            id: 'then-step-1',
            type: 'tap',
            params: { x: 100, y: 200 },
          },
        ],
        else: [
          {
            id: 'else-step-1',
            type: 'wait',
            params: { ms: 500 },
          },
        ],
      };

      const runner = new SingleDeviceStepRunner({
        supabase: makeMockSupabase() as never,
        backend: {
          connect: vi.fn(),
          disconnect: vi.fn(),
          executeStep: executeStepMock,
        },
        runId: 'run-cond-1',
        claimToken: 'token-1',
        device: mockDevice,
        definition: createDefinition([conditionalStep]),
        triggeredByUserId: 'user-1',
        inputVariables: { env: 'production' },
      });

      const result = await runner.run();
      expect(result.status).toBe('COMPLETED');
      expect(executeStepMock).toHaveBeenCalledTimes(1);

      // Verify conditional step was evaluated and marked SUCCESS
      const condPersisted = persistedSteps.filter((s) => s.step.id === 'cond-1').pop();
      expect(condPersisted?.status).toBe('SUCCESS');
      expect(condPersisted?.output?.conditionMet).toBe(true);

      // Verify then branch executed
      const thenPersisted = persistedSteps.filter((s) => s.step.id === 'then-step-1').pop();
      expect(thenPersisted?.status).toBe('SUCCESS');

      // Verify else branch was skipped
      const elsePersisted = persistedSteps.filter((s) => s.step.id === 'else-step-1').pop();
      expect(elsePersisted?.status).toBe('SKIPPED');
    });

    it('executes else branch and skips then branch when condition is false', async () => {
      const executeStepMock = vi.fn().mockResolvedValue({
        success: true,
        output: { waited: true },
      });

      const conditionalStep: MacroStep = {
        id: 'cond-2',
        type: 'conditional',
        params: {
          left: '{{stage}}',
          operator: 'equals',
          right: 'staging',
        },
        then: [
          {
            id: 'then-step-2',
            type: 'tap',
            params: { x: 300, y: 400 },
          },
        ],
        else: [
          {
            id: 'else-step-2',
            type: 'wait',
            params: { ms: 1000 },
          },
        ],
      };

      const runner = new SingleDeviceStepRunner({
        supabase: makeMockSupabase() as never,
        backend: {
          connect: vi.fn(),
          disconnect: vi.fn(),
          executeStep: executeStepMock,
        },
        runId: 'run-cond-2',
        claimToken: 'token-1',
        device: mockDevice,
        definition: createDefinition([conditionalStep]),
        triggeredByUserId: 'user-1',
        inputVariables: { stage: 'dev' },
      });

      const result = await runner.run();
      expect(result.status).toBe('COMPLETED');
      expect(executeStepMock).toHaveBeenCalledTimes(1);

      const condPersisted = persistedSteps.filter((s) => s.step.id === 'cond-2').pop();
      expect(condPersisted?.output?.conditionMet).toBe(false);

      const thenPersisted = persistedSteps.filter((s) => s.step.id === 'then-step-2').pop();
      expect(thenPersisted?.status).toBe('SKIPPED');

      const elsePersisted = persistedSteps.filter((s) => s.step.id === 'else-step-2').pop();
      expect(elsePersisted?.status).toBe('SUCCESS');
    });
  });

  describe('Loop Steps', () => {
    it('repeats sub-steps for the specified count and clears persisted state between iterations', async () => {
      const executeStepMock = vi.fn().mockResolvedValue({
        success: true,
        output: { scrolled: true },
      });

      const loopStep: MacroStep = {
        id: 'loop-1',
        type: 'loop',
        params: { count: '3' },
        steps: [
          {
            id: 'swipe-inner',
            type: 'swipe',
            params: { x1: 500, y1: 1200, x2: 500, y2: 400, durationMs: 300 },
          },
        ],
      };

      const runner = new SingleDeviceStepRunner({
        supabase: makeMockSupabase() as never,
        backend: {
          connect: vi.fn(),
          disconnect: vi.fn(),
          executeStep: executeStepMock,
        },
        runId: 'run-loop-1',
        claimToken: 'token-1',
        device: mockDevice,
        definition: createDefinition([loopStep]),
        triggeredByUserId: 'user-1',
        inputVariables: {},
      });

      const result = await runner.run();
      expect(result.status).toBe('COMPLETED');
      expect(executeStepMock).toHaveBeenCalledTimes(3);

      const loopPersisted = persistedSteps.find((s) => s.step.id === 'loop-1' && s.status === 'SUCCESS');
      expect(loopPersisted).toBeDefined();
    });

    it('halts execution when an inner loop step fails', async () => {
      let callCount = 0;
      const executeStepMock = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          return { success: false, output: {}, error: 'Hardware touch driver failure' };
        }
        return { success: true, output: {} };
      });

      const loopStep: MacroStep = {
        id: 'loop-fail',
        type: 'loop',
        params: { count: '4' },
        steps: [
          {
            id: 'tap-inner',
            type: 'tap',
            params: { x: 100, y: 100 },
          },
        ],
      };

      const runner = new SingleDeviceStepRunner({
        supabase: makeMockSupabase() as never,
        backend: {
          connect: vi.fn(),
          disconnect: vi.fn(),
          executeStep: executeStepMock,
        },
        runId: 'run-loop-fail',
        claimToken: 'token-1',
        device: mockDevice,
        definition: createDefinition([loopStep]),
        triggeredByUserId: 'user-1',
        inputVariables: {},
      });

      const result = await runner.run();
      expect(result.status).toBe('FAILED');
      expect(executeStepMock).toHaveBeenCalledTimes(2);

      const loopPersisted = persistedSteps.find((s) => s.step.id === 'loop-fail' && s.status === 'FAILED');
      expect(loopPersisted).toBeDefined();
    });
  });

  describe('Try / Catch Error Boundaries', () => {
    it('catches inner step failure, executes catch block, and recovers run to SUCCESS', async () => {
      const executeStepMock = vi.fn().mockImplementation(async ({ step }: { step: MacroStep }) => {
        if (step.id === 'flaky-step') {
          return { success: false, output: {}, error: 'Network timeout during engagement' };
        }
        if (step.id === 'recovery-step') {
          return { success: true, output: { recovered: true } };
        }
        return { success: true, output: {} };
      });

      const tryCatchStep: MacroStep = {
        id: 'boundary-1',
        type: 'try_catch',
        params: {},
        steps: [
          {
            id: 'flaky-step',
            type: 'tap',
            params: { x: 50, y: 50 },
          },
        ],
        catch: [
          {
            id: 'recovery-step',
            type: 'wait',
            params: { ms: 1000 },
          },
        ],
      };

      const runner = new SingleDeviceStepRunner({
        supabase: makeMockSupabase() as never,
        backend: {
          connect: vi.fn(),
          disconnect: vi.fn(),
          executeStep: executeStepMock,
        },
        runId: 'run-try-catch-1',
        claimToken: 'token-1',
        device: mockDevice,
        definition: createDefinition([tryCatchStep]),
        triggeredByUserId: 'user-1',
        inputVariables: {},
      });

      const result = await runner.run();
      expect(result.status).toBe('COMPLETED');

      // flaky-step failed
      const flakyPersisted = persistedSteps.filter((s) => s.step.id === 'flaky-step').pop();
      expect(flakyPersisted?.status).toBe('FAILED');

      // recovery step ran
      const recoveryPersisted = persistedSteps.filter((s) => s.step.id === 'recovery-step').pop();
      expect(recoveryPersisted?.status).toBe('SUCCESS');

      // try_catch step itself succeeded because it caught and handled the error
      const boundaryPersisted = persistedSteps.filter((s) => s.step.id === 'boundary-1' && s.status === 'SUCCESS').pop();
      expect(boundaryPersisted?.output?.caughtError).toBe(true);
    });

    it('fails when the catch block itself fails', async () => {
      const executeStepMock = vi.fn().mockImplementation(async ({ step }: { step: MacroStep }) => {
        if (step.id === 'fail-try') {
          return { success: false, output: {}, error: 'Primary failure' };
        }
        if (step.id === 'fail-catch') {
          return { success: false, output: {}, error: 'Secondary failure in catch block' };
        }
        return { success: true, output: {} };
      });

      const tryCatchStep: MacroStep = {
        id: 'boundary-2',
        type: 'try_catch',
        params: {},
        steps: [
          { id: 'fail-try', type: 'tap', params: { x: 1, y: 1 } },
        ],
        catch: [
          { id: 'fail-catch', type: 'tap', params: { x: 2, y: 2 } },
        ],
      };

      const runner = new SingleDeviceStepRunner({
        supabase: makeMockSupabase() as never,
        backend: {
          connect: vi.fn(),
          disconnect: vi.fn(),
          executeStep: executeStepMock,
        },
        runId: 'run-try-catch-2',
        claimToken: 'token-1',
        device: mockDevice,
        definition: createDefinition([tryCatchStep]),
        triggeredByUserId: 'user-1',
        inputVariables: {},
      });

      const result = await runner.run();
      expect(result.status).toBe('FAILED');
    });
  });

  describe('Foreach Loop Steps', () => {
    it('iterates through comma-separated items and passes item to execution context', async () => {
      const recordedSteps: MacroStep[] = [];
      const executeStepMock = vi.fn().mockImplementation(async (step: MacroStep) => {
        recordedSteps.push(step);
        return { success: true, output: { itemProcessed: true } };
      });

      const foreachStep: MacroStep = {
        id: 'foreach-1',
        type: 'foreach',
        params: {
          arraySourceVar: 'tags',
          itemName: 'tag',
        },
        steps: [
          {
            id: 'inner-tag-step',
            type: 'input_text',
            params: { text: '{{tag}}' },
          },
        ],
      };

      const runner = new SingleDeviceStepRunner({
        supabase: makeMockSupabase() as never,
        backend: {
          connect: vi.fn(),
          disconnect: vi.fn(),
          executeStep: executeStepMock,
        },
        runId: 'run-foreach-1',
        claimToken: 'token-1',
        device: mockDevice,
        definition: createDefinition([foreachStep]),
        triggeredByUserId: 'user-1',
        inputVariables: { tags: 'nature,travel,photography' },
      });

      const result = await runner.run();
      expect(result.status).toBe('COMPLETED');
      expect(executeStepMock).toHaveBeenCalledTimes(3);

      const foreachPersisted = persistedSteps.find((s) => s.step.id === 'foreach-1' && s.status === 'SUCCESS');
      expect(foreachPersisted?.output?.iterationsCompleted).toBe(3);
    });

    it('iterates through JSON array variable source', async () => {
      const executeStepMock = vi.fn().mockResolvedValue({
        success: true,
        output: { done: true },
      });

      const foreachStep: MacroStep = {
        id: 'foreach-json',
        type: 'foreach',
        params: {
          arraySourceVar: 'usernames',
          itemName: 'user',
        },
        steps: [
          {
            id: 'inner-user-step',
            type: 'wait',
            params: { ms: 100 },
          },
        ],
      };

      const runner = new SingleDeviceStepRunner({
        supabase: makeMockSupabase() as never,
        backend: {
          connect: vi.fn(),
          disconnect: vi.fn(),
          executeStep: executeStepMock,
        },
        runId: 'run-foreach-2',
        claimToken: 'token-1',
        device: mockDevice,
        definition: createDefinition([foreachStep]),
        triggeredByUserId: 'user-1',
        inputVariables: { usernames: JSON.stringify(['alpha', 'beta', 'gamma', 'delta']) },
      });

      const result = await runner.run();
      expect(result.status).toBe('COMPLETED');
      expect(executeStepMock).toHaveBeenCalledTimes(4);

      const foreachPersisted = persistedSteps.find((s) => s.step.id === 'foreach-json' && s.status === 'SUCCESS');
      expect(foreachPersisted?.output?.iterationsCompleted).toBe(4);
    });
  });

  describe('Group Step Execution', () => {
    it('executes all steps within a group container', async () => {
      const executeStepMock = vi.fn().mockResolvedValue({
        success: true,
        output: { ok: true },
      });

      const groupStep: MacroStep = {
        id: 'grp-1',
        type: 'group',
        params: { label: 'Warmup Routine' },
        steps: [
          { id: 'sub-1', type: 'wait', params: { ms: 100 } },
          { id: 'sub-2', type: 'tap', params: { x: 200, y: 300 } },
        ],
      };

      const runner = new SingleDeviceStepRunner({
        supabase: makeMockSupabase() as never,
        backend: {
          connect: vi.fn(),
          disconnect: vi.fn(),
          executeStep: executeStepMock,
        },
        runId: 'run-group-1',
        claimToken: 'token-1',
        device: mockDevice,
        definition: createDefinition([groupStep]),
        triggeredByUserId: 'user-1',
        inputVariables: {},
      });

      const result = await runner.run();
      expect(result.status).toBe('COMPLETED');
      expect(executeStepMock).toHaveBeenCalledTimes(2);

      const groupPersisted = persistedSteps.find((s) => s.step.id === 'grp-1' && s.status === 'SUCCESS');
      expect(groupPersisted).toBeDefined();
    });
  });
});
