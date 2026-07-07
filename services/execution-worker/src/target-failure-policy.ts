import type { Device } from '../../../src/lib/database.types';

export type TargetFailurePolicy = 'fail_fast' | 'skip_failed_target';

export interface TargetFailureDecision {
  action: 'stop_remaining_targets' | 'continue_with_remaining_targets';
  deviceId: string;
  deviceName: string;
  originalFailure: {
    code: string;
    message: string;
  };
  policy: TargetFailurePolicy;
}

export function normalizeTargetFailurePolicy(value: unknown): TargetFailurePolicy {
  return value === 'fail_fast' || value === 'skip_failed_target' ? value : 'skip_failed_target';
}

export function buildTargetFailureDecision(args: {
  device: Pick<Device, 'id' | 'name'>;
  error?: { code: string; message: string };
  policy: TargetFailurePolicy;
}): TargetFailureDecision {
  return {
    action: args.policy === 'fail_fast' ? 'stop_remaining_targets' : 'continue_with_remaining_targets',
    deviceId: args.device.id,
    deviceName: args.device.name,
    originalFailure: args.error ?? {
      code: 'TARGET_FAILED',
      message: 'Target failed without a structured error',
    },
    policy: args.policy,
  };
}
