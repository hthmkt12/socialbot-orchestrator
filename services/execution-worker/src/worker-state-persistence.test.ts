import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { WorkerStatePersistence } from './worker-state-persistence.js';
import { globalDeviceActionGuardrail } from './device-action-guardrail.js';
import { globalDeviceQuarantineCircuitBreaker } from './device-quarantine-circuit-breaker.js';

const TEST_STATE_PATH = path.resolve('./.test-worker-state.json');

describe('WorkerStatePersistence', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_STATE_PATH)) {
      fs.unlinkSync(TEST_STATE_PATH);
    }
    globalDeviceActionGuardrail.reset();
    globalDeviceQuarantineCircuitBreaker.clear();
  });

  afterEach(() => {
    if (fs.existsSync(TEST_STATE_PATH)) {
      fs.unlinkSync(TEST_STATE_PATH);
    }
  });

  it('saves and restores guardrail counts and circuit breaker quarantine state', () => {
    const persistence = new WorkerStatePersistence(TEST_STATE_PATH);

    // Record some state
    globalDeviceActionGuardrail.recordAction('device-101');
    globalDeviceActionGuardrail.recordAction('device-101');
    globalDeviceQuarantineCircuitBreaker.recordFailure('device-202', 'USB disconnected');
    globalDeviceQuarantineCircuitBreaker.recordFailure('device-202', 'USB disconnected');
    globalDeviceQuarantineCircuitBreaker.recordFailure('device-202', 'USB disconnected');

    expect(globalDeviceQuarantineCircuitBreaker.getState('device-202').isQuarantined).toBe(true);

    // Save
    const saved = persistence.saveState();
    expect(saved).toBe(true);
    expect(fs.existsSync(TEST_STATE_PATH)).toBe(true);

    // Clear in-memory state
    globalDeviceActionGuardrail.reset();
    globalDeviceQuarantineCircuitBreaker.clear();

    expect(globalDeviceActionGuardrail.getUsage('device-101').currentCount).toBe(0);
    expect(globalDeviceQuarantineCircuitBreaker.getState('device-202').isQuarantined).toBe(false);

    // Restore
    const loaded = persistence.loadState();
    expect(loaded).toBe(true);

    expect(globalDeviceActionGuardrail.getUsage('device-101').currentCount).toBe(2);
    expect(globalDeviceQuarantineCircuitBreaker.getState('device-202').isQuarantined).toBe(true);
    expect(globalDeviceQuarantineCircuitBreaker.getState('device-202').consecutiveFailures).toBe(3);
  });
});
