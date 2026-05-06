import type { SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_LOCK_DURATION_MS = 30 * 60 * 1000;

export interface LockAcquisitionResult {
  acquired: boolean;
  reason?: string;
}

export async function acquireDeviceLock(
  supabase: SupabaseClient,
  deviceId: string,
  runId: string,
  durationMs: number = DEFAULT_LOCK_DURATION_MS
): Promise<LockAcquisitionResult> {
  await cleanExpiredLocks(supabase);

  const { data: existing, error: existingError } = await supabase
    .from('device_locks')
    .select('id, workflow_run_id, expires_at')
    .eq('device_id', deviceId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing) {
    if (new Date(existing.expires_at).getTime() > Date.now()) {
      return { acquired: false, reason: `Device is locked by run ${existing.workflow_run_id}` };
    }
    const { error: deleteError } = await supabase.from('device_locks').delete().eq('id', existing.id);
    if (deleteError) throw new Error(deleteError.message);
  }

  const expiresAt = new Date(Date.now() + durationMs).toISOString();
  const { error } = await supabase.from('device_locks').insert({
    device_id: deviceId,
    workflow_run_id: runId,
    expires_at: expiresAt,
  });

  if (!error) return { acquired: true };

  const isDuplicate =
    (error as { code?: string }).code === '23505' ||
    error.message.includes('duplicate key') ||
    error.message.includes('unique');
  return { acquired: false, reason: isDuplicate ? 'Device is locked by another run' : error.message };
}

export async function renewDeviceLock(
  supabase: SupabaseClient,
  deviceId: string,
  runId: string,
  durationMs: number = DEFAULT_LOCK_DURATION_MS
) {
  const expiresAt = new Date(Date.now() + durationMs).toISOString();
  const { error } = await supabase
    .from('device_locks')
    .update({ expires_at: expiresAt })
    .eq('device_id', deviceId)
    .eq('workflow_run_id', runId);
  return !error;
}

export async function releaseDeviceLock(
  supabase: SupabaseClient,
  deviceId: string,
  runId: string
) {
  const { error } = await supabase
    .from('device_locks')
    .delete()
    .eq('device_id', deviceId)
    .eq('workflow_run_id', runId);
  if (error) throw new Error(error.message);
}

async function cleanExpiredLocks(supabase: SupabaseClient) {
  const { error } = await supabase
    .from('device_locks')
    .delete()
    .lt('expires_at', new Date().toISOString());
  if (error) throw new Error(error.message);
}
