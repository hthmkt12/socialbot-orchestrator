import { parentPort, workerData } from 'node:worker_threads';
import { createClient } from '@supabase/supabase-js';
import { executeOwnedDeviceRun } from './execute-owned-device-run';
import { createDeviceStepBackend } from './device-step-backend-factory';

async function main() {
  if (!parentPort) {
    throw new Error('This file must be run as a worker thread');
  }

  const { config, runId, claimToken, device, definition } = workerData;
  const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
  const backend = createDeviceStepBackend(config);

  try {
    await backend.connect();
    const result = await executeOwnedDeviceRun({
      supabase,
      backend,
      runId,
      claimToken,
      device,
      definition,
    });
    
    parentPort.postMessage({ type: 'DONE', result });
  } catch (error) {
    parentPort.postMessage({ 
      type: 'ERROR', 
      error: error instanceof Error ? error.message : String(error) 
    });
  } finally {
    await backend.disconnect().catch(() => undefined);
  }
}

main().catch(error => {
  if (parentPort) {
    parentPort.postMessage({ 
      type: 'ERROR', 
      error: error instanceof Error ? error.message : String(error) 
    });
  } else {
    console.error(error);
  }
});
