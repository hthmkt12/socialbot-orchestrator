import { describe, expect, it } from 'vitest';
import { GatewaySecurityPolicy } from './gateway-security';

describe('GatewaySecurityPolicy', () => {
  it('fails closed when production tokens are missing', () => {
    expect(() => new GatewaySecurityPolicy({})).toThrow(/GATEWAY_HTTP_TOKEN/);
    expect(() => new GatewaySecurityPolicy({ httpToken: 'http-token' })).toThrow(/GATEWAY_DEVICE_ENROLLMENT_TOKEN/);
  });

  it('requires exact bearer and enrollment tokens', () => {
    const policy = new GatewaySecurityPolicy({
      httpToken: 'http-token',
      enrollmentToken: 'device-token',
    });

    expect(policy.hasHttpAccess('Bearer http-token')).toBe(true);
    expect(policy.hasHttpAccess('Bearer wrong')).toBe(false);
    expect(policy.hasHttpAccess(undefined)).toBe(false);
    expect(policy.hasEnrollmentAccess('device-token')).toBe(true);
    expect(policy.hasEnrollmentAccess(undefined)).toBe(false);
  });

  it('allows tokenless operation only with the explicit insecure-dev flag', () => {
    const policy = new GatewaySecurityPolicy({ allowInsecureDev: true });

    expect(policy.hasHttpAccess(undefined)).toBe(true);
    expect(policy.hasEnrollmentAccess(undefined)).toBe(true);
  });

  it('rate limits protected requests by client key', () => {
    const policy = new GatewaySecurityPolicy({
      httpToken: 'http-token',
      enrollmentToken: 'device-token',
      rateLimitPerMinute: 2,
    });

    expect(policy.consume('client-1', 1_000)).toBe(true);
    expect(policy.consume('client-1', 2_000)).toBe(true);
    expect(policy.consume('client-1', 3_000)).toBe(false);
    expect(policy.consume('client-1', 62_000)).toBe(true);
  });
});
