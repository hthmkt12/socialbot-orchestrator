import { createClient } from '@supabase/supabase-js';
import { MultiTargetRunExecutor } from '../multi-target-run-executor';
import { getTargetSerials, loadRootEnv, LOG_PREFIX, readWorkerConfig } from './mobile-mcp-db-smoke-env';
import {
  assertRunCompleted,
  claimRun,
  createQueuedRun,
  ensureSmokeMacroVersion,
  loadSmokeProfile,
  upsertSmokeDevice,
} from './mobile-mcp-db-smoke-store';

void main().catch((error) => {
  console.error(`${LOG_PREFIX} FAIL`, error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

async function main() {
  loadRootEnv();
  const serials = await getTargetSerials();
  if (serials.length < 2) throw new Error(`Need at least 2 online ADB devices, got ${serials.length}`);

  const config = readWorkerConfig();
  const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
  const profile = await loadSmokeProfile(supabase);
  const devices = await Promise.all(serials.slice(0, 2).map((serial, index) => upsertSmokeDevice(supabase, serial, index)));
  const macroVersionId = await ensureSmokeMacroVersion(supabase, profile.id);
  const runId = await createQueuedRun(supabase, macroVersionId, profile.id, devices);
  const claimToken = await claimRun(supabase, config.instanceId, runId);

  console.log(`${LOG_PREFIX} RUN ${runId} serials=${devices.map((device) => device.laixi_device_id).join(',')}`);
  const executor = new MultiTargetRunExecutor(config, () => undefined);
  await executor.executeClaimedRun(runId, claimToken);
  await assertRunCompleted(supabase, runId, devices);
}
