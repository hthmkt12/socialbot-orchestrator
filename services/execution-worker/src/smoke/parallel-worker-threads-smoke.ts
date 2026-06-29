import { createClient } from '@supabase/supabase-js';
import { readSmokeEnv } from './mobile-mcp-db-smoke-env';
import { 
  loadSmokeProfile, 
  upsertSmokeDevice, 
  ensureSmokeMacroVersion, 
  createQueuedRun,
  claimRun,
  assertRunCompleted
} from './mobile-mcp-db-smoke-store';
import { MultiTargetRunExecutor } from '../multi-target-run-executor';

async function main() {
  console.log('[smoke] Starting Parallel Worker Threads Smoke Test');
  
  const config = readSmokeEnv();
  const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
  
  // 1. Setup profile and 3 devices
  const profile = await loadSmokeProfile(supabase);
  const serials = ['emulator-5554', 'emulator-5556', 'emulator-5558'];
  const devices = await Promise.all(serials.map((serial, index) => upsertSmokeDevice(supabase, serial, index)));
  
  // 2. Setup macro
  const macroVersionId = await ensureSmokeMacroVersion(supabase, profile.id);
  
  // 3. Create a MULTI_DEVICE run targeted at these 3 devices
  const runId = await createQueuedRun(supabase, macroVersionId, profile.id, devices);
  console.log(`[smoke] Created RUN: ${runId}`);
  
  // 4. Claim the run
  const claimToken = await claimRun(supabase, config.instanceId, runId);
  console.log(`[smoke] Claimed RUN with token: ${claimToken}`);
  
  // 5. Execute using the new refactored MultiTargetRunExecutor
  const executor = new MultiTargetRunExecutor(config, (rId) => {
    console.log(`[smoke] Released claim for ${rId}`);
  });
  
  console.log(`[smoke] Executing Multi-Target Run (this will spawn ${devices.length} worker threads)...`);
  const startTime = Date.now();
  await executor.executeClaimedRun(runId, claimToken);
  const duration = Date.now() - startTime;
  
  console.log(`[smoke] Execution completed in ${duration}ms`);
  
  // 6. Assert results
  await assertRunCompleted(supabase, runId, devices);
  console.log('[smoke] Verification passed. Database records look correct.');
}

main().catch((error) => {
  console.error('[smoke] Failed:', error);
  process.exit(1);
});
