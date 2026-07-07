import { fileURLToPath } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadSingleDeviceRunContext } from './single-device-run-context';
import type { WorkerConfig } from './run-claim-coordinator';
import { aggregateRunResults } from './worker-step-store';
import { finalizeOwnedRun, isRunCancelled, markOwnedRunStatus } from './worker-run-store';
import { executeOwnedDeviceRun, type OwnedDeviceRunResult } from './execute-owned-device-run.js';
import type { Device, MacroDefinition } from '../../../packages/shared/src';
import { createDeviceWorker, hasCompiledDeviceWorker } from './device-worker-runtime';
import { createDeviceStepBackend } from './device-step-backend-factory.js';

interface DeviceWorkerData {
  config: WorkerConfig;
  runId: string;
  claimToken: string;
  device: Device;
  definition: MacroDefinition;
  retryBackoffPolicy?: import('./retry-backoff-policy.js').RetryBackoffPolicy;
  triggeredByUserId: string;
  inputVariables: Record<string, unknown>;
}

async function executeDeviceRunInline(workerData: DeviceWorkerData): Promise<OwnedDeviceRunResult> {
  const supabase = createClient(workerData.config.supabaseUrl, workerData.config.supabaseServiceRoleKey);
  const backend = createDeviceStepBackend(workerData.config);
  await backend.connect();
  try {
    return await executeOwnedDeviceRun({
      supabase,
      backend,
      runId: workerData.runId,
      claimToken: workerData.claimToken,
      device: workerData.device,
      definition: workerData.definition,
      retryBackoffPolicy: workerData.retryBackoffPolicy,
      triggeredByUserId: workerData.triggeredByUserId,
      inputVariables: { ...workerData.inputVariables },
    });
  } finally {
    await backend.disconnect().catch(() => undefined);
  }
}

async function runDeviceWorker(dirname: string, workerData: DeviceWorkerData): Promise<OwnedDeviceRunResult> {
  if (!hasCompiledDeviceWorker(dirname)) {
    return executeDeviceRunInline(workerData);
  }

  return new Promise((resolvePromise, rejectPromise) => {
    const worker = createDeviceWorker(dirname, workerData);
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

      let result: OwnedDeviceRunResult;
      
      try {
          result = await runDeviceWorker(this.__dirname, {
            config: this.config,
            runId: context.runId,
            claimToken,
            device: context.device,
            definition: context.macroDefinition,
            retryBackoffPolicy: context.retryBackoffPolicy,
            triggeredByUserId: context.triggeredByUserId,
            inputVariables: context.inputVariables,
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
