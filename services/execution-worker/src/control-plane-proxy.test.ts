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
});
