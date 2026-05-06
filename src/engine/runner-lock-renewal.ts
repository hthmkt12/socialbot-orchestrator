import { renewDeviceLock } from './device-lock';

const LOCK_RENEW_INTERVAL_MS = 5 * 60 * 1000;

export function startRunnerLockRenewal(
  lockRenewTimers: Map<string, ReturnType<typeof setInterval>>,
  deviceId: string,
  runId: string
) {
  const timer = setInterval(async () => {
    await renewDeviceLock(deviceId, runId);
  }, LOCK_RENEW_INTERVAL_MS);
  lockRenewTimers.set(deviceId, timer);
}

export function stopRunnerLockRenewal(
  lockRenewTimers: Map<string, ReturnType<typeof setInterval>>,
  deviceId: string
) {
  const timer = lockRenewTimers.get(deviceId);
  if (!timer) return;
  clearInterval(timer);
  lockRenewTimers.delete(deviceId);
}
