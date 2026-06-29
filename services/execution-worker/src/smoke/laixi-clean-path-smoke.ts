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
import { SingleDeviceRunExecutor } from '../single-device-run-executor';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

async function main() {
  console.log('[smoke] Starting Laixi Clean-path Smoke Test');
  
  // 1. Boot Mock Gateway
  const mockServerPath = resolve(__dirname, 'mock-laixi-gateway.ts');
  const mockProcess = spawn('npx', ['tsx', mockServerPath], { stdio: 'inherit' });
  
  // Give the server a second to start
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 2. Override backend config to point to Laixi Gateway
  process.env.DEVICE_BACKEND = 'laixi';
  process.env.GATEWAY_BASE_URL = 'http://127.0.0.1:8080';
  
  const config = readSmokeEnv();
  const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
  
  try {
    // 3. Setup mock data
    const profile = await loadSmokeProfile(supabase);
    const device = await upsertSmokeDevice(supabase, 'mock-laixi-device-1', 0);
    const macroVersionId = await ensureSmokeMacroVersion(supabase, profile.id);
    
    // 4. Create and claim a run
    const runId = await createQueuedRun(supabase, macroVersionId, profile.id, [device]);
    const claimToken = await claimRun(supabase, config.instanceId, runId);
    
    // 5. Execute Run (should use LaixiGatewayClient)
    console.log(`[smoke] Executing Laixi Run ${runId}...`);
    const executor = new SingleDeviceRunExecutor(config, () => {});
    await executor.executeClaimedRun(runId, claimToken);
    
    // 6. Assert success
    await assertRunCompleted(supabase, runId, [device]);
    console.log('[smoke] Verification passed. Laixi Backend cleanly executed steps.');
  } finally {
    // 7. Cleanup
    mockProcess.kill();
  }
}

main().catch((error) => {
  console.error('[smoke] Failed:', error);
  process.exit(1);
});
