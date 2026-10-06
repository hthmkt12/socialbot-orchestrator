import { afterEach, describe, expect, it, vi } from 'vitest';
import { MobilerunStepBackend } from './mobilerun-step-backend.js';
import type { DeviceStepExecutionArgs } from './device-step-backend.js';
import type { Device } from '../../../src/lib/database.types';
import type { MacroStep } from '../../../src/contracts/macro';

const mockDevice: Device = {
  id: 'device-1',
  laixi_device_id: 'serial-123',
  name: 'Pixel 7',
  model: 'Pixel 7',
  brand: 'Google',
  android_version: '13',
  screen_width: 1080,
  screen_height: 2400,
  status: 'ONLINE',
  last_seen_at: '2026-10-06T00:00:00Z',
  heartbeat_freshness: 'fresh',
  last_error_message: null,
  last_error_at: null,
  metadata_json: { platform: 'android' },
  created_at: '2026-10-06T00:00:00Z',
  updated_at: '2026-10-06T00:00:00Z',
};

function createStepArgs(goal = 'Open settings and tap wifi'): DeviceStepExecutionArgs {
  const step: MacroStep = {
    id: 'ai-task-step-1',
    type: 'ai_task',
    params: { goal, timeout: 5000 },
  };

  return {
    step,
    runId: 'run-ai-1',
    device: mockDevice,
    resolvedParams: { goal, timeout: 5000 },
    isCancelled: vi.fn().mockResolvedValue(false),
  };
}

describe('MobilerunStepBackend retry and execution', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('retries on network failure with exponential backoff and succeeds on subsequent attempt', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error('fetch failed: socket hang up');
      }
      return {
        ok: true,
        json: async () => ({
          success: true,
          output: {
            reason: 'Task finished successfully',
            steps: 3,
            structured_output: { result: 'connected' },
          },
        }),
      };
    });

    vi.stubGlobal('fetch', mockFetch);

    const backend = new MobilerunStepBackend('http://localhost:4321', 10000, 'test-token');
    const result = await backend.executeStep(createStepArgs());

    expect(callCount).toBe(2);
    expect(result.success).toBe(true);
    expect(result.output).toEqual(
      expect.objectContaining({
        goal: 'Open settings and tap wifi',
        reason: 'Task finished successfully',
        steps: 3,
        backend: 'mobilerun',
        serial: 'serial-123',
      })
    );
  });

  it('fails cleanly without throw when retries are exhausted', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('fetch failed: ECONNREFUSED'));
    vi.stubGlobal('fetch', mockFetch);

    const backend = new MobilerunStepBackend('http://localhost:4321', 5000);
    const result = await backend.executeStep(createStepArgs());

    expect(result.success).toBe(false);
    expect(result.error).toContain('ECONNREFUSED');
    expect(mockFetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('rejects without fetch when goal is missing', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const backend = new MobilerunStepBackend('http://localhost:4321', 5000);
    const args = createStepArgs('');
    args.resolvedParams.goal = '';

    const result = await backend.executeStep(args);

    expect(result.success).toBe(false);
    expect(result.error).toContain('requires a non-empty "goal" param');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
