import { supabase } from '../lib/supabase';

const DEFAULT_LOCK_DURATION_MS = 30 * 60 * 1000;

export interface LockAcquisitionResult {
  acquired: boolean;
  lockId?: string;
  reason?: string;
}

export async function acquireDeviceLock(
  deviceId: string,
  runId: string,
  durationMs: number = DEFAULT_LOCK_DURATION_MS
): Promise<LockAcquisitionResult> {
  await cleanExpiredLocks();

  const { data: existing } = await supabase
    .from('device_locks')
    .select('id, workflow_run_id, expires_at')
    .eq('device_id', deviceId)
    .maybeSingle();

  if (existing) {
    const expiresAt = new Date(existing.expires_at).getTime();
    if (expiresAt > Date.now()) {
      return {
        acquired: false,
        reason: `Device is locked by run ${existing.workflow_run_id}`,
      };
    }
    await supabase.from('device_locks').delete().eq('id', existing.id);
  }

  const expiresAt = new Date(Date.now() + durationMs).toISOString();

  const { data: lock, error } = await supabase
    .from('device_locks')
    .insert({
      device_id: deviceId,
      workflow_run_id: runId,
      expires_at: expiresAt,
    })
    .select('id')
    .maybeSingle();

  if (error) {
    const isDuplicate = (error as { code?: string }).code === '23505' || error.message.includes('duplicate key') || error.message.includes('unique');
    return {
      acquired: false,
      reason: isDuplicate ? 'Device is locked by another run' : error.message,
    };
  }

  return { acquired: true, lockId: lock?.id };
}

export async function releaseDeviceLock(
  deviceId: string,
  runId: string
): Promise<void> {
  await supabase
    .from('device_locks')
    .delete()
    .eq('device_id', deviceId)
    .eq('workflow_run_id', runId);
}

export async function releaseAllRunLocks(runId: string): Promise<void> {
  await supabase.from('device_locks').delete().eq('workflow_run_id', runId);
}

export async function renewDeviceLock(
  deviceId: string,
  runId: string,
  durationMs: number = DEFAULT_LOCK_DURATION_MS
): Promise<boolean> {
  const expiresAt = new Date(Date.now() + durationMs).toISOString();
  const { error } = await supabase
    .from('device_locks')
    .update({ expires_at: expiresAt })
    .eq('device_id', deviceId)
    .eq('workflow_run_id', runId);
  return !error;
}

async function cleanExpiredLocks(): Promise<void> {
  await supabase
    .from('device_locks')
    .delete()
    .lt('expires_at', new Date().toISOString());
}
