import { Worker } from 'node:worker_threads';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadMultiTargetRunContext } from './multi-target-run-context';
import type { WorkerConfig } from './run-claim-coordinator';
import { aggregateRunResults } from './worker-step-store';
import { finalizeOwnedRun, isRunCancelled, markOwnedRunStatus } from './worker-run-store';
import type { OwnedDeviceRunResult } from './execute-owned-device-run';
import { fileURLToPath } from 'node:url';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeResolvedTargetSummary(
  summaryJson: Record<string, unknown> | null,
  targetType: string,
  devices: { id: string; name: string }[]
): Record<string, unknown> {
  const patch = {
    targetType,
    resolvedDevices: devices.map((d) => ({ id: d.id, name: d.name })),
  };
  return summaryJson ? { ...summaryJson, ...patch } : patch;
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

function runDeviceWorker(workerFile: string, workerData: any): Promise<OwnedDeviceRunResult> {
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

export class MultiTargetRunExecutor {
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
      const context = await loadMultiTargetRunContext(this.supabase, runId, claimToken);
      if (!context.resolvedDeviceIdsPersisted) {
        const { error: persistTargetsError } = await this.supabase
          .from('workflow_runs')
          .update({
            summary_json: mergeResolvedTargetSummary(
              context.summaryJson,
              context.targetType,
              context.devices.map((d) => ({ id: d.id, name: d.name }))
            ),
          })
          .eq('id', context.runId)
          .eq('execution_claim_token', claimToken);
        if (persistTargetsError) throw new Error(persistTargetsError.message);
      }

      await markOwnedRunStatus(this.supabase, context.runId, claimToken, 'RUNNING');

      let succeeded = 0;
      let failed = 0;
      let cancelled = 0;
      let waitingApproval = false;
      let lastError: { code: string; message: string } | null = null;

      const incrementSuccess = () => {
        succeeded += 1;
      };
      const incrementCancelled = () => {
        cancelled += 1;
      };
      const incrementFailed = (err?: { code: string; message: string }) => {
        failed += 1;
        if (err) lastError = err;
      };

      const MAX_CONCURRENT_DEVICES = 10;
      const chunks = chunkArray(context.devices, MAX_CONCURRENT_DEVICES);

      const workerFile = resolve(this.__dirname, './execute-device-worker-thread.js');

      for (const chunk of chunks) {
        if (await isRunCancelled(this.supabase, context.runId, claimToken)) {
          cancelled += context.devices.length - succeeded - failed - cancelled;
          break;
        }

        await Promise.allSettled(chunk.map(async (device) => {
          if (await isRunCancelled(this.supabase, context.runId, claimToken)) {
            incrementCancelled();
            return;
          }

          try {
            const result = await runDeviceWorker(workerFile, {
              config: this.config,
              runId: context.runId,
              claimToken,
              device,
              definition: context.macroDefinition
            });

            if ((result as any).status === 'SUCCESS' || result.status === 'COMPLETED') {
              incrementSuccess();
            } else if (result.status === 'WAITING_APPROVAL') {
              waitingApproval = true;
              incrementSuccess();
            } else if (result.status === 'CANCELLED') {
              incrementCancelled();
            } else {
              incrementFailed(result.error);
            }
          } catch (error) {
             incrementFailed({
                code: 'WORKER_CRASH',
                message: error instanceof Error ? error.message : String(error)
             });
          }
        }));
      }

      const aggregate = await aggregateRunResults(this.supabase, context.runId);
      const totalDevices = context.devices.length;
      const partial = Math.max(totalDevices - succeeded - failed - cancelled, 0);

      const status =
        waitingApproval
          ? 'WAITING_APPROVAL'
          : cancelled === totalDevices
            ? 'CANCELLED'
            : succeeded === totalDevices
              ? 'COMPLETED'
              : failed === totalDevices && succeeded === 0 && cancelled === 0
                ? 'FAILED'
                : 'PARTIAL_SUCCESS';

      await finalizeOwnedRun(this.supabase, context.runId, claimToken, status, {
        ...(lastError ? { error: lastError } : {}),
        totalDevices,
        succeeded,
        failed,
        cancelled,
        partial,
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
