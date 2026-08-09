import { describe, expect, it } from 'vitest';
import { GATEWAY_PROTOCOL_VERSION, isGatewaySignedDeviceEventMessage } from './execution-contract';

describe('gateway protocol guards', () => {
  const base = { type: 'signed_device_event', eventId: 'event-1', deviceId: 'device-1', envelope: 'signed-envelope' };

  it('requires the current protocol version for signed events', () => {
    expect(isGatewaySignedDeviceEventMessage({ ...base })).toBe(false);
    expect(isGatewaySignedDeviceEventMessage({ ...base, protocolVersion: 'unsupported' })).toBe(false);
    expect(isGatewaySignedDeviceEventMessage({ ...base, protocolVersion: GATEWAY_PROTOCOL_VERSION })).toBe(true);
  });
});
