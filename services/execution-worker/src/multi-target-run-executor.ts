import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadMultiTargetRunContext } from './multi-target-run-context';
import type { WorkerConfig } from './run-claim-coordinator';
import { aggregateRunResults } from './worker-step-store';
import { finalizeOwnedRun, isRunCancelled, markOwnedRunStatus } from './worker-run-store';
import { executeOwnedDeviceRun, type OwnedDeviceRunResult } from './execute-owned-device-run.js';
import type { Device, MacroDefinition } from '../../../packages/shared/src';
import { fileURLToPath } from 'node:url';
import { createDeviceWorker, hasCompiledDeviceWorker } from './device-worker-runtime';
import { createDeviceStepBackend } from './device-step-backend-factory.js';
import type { RetryBackoffPolicy } from './retry-backoff-policy.js';
import { buildTargetFailureDecision, type TargetFailureDecision } from './target-failure-policy.js';

function mergeResolvedTargetSummary(
  summaryJson: Record<string, unknown> | null,
  targetType: string,
  devices: { id: string; name: string }[],
  targetFailurePolicy: string,
  maxPilotTargetCount: number
): Record<string, unknown> {
  const patch = {
    targetType,
    targetCount: devices.length,
    targetFailurePolicy,
    maxPilotTargetCount,
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

interface DeviceWorkerData {
  config: WorkerConfig;
  runId: string;
  claimToken: string;
  device: Device;
  definition: MacroDefinition;
  retryBackoffPolicy?: RetryBackoffPolicy;
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
              context.devices.map((d) => ({ id: d.id, name: d.name })),
              context.targetFailurePolicy,
              context.maxPilotTargetCount
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
      const targetFailureDecisions: TargetFailureDecision[] = [];

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
            const result = await runDeviceWorker(this.__dirname, {
              config: this.config,
              runId: context.runId,
              claimToken,
              device,
              definition: context.definition,
              retryBackoffPolicy: context.retryBackoffPolicy,
              triggeredByUserId: context.triggeredByUserId,
              inputVariables: context.inputVariables,
            });

            if (result.status === 'COMPLETED') {
              incrementSuccess();
            } else if (result.status === 'WAITING_APPROVAL') {
              waitingApproval = true;
              incrementSuccess();
            } else if (result.status === 'CANCELLED') {
              incrementCancelled();
            } else {
              incrementFailed(result.error);
              targetFailureDecisions.push(buildTargetFailureDecision({
                device,
                error: result.error,
                policy: context.targetFailurePolicy,
              }));
            }
          } catch (error) {
             const structuredError = {
                code: 'WORKER_CRASH',
                message: error instanceof Error ? error.message : String(error)
             };
             incrementFailed(structuredError);
             targetFailureDecisions.push(buildTargetFailureDecision({
               device,
               error: structuredError,
               policy: context.targetFailurePolicy,
             }));
          }
        }));

        if (context.targetFailurePolicy === 'fail_fast' && failed > 0) {
          break;
        }
      }

      const aggregate = await aggregateRunResults(this.supabase, context.runId);
      const totalDevices = context.devices.length;
      const skipped = Math.max(totalDevices - succeeded - failed - cancelled, 0);
      const partial = skipped;

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
        skipped,
        partial,
        targetFailurePolicy: context.targetFailurePolicy,
        maxPilotTargetCount: context.maxPilotTargetCount,
        targetFailureDecisions,
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
