import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { executeOwnedDeviceRun } from './execute-owned-device-run';
import { createDeviceStepBackend } from './device-step-backend-factory';
import { loadMultiTargetRunContext } from './multi-target-run-context';
import type { WorkerConfig } from './run-claim-coordinator';
import { aggregateRunResults } from './worker-step-store';
import { finalizeOwnedRun, isRunCancelled, markOwnedRunStatus } from './worker-run-store';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeResolvedTargetSummary(
  summaryJson: Record<string, unknown>,
  targetType: string,
  deviceIds: string[]
) {
  const execution = isRecord(summaryJson.execution) ? summaryJson.execution : {};
  return {
    ...summaryJson,
    execution: {
      ...execution,
      targetType,
      resolvedDeviceIds: deviceIds,
    },
  };
}

export class MultiTargetRunExecutor {
  private readonly supabase: SupabaseClient;

  constructor(
    private readonly config: WorkerConfig,
    private readonly releaseClaim: (runId: string, claimToken: string) => void
  ) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
  }

  async executeClaimedRun(runId: string, claimToken: string) {
    const backend = createDeviceStepBackend(this.config);

    try {
      const context = await loadMultiTargetRunContext(this.supabase, runId, claimToken);
      if (!context.resolvedDeviceIdsPersisted) {
        const { error: persistTargetsError } = await this.supabase
          .from('workflow_runs')
          .update({
            summary_json: mergeResolvedTargetSummary(
              context.summaryJson,
              context.targetType,
              context.devices.map((device) => device.id)
            ),
          })
          .eq('id', context.runId)
          .eq('execution_claim_token', claimToken);
        if (persistTargetsError) throw new Error(persistTargetsError.message);
      }

      await backend.connect();
      await markOwnedRunStatus(this.supabase, context.runId, claimToken, 'RUNNING');

      let succeeded = 0;
      let failed = 0;
      let cancelled = 0;
      let waitingApproval = false;
      let lastError: { code: string; message: string } | undefined;

      for (const device of context.devices) {
        if (await isRunCancelled(this.supabase, context.runId, claimToken)) {
          cancelled = context.devices.length - succeeded - failed;
          break;
        }

        const result = await executeOwnedDeviceRun({
          supabase: this.supabase,
          backend,
          runId: context.runId,
          claimToken,
          device,
          definition: context.definition,
          triggeredByUserId: context.triggeredByUserId,
          inputVariables: context.inputVariables,
        });

        if (result.status === 'COMPLETED') {
          succeeded += 1;
          continue;
        }

        if (result.status === 'WAITING_APPROVAL') {
          waitingApproval = true;
          break;
        }

        if (result.status === 'CANCELLED') {
          cancelled = context.devices.length - succeeded - failed;
          break;
        }

        failed += 1;
        lastError = result.error;
      }

      const aggregate = await aggregateRunResults(this.supabase, context.runId);
      const totalDevices = context.devices.length;
      const partial = Math.max(totalDevices - succeeded - failed - cancelled, 0);

      const status =
        waitingApproval
          ? 'WAITING_APPROVAL'
          : cancelled === totalDevices && succeeded === 0 && failed === 0
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
        totalSteps: aggregate.totalSteps,
        completedSteps: aggregate.completedSteps,
        failedSteps: aggregate.failedSteps,
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
      await backend.disconnect().catch(() => undefined);
      this.releaseClaim(runId, claimToken);
    }
  }
}
