import { acquireDeviceLock, releaseDeviceLock, renewDeviceLock } from './worker-device-locks.js';
import { SingleDeviceStepRunner, type RunnerParams } from './single-device-step-runner.js';

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

  try {
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

    lockRenewTimer = setInterval(() => {
      void renewDeviceLock(params.supabase, params.device.id, params.runId);
    }, LOCK_RENEW_INTERVAL_MS);
    lockRenewTimer.unref();

    const runner = new SingleDeviceStepRunner(params);
    const result = await runner.run();

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
    return {
      status: 'FAILED',
      error: {
        code: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  } finally {
    if (lockRenewTimer) clearInterval(lockRenewTimer);
    try {
      await releaseDeviceLock(params.supabase, params.device.id, params.runId);
    } catch {
      // Best-effort cleanup; cancel path also removes locks.
    }
  }
}
