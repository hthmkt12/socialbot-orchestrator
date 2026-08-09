import { afterEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import { GATEWAY_PROTOCOL_VERSION } from '../../../packages/shared/src';
import { createGatewayServer, type GatewayConfig } from './index';

const apps: Array<ReturnType<typeof createGatewayServer>> = [];

function config(): GatewayConfig {
  return {
    port: 0,
    protocolVersion: GATEWAY_PROTOCOL_VERSION,
    healthSyncIntervalMs: 60_000,
    httpToken: 'http-token',
    enrollmentToken: 'device-token',
    allowInsecureDev: false,
    rateLimitPerMinute: 100,
  };
}

function callbackConfig(): GatewayConfig {
  return { ...config(), orchestratorCallbackUrl: 'https://orchestrator.test/signed-device-events' };
}

async function start() {
  const app = createGatewayServer(config());
  apps.push(app);
  const address = await app.listen();
  return { app, httpUrl: `http://127.0.0.1:${address.port}`, wsUrl: `ws://127.0.0.1:${address.port}` };
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  vi.unstubAllGlobals();
});

describe('gateway HTTP and WebSocket contracts', () => {
  it('keeps health public and protects sessions and dispatch', async () => {
    const { httpUrl } = await start();

    const health = await fetch(`${httpUrl}/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({
      service: 'laixi-gateway',
      status: 'ok',
      protocolVersion: GATEWAY_PROTOCOL_VERSION,
    });
    expect((await fetch(`${httpUrl}/sessions`)).status).toBe(401);
    expect((await fetch(`${httpUrl}/sessions`, {
      headers: { authorization: 'Bearer http-token' },
    })).status).toBe(200);
    expect((await fetch(`${httpUrl}/dispatch-step`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })).status).toBe(401);
  });

  it('rejects malformed and oversized dispatch payloads without leaking parser errors', async () => {
    const { httpUrl } = await start();
    const headers = { authorization: 'Bearer http-token', 'content-type': 'application/json' };

    const malformed = await fetch(`${httpUrl}/dispatch-step`, {
      method: 'POST',
      headers,
      body: '{not-json',
    });
    const oversized = await fetch(`${httpUrl}/dispatch-step`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ payload: 'x'.repeat(1024 * 1024) }),
    });

    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({ error: 'Invalid JSON payload' });
    expect(oversized.status).toBe(413);
    expect(await oversized.json()).toMatchObject({ error: 'Dispatch payload exceeds 1 MiB' });
  });

  it('closes an unregistered device using a missing enrollment token', async () => {
    const { wsUrl } = await start();
    const socket = new WebSocket(wsUrl);
    const closeCode = await new Promise<number>((resolve, reject) => {
      socket.once('error', reject);
      socket.once('open', () => {
        socket.send(JSON.stringify({ type: 'register', deviceId: 'device-1', deviceName: 'Device 1' }));
      });
      socket.once('close', (code) => resolve(code));
    });

    expect(closeCode).toBe(4003);
  });

  it('rejects heartbeat traffic before registration', async () => {
    const { wsUrl } = await start();
    const socket = new WebSocket(wsUrl);
    const closeCode = await new Promise<number>((resolve, reject) => {
      socket.once('error', reject);
      socket.once('open', () => {
        socket.send(JSON.stringify({ type: 'heartbeat', deviceId: 'device-1' }));
      });
      socket.once('close', (code) => resolve(code));
    });
    expect(closeCode).toBe(4003);
  });

  it('accepts a device registration with the configured enrollment token', async () => {
    const { wsUrl } = await start();
    const socket = new WebSocket(wsUrl);
    const message = await new Promise<Record<string, unknown>>((resolve, reject) => {
      socket.once('error', reject);
      socket.once('open', () => {
        socket.send(JSON.stringify({
          type: 'register',
          deviceId: 'device-1',
          deviceName: 'Device 1',
          enrollmentToken: 'device-token',
        }));
      });
      socket.once('message', (raw) => resolve(JSON.parse(raw.toString()) as Record<string, unknown>));
    });
    socket.close();

    expect(message.type).toBe('register_ack');
  });

  it('forwards an enrolled signed device event unchanged with gateway bearer authentication', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const app = createGatewayServer(callbackConfig());
    apps.push(app);
    const address = await app.listen();
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}`);
    const acknowledgement = await new Promise<Record<string, unknown>>((resolve, reject) => {
      socket.once('error', reject);
      socket.on('message', (raw) => {
        const message = JSON.parse(raw.toString()) as Record<string, unknown>;
        if (message.type === 'register_ack') {
          socket.send(JSON.stringify({
            type: 'signed_device_event',
            protocolVersion: GATEWAY_PROTOCOL_VERSION,
            eventId: 'event-1',
            deviceId: 'device-1',
            envelope: '{"signed":"event"}',
          }));
        }
        if (message.type === 'signed_device_event_ack') resolve(message);
      });
      socket.once('open', () => socket.send(JSON.stringify({
        type: 'register', deviceId: 'device-1', deviceName: 'Device 1', enrollmentToken: 'device-token',
      })));
    });
    socket.close();

    expect(acknowledgement).toMatchObject({ type: 'signed_device_event_ack', eventId: 'event-1', deviceId: 'device-1' });
    expect(fetchMock).toHaveBeenCalledWith('https://orchestrator.test/signed-device-events', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ authorization: 'Bearer http-token' }),
      body: JSON.stringify({ deviceId: 'device-1', eventId: 'event-1', envelope: '{"signed":"event"}' }),
    }));
  });

  it('retries an unacknowledged signed device event before acknowledging it', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const app = createGatewayServer(callbackConfig());
    apps.push(app);
    const address = await app.listen();
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}`);
    const acknowledgement = await new Promise<Record<string, unknown>>((resolve, reject) => {
      socket.once('error', reject);
      socket.on('message', (raw) => {
        const message = JSON.parse(raw.toString()) as Record<string, unknown>;
        if (message.type === 'register_ack') {
          socket.send(JSON.stringify({
            type: 'signed_device_event', protocolVersion: GATEWAY_PROTOCOL_VERSION,
            eventId: 'event-2', deviceId: 'device-1', envelope: 'opaque-signed-envelope',
          }));
        }
        if (message.type === 'signed_device_event_ack') resolve(message);
      });
      socket.once('open', () => socket.send(JSON.stringify({
        type: 'register', deviceId: 'device-1', deviceName: 'Device 1', enrollmentToken: 'device-token',
      })));
    });
    socket.close();

    expect(acknowledgement.eventId).toBe('event-2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects a signed device event whose claimed device does not match its enrolled socket', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const app = createGatewayServer(callbackConfig());
    apps.push(app);
    const address = await app.listen();
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}`);
    const closeCode = await new Promise<number>((resolve, reject) => {
      socket.once('error', reject);
      socket.on('message', (raw) => {
        const message = JSON.parse(raw.toString()) as Record<string, unknown>;
        if (message.type === 'register_ack') {
          socket.send(JSON.stringify({
            type: 'signed_device_event', protocolVersion: GATEWAY_PROTOCOL_VERSION,
            eventId: 'event-3', deviceId: 'other-device', envelope: 'opaque-signed-envelope',
          }));
        }
      });
      socket.once('open', () => socket.send(JSON.stringify({
        type: 'register', deviceId: 'device-1', deviceName: 'Device 1', enrollmentToken: 'device-token',
      })));
      socket.once('close', (code) => resolve(code));
    });

    expect(closeCode).toBe(4003);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
