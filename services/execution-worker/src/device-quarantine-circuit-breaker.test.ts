import { describe, expect, it } from 'vitest';
import { DeviceQuarantineCircuitBreaker } from './device-quarantine-circuit-breaker';

describe('DeviceQuarantineCircuitBreaker', () => {
  it('does not quarantine device on first failures under threshold', () => {
    const breaker = new DeviceQuarantineCircuitBreaker({
      consecutiveFailureThreshold: 3,
      quarantineCooldownMs: 60000,
    });
    breaker.recordFailure('dev-1');
    breaker.recordFailure('dev-1');
    const state = breaker.getState('dev-1');
    expect(state.isQuarantined).toBe(false);
    expect(state.consecutiveFailures).toBe(2);
  });

  it('quarantines device when reaching failure threshold', () => {
    const breaker = new DeviceQuarantineCircuitBreaker({
      consecutiveFailureThreshold: 3,
      quarantineCooldownMs: 60000,
    });
    breaker.recordFailure('dev-1', 'USB connection timeout');
    breaker.recordFailure('dev-1', 'USB connection timeout');
    const state = breaker.recordFailure('dev-1', 'USB connection timeout');

    expect(state.isQuarantined).toBe(true);
    expect(state.consecutiveFailures).toBe(3);
    expect(state.reason).toContain('USB connection timeout');
  });

  it('resets failures and quarantine on success', () => {
    const breaker = new DeviceQuarantineCircuitBreaker({
      consecutiveFailureThreshold: 2,
      quarantineCooldownMs: 60000,
    });
    breaker.recordFailure('dev-1');
    breaker.recordFailure('dev-1');
    expect(breaker.getState('dev-1').isQuarantined).toBe(true);

    breaker.recordSuccess('dev-1');
    const state = breaker.getState('dev-1');
    expect(state.isQuarantined).toBe(false);
    expect(state.consecutiveFailures).toBe(0);
  });

  it('allows manually lifting quarantine', () => {
    const breaker = new DeviceQuarantineCircuitBreaker({
      consecutiveFailureThreshold: 1,
      quarantineCooldownMs: 60000,
    });
    breaker.recordFailure('dev-1');
    expect(breaker.getState('dev-1').isQuarantined).toBe(true);

    breaker.liftQuarantine('dev-1');
    expect(breaker.getState('dev-1').isQuarantined).toBe(false);
  });
});
