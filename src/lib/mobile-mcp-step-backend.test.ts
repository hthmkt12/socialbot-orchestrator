import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Device } from './database.types';
import type { StepType } from '../contracts/macro';
import { MobileMcpStepBackend } from '../../services/execution-worker/src/mobile-mcp-step-backend';
import type { DeviceStepExecutionArgs } from '../../services/execution-worker/src/device-step-backend';

const fetchMock = vi.fn();

function device(overrides: Partial<Device> = {}): Device {
  return {
    id: 'device-1',
    laixi_device_id: 'serial-1',
    name: 'Pixel',
    model: 'Pixel',
    brand: 'Google',
    android_version: '14',
    screen_width: 1080,
    screen_height: 2400,
    status: 'ONLINE',
    last_seen_at: null,
    heartbeat_freshness: 'fresh',
    last_error_message: null,
    last_error_at: null,
    metadata_json: {},
    created_at: '2026-07-07T00:00:00.000Z',
    updated_at: '2026-07-07T00:00:00.000Z',
    ...overrides,
  };
}

function args(stepType: StepType, params: Record<string, unknown> = {}): DeviceStepExecutionArgs {
  return {
    runId: 'run-1',
    device: device(),
    step: {
      id: 'step-1',
      type: stepType,
      params,
    },
    resolvedParams: params,
    isCancelled: async () => false,
  };
}

describe('mobile mcp step backend bridge errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('BR-ERR-001 reports missing bridge token config from protected endpoints', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ success: false, error: 'token is not configured' }),
    });
    const backend = new MobileMcpStepBackend('http://127.0.0.1:4321', 1000);

    const result = await backend.executeStep(args('get_current_app'));

    expect(result.success).toBe(false);
    expect(result.error).toBe('token is not configured');
    expect(result.output).toMatchObject({ bridgeStatus: 503, bridgeErrorCode: 'BRIDGE_AUTH_NOT_CONFIGURED' });
  });

  it('BR-ERR-002 reports invalid bridge token responses', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ success: false, error: 'Unauthorized: invalid or missing X-Bridge-Token' }),
    });
    const backend = new MobileMcpStepBackend('http://127.0.0.1:4321', 1000, 'wrong-token');

    const result = await backend.executeStep(args('get_current_app'));

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unauthorized');
    expect(result.output).toMatchObject({ bridgeStatus: 401, bridgeErrorCode: 'BRIDGE_UNAUTHORIZED' });
  });

  it('BR-ERR-006 fails screenshot steps that return no screenshot artifact', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, output: { captured: true } }),
    });
    const backend = new MobileMcpStepBackend('http://127.0.0.1:4321', 1000, 'token');

    const result = await backend.executeStep(args('screenshot'));

    expect(result.success).toBe(false);
    expect(result.error).toContain('BRIDGE_SCREENSHOT_MISSING_ARTIFACT');
    expect(result.screenshotBase64).toBeUndefined();
  });
});
