import { describe, expect, it } from 'vitest';
import {
  buildAutoJsInitScript,
  normalizeBaseUrl,
  toGatewayWsUrl,
  GATEWAY_PROTOCOL_EXAMPLE,
} from './device-setup';

describe('device setup helpers', () => {
  it('normalizes base URLs and falls back when input is blank', () => {
    expect(normalizeBaseUrl(' http://localhost:8080/ ', 'http://fallback')).toBe('http://localhost:8080');
    expect(normalizeBaseUrl('   ', 'http://fallback/')).toBe('http://fallback');
  });

  it('converts gateway HTTP URLs to websocket URLs', () => {
    expect(toGatewayWsUrl('http://127.0.0.1:8080')).toBe('ws://127.0.0.1:8080');
    expect(toGatewayWsUrl('https://gateway.example.com')).toBe('wss://gateway.example.com');
    expect(toGatewayWsUrl('ws://gateway.local')).toBe('ws://gateway.local');
    expect(toGatewayWsUrl('gateway.local:8080')).toBe('ws://gateway.local:8080');
  });

  it('builds the AutoJS bootstrap with the gateway websocket URL embedded', () => {
    const script = buildAutoJsInitScript('ws://127.0.0.1:8080');

    expect(script).toContain('const GATEWAY_URL = "ws://127.0.0.1:8080";');
    expect(script).toContain('function handleDispatchStep(message)');
    expect(script).toContain('type: "step_result"');
  });

  it('keeps a protocol example for operator documentation', () => {
    expect(GATEWAY_PROTOCOL_EXAMPLE).toContain('"type": "register"');
    expect(GATEWAY_PROTOCOL_EXAMPLE).toContain('"type": "dispatch_step"');
    expect(GATEWAY_PROTOCOL_EXAMPLE).toContain('"type": "step_result"');
  });
});
