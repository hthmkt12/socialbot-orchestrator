import { acquireDeviceLock, releaseDeviceLock, renewDeviceLock } from './worker-device-locks.js';
import { SingleDeviceStepRunner, type RunnerParams } from './single-device-step-runner.js';
import { globalDeviceQuarantineCircuitBreaker } from './device-quarantine-circuit-breaker.js';
import { globalDeviceActionGuardrail } from './device-action-guardrail.js';

const LOCK_RENEW_INTERVAL_MS = 5 * 60 * 1000;

export interface OwnedDeviceRunResult {
  status: 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'WAITING_APPROVAL';
  error?: {
    code: string;
    message: string;
  };
}

export async function executeOwnedDeviceRun(params: RunnerParams): Promise<OwnedDeviceRunResult> {
  let lockRenewTimer: ReturnType<typeof setInterval> | null = null;
  let ownsDeviceLock = false;

  try {
    const quarantine = globalDeviceQuarantineCircuitBreaker.getState(params.device.id);
    if (quarantine.isQuarantined) {
      return {
        status: 'FAILED',
        error: {
          code: 'DEVICE_QUARANTINED',
          message: quarantine.reason ?? `Device ${params.device.id} is quarantined due to consecutive failures.`,
        },
      };
    }

    const guardrail = globalDeviceActionGuardrail.getUsage(params.device.id);
    if (!guardrail.allowed) {
      return {
        status: 'FAILED',
        error: {
          code: 'DEVICE_RATE_LIMIT_EXCEEDED',
          message: guardrail.reason ?? `Device ${params.device.id} reached daily action limit.`,
        },
      };
    }

    const lockResult = await acquireDeviceLock(params.supabase, params.device.id, params.runId);
    if (!lockResult.acquired) {
      return {
        status: 'FAILED',
        error: {
          code: 'DEVICE_LOCKED',
          message: lockResult.reason ?? 'Device is locked',
        },
      };
    }

    ownsDeviceLock = true;
    lockRenewTimer = setInterval(() => {
      void renewDeviceLock(params.supabase, params.device.id, params.runId);
    }, LOCK_RENEW_INTERVAL_MS);
    lockRenewTimer.unref();

    const runner = new SingleDeviceStepRunner(params);
    const result = await runner.run();

    if (result.status === 'COMPLETED') {
      globalDeviceQuarantineCircuitBreaker.recordSuccess(params.device.id);
    } else if (result.status === 'FAILED') {
      globalDeviceQuarantineCircuitBreaker.recordFailure(params.device.id, 'Device run failed');
    }

    return {
      status:
        result.status === 'COMPLETED'
          ? 'COMPLETED'
          : result.status === 'WAITING_APPROVAL'
            ? 'WAITING_APPROVAL'
            : result.status === 'CANCELLED'
              ? 'CANCELLED'
              : 'FAILED',
    };
  } catch (error) {
    globalDeviceQuarantineCircuitBreaker.recordFailure(params.device.id, 'Device run exception');
    return {
      status: 'FAILED',
      error: {
        code: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  } finally {
    if (lockRenewTimer) clearInterval(lockRenewTimer);
    if (ownsDeviceLock) {
      try {
        await releaseDeviceLock(params.supabase, params.device.id, params.runId);
      } catch {
        // Best-effort cleanup; cancel path also removes locks.
      }
    }
  }
}
