import { afterEach, describe, expect, it, vi } from 'vitest';
import { LaixiGatewayClient } from './laixi-gateway-client';

describe('LaixiGatewayClient auth', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends the configured gateway bearer token', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        outcome: 'completed',
        result: { success: true, deviceId: 'device-1' },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);
    const client = new LaixiGatewayClient('http://gateway:8080', 1_000, 'gateway-token');

    await client.sendCommand({ command: 'tap', deviceIds: 'device-1', params: {} }, {
      runId: 'run-1',
      stepId: 'step-1',
      deviceId: 'device-1',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://gateway:8080/dispatch-step',
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer gateway-token' }),
      })
    );
  });
});
