import { describe, expect, it } from 'vitest';
import { DeviceActionGuardrail } from './device-action-guardrail';

describe('DeviceActionGuardrail', () => {
  it('allows actions within daily limit', () => {
    const guardrail = new DeviceActionGuardrail(10);
    const check = guardrail.getUsage('dev-1');
    expect(check.allowed).toBe(true);
    expect(check.currentCount).toBe(0);
    expect(check.remaining).toBe(10);
  });

  it('records actions and tracks remaining count', () => {
    const guardrail = new DeviceActionGuardrail(3);
    guardrail.recordAction('dev-1');
    guardrail.recordAction('dev-1');
    const check = guardrail.getUsage('dev-1');
    expect(check.allowed).toBe(true);
    expect(check.currentCount).toBe(2);
    expect(check.remaining).toBe(1);

    guardrail.recordAction('dev-1');
    const blockedCheck = guardrail.getUsage('dev-1');
    expect(blockedCheck.allowed).toBe(false);
    expect(blockedCheck.currentCount).toBe(3);
    expect(blockedCheck.remaining).toBe(0);
    expect(blockedCheck.reason).toContain('exceeded daily action rate limit');
  });

  it('isolates counts across devices', () => {
    const guardrail = new DeviceActionGuardrail(2);
    guardrail.recordAction('dev-1');
    guardrail.recordAction('dev-1');

    expect(guardrail.getUsage('dev-1').allowed).toBe(false);
    expect(guardrail.getUsage('dev-2').allowed).toBe(true);
    expect(guardrail.getUsage('dev-2').remaining).toBe(2);
  });

  it('respects custom device limits', () => {
    const guardrail = new DeviceActionGuardrail(100);
    guardrail.recordAction('dev-custom');
    const check = guardrail.getUsage('dev-custom', 1);
    expect(check.allowed).toBe(false);
    expect(check.dailyLimit).toBe(1);
  });
});
