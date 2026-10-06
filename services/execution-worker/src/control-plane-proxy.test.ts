import { describe, expect, it, vi } from 'vitest';
import { buildMobileMcpProxyRequest, handleControlPlaneProxy, isControlPlaneRole } from './control-plane-proxy';

describe('control-plane proxy contracts', () => {
  it('allows only operator and admin roles', () => {
    expect(isControlPlaneRole('ADMIN')).toBe(true);
    expect(isControlPlaneRole('OPERATOR')).toBe(true);
    expect(isControlPlaneRole('VIEWER')).toBe(false);
  });

  it('injects the bridge token server-side into proxy requests', () => {
    const request = buildMobileMcpProxyRequest('http://127.0.0.1:4321/', '/devices', 'server-only-token', { method: 'GET' });
    expect(request.url).toBe('http://127.0.0.1:4321/devices');
    expect(new Headers(request.init.headers).get('x-bridge-token')).toBe('server-only-token');
  });

  it('forwards authenticated gateway dispatch with the server token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: true, result: { data: { ok: true } } }), { status: 200 }));
    const req = { method: 'POST', url: '/control/gateway/dispatch-step', headers: { origin: 'http://localhost:5173' }, async *[Symbol.asyncIterator]() { yield Buffer.from('{"deviceId":"d1"}'); } } as never;
    const response = { writeHead: vi.fn(), end: vi.fn() } as never;
    await handleControlPlaneProxy(req, response, { supabaseUrl: 'http://supabase', supabaseServiceRoleKey: 'service', mobileMcpBridgeUrl: 'http://bridge', gatewayBaseUrl: 'http://gateway', gatewayHttpToken: 'gateway-secret', corsOrigin: 'http://localhost:5173', authorizeRequest: async () => ({ status: 200 }) });
    const [target, init] = fetchMock.mock.calls[0];
    expect(target).toBe('http://gateway/dispatch-step');
    expect((init?.headers instanceof Headers ? init.headers : new Headers(init?.headers)).get('authorization')).toBe('Bearer gateway-secret');
    fetchMock.mockRestore();
  });

  it('returns 400 for malformed proxy JSON', async () => {
    const req = { method: 'POST', url: '/control/gateway/dispatch-step', headers: { origin: 'http://localhost:5173' }, async *[Symbol.asyncIterator]() { yield Buffer.from('{'); } } as never;
    const response = { writeHead: vi.fn(), end: vi.fn() } as never;
    await handleControlPlaneProxy(req, response, { supabaseUrl: 'http://supabase', supabaseServiceRoleKey: 'service', mobileMcpBridgeUrl: 'http://bridge', gatewayBaseUrl: 'http://gateway', gatewayHttpToken: 'gateway-secret', corsOrigin: 'http://localhost:5173', authorizeRequest: async () => ({ status: 200 }) });
    expect(response.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
  });

  it('handles device recovery requests', async () => {
    const recoveryMock = vi.fn().mockResolvedValue({
      success: true,
      action: 'restart_adb',
      message: 'ADB restarted',
      durationMs: 50,
    });
    const req = {
      method: 'POST',
      url: '/control/devices/recovery',
      headers: { origin: 'http://localhost:5173' },
      async *[Symbol.asyncIterator]() {
        yield Buffer.from('{"action":"restart_adb"}');
      },
    } as never;
    const response = { writeHead: vi.fn(), end: vi.fn() } as never;
    await handleControlPlaneProxy(
      req,
      response,
      {
        supabaseUrl: 'http://supabase',
        supabaseServiceRoleKey: 'service',
        mobileMcpBridgeUrl: 'http://bridge',
        gatewayBaseUrl: 'http://gateway',
        corsOrigin: 'http://localhost:5173',
        authorizeRequest: async () => ({ status: 200 }),
      },
      recoveryMock
    );
    expect(recoveryMock).toHaveBeenCalledWith({ action: 'restart_adb' });
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  });

  it('handles device guardrail usage requests', async () => {
    const req = {
      method: 'GET',
      url: '/control/devices/guardrail/device-abc',
      headers: { origin: 'http://localhost:5173' },
    } as never;
    const response = { writeHead: vi.fn(), end: vi.fn() } as never;
    await handleControlPlaneProxy(req, response, {
      supabaseUrl: 'http://supabase',
      supabaseServiceRoleKey: 'service',
      mobileMcpBridgeUrl: 'http://bridge',
      gatewayBaseUrl: 'http://gateway',
      corsOrigin: 'http://localhost:5173',
      authorizeRequest: async () => ({ status: 200 }),
    });
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('"deviceId":"device-abc"'));
  });

  it('handles device quarantine state and lift requests', async () => {
    const getReq = {
      method: 'GET',
      url: '/control/devices/quarantine/device-xyz',
      headers: { origin: 'http://localhost:5173' },
    } as never;
    const getRes = { writeHead: vi.fn(), end: vi.fn() } as never;
    await handleControlPlaneProxy(getReq, getRes, {
      supabaseUrl: 'http://supabase',
      supabaseServiceRoleKey: 'service',
      mobileMcpBridgeUrl: 'http://bridge',
      gatewayBaseUrl: 'http://gateway',
      corsOrigin: 'http://localhost:5173',
      authorizeRequest: async () => ({ status: 200 }),
    });
    expect(getRes.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(getRes.end).toHaveBeenCalledWith(expect.stringContaining('"deviceId":"device-xyz"'));

    const liftReq = {
      method: 'POST',
      url: '/control/devices/quarantine/device-xyz/lift',
      headers: { origin: 'http://localhost:5173' },
    } as never;
    const liftRes = { writeHead: vi.fn(), end: vi.fn() } as never;
    await handleControlPlaneProxy(liftReq, liftRes, {
      supabaseUrl: 'http://supabase',
      supabaseServiceRoleKey: 'service',
      mobileMcpBridgeUrl: 'http://bridge',
      gatewayBaseUrl: 'http://gateway',
      corsOrigin: 'http://localhost:5173',
      authorizeRequest: async () => ({ status: 200 }),
    });
    expect(liftRes.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(liftRes.end).toHaveBeenCalledWith(expect.stringContaining('"success":true'));
  });
});
