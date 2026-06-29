import { Worker } from 'node:worker_threads';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadSingleDeviceRunContext } from './single-device-run-context';
import type { WorkerConfig } from './run-claim-coordinator';
import { aggregateRunResults } from './worker-step-store';
import { finalizeOwnedRun, isRunCancelled, markOwnedRunStatus } from './worker-run-store';
import type { OwnedDeviceRunResult } from './execute-owned-device-run';
import type { Device, MacroDefinition } from '../../../packages/shared/src';

interface DeviceWorkerData {
  config: WorkerConfig;
  runId: string;
  claimToken: string;
  device: Device;
  definition: MacroDefinition;
}

function runDeviceWorker(workerFile: string, workerData: DeviceWorkerData): Promise<OwnedDeviceRunResult> {
  return new Promise((resolvePromise, rejectPromise) => {
    const worker = new Worker(workerFile, { workerData });
    worker.on('message', (message) => {
      if (message.type === 'DONE') {
        resolvePromise(message.result);
      } else if (message.type === 'ERROR') {
        rejectPromise(new Error(message.error));
      }
    });
    worker.on('error', rejectPromise);
    worker.on('exit', (code) => {
      if (code !== 0) rejectPromise(new Error(`Worker stopped with exit code ${code}`));
    });
  });
}

export class SingleDeviceRunExecutor {
  private readonly supabase: SupabaseClient;
  private readonly __dirname = fileURLToPath(new URL('.', import.meta.url));

  constructor(
    private readonly config: WorkerConfig,
    private readonly releaseClaim: (runId: string, claimToken: string) => void
  ) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
  }

  async executeClaimedRun(runId: string, claimToken: string) {
    try {
      const context = await loadSingleDeviceRunContext(this.supabase, runId, claimToken);
      
      await markOwnedRunStatus(this.supabase, context.runId, claimToken, 'RUNNING');

      if (await isRunCancelled(this.supabase, context.runId, claimToken)) {
        await finalizeOwnedRun(this.supabase, context.runId, claimToken, 'CANCELLED', {
          totalDevices: 1,
          cancelled: 1,
        });
        return;
      }

      const workerFile = resolve(this.__dirname, './execute-device-worker-thread.js');
      let result: OwnedDeviceRunResult;
      
      try {
          result = await runDeviceWorker(workerFile, {
            config: this.config,
            runId: context.runId,
            claimToken,
            device: context.device,
            definition: context.macroDefinition
          });
      } catch (error) {
          result = {
              status: 'FAILED',
              error: {
                  code: 'WORKER_CRASH',
                  message: error instanceof Error ? error.message : String(error)
              }
          };
      }

      const aggregate = await aggregateRunResults(this.supabase, context.runId);

      const status =
        result.status === 'COMPLETED'
          ? 'COMPLETED'
          : result.status === 'WAITING_APPROVAL'
            ? 'WAITING_APPROVAL'
            : result.status === 'CANCELLED'
              ? 'CANCELLED'
              : 'FAILED';

      await finalizeOwnedRun(this.supabase, context.runId, claimToken, status, {
        ...(result.error ? { error: result.error } : {}),
        totalDevices: 1,
        succeeded: status === 'COMPLETED' || status === 'WAITING_APPROVAL' ? 1 : 0,
        failed: status === 'FAILED' ? 1 : 0,
        cancelled: status === 'CANCELLED' ? 1 : 0,
        partial: 0,
        avgCompletionRate: aggregate.avgCompletionRate,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      try {
        await finalizeOwnedRun(this.supabase, runId, claimToken, 'FAILED', {
          error: { code: 'EXECUTION_ERROR', message },
        });
      } catch {
        // Keep original execution failure as primary signal.
      }
    } finally {
      this.releaseClaim(runId, claimToken);
    }
  }
}
