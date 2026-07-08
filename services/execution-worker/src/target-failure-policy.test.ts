import { describe, expect, it } from 'vitest';
import { assertTargetFailurePolicy, buildTargetFailureDecision, normalizeTargetFailurePolicy } from './target-failure-policy';

describe('target failure policy', () => {
  it('defaults unknown values to skip failed target', () => {
    expect(normalizeTargetFailurePolicy(undefined)).toBe('skip_failed_target');
    expect(normalizeTargetFailurePolicy('rotate_backup')).toBe('skip_failed_target');
    expect(normalizeTargetFailurePolicy('fail_fast')).toBe('fail_fast');
  });

  it('rejects invalid configured policies before dispatch', () => {
    expect(assertTargetFailurePolicy('fail_fast')).toBe('fail_fast');
    expect(assertTargetFailurePolicy('skip_failed_target')).toBe('skip_failed_target');
    expect(() => assertTargetFailurePolicy('rotate_backup')).toThrow('Invalid target failure policy');
  });

  it('keeps the original failure visible when fail fast is selected', () => {
    expect(buildTargetFailureDecision({
      device: { id: 'device-1', name: 'Pixel' },
      error: { code: 'DEVICE_LOCKED', message: 'Device is locked' },
      policy: 'fail_fast',
    })).toEqual({
      action: 'stop_remaining_targets',
      deviceId: 'device-1',
      deviceName: 'Pixel',
      originalFailure: { code: 'DEVICE_LOCKED', message: 'Device is locked' },
      policy: 'fail_fast',
    });
  });

  it('records skip decisions without hiding the original failed target', () => {
    expect(buildTargetFailureDecision({
      device: { id: 'device-2', name: 'Galaxy' },
      error: { code: 'STEP_FAILED', message: 'Tap failed' },
      policy: 'skip_failed_target',
    })).toMatchObject({
      action: 'continue_with_remaining_targets',
      deviceId: 'device-2',
      originalFailure: { code: 'STEP_FAILED', message: 'Tap failed' },
    });
  });
});
