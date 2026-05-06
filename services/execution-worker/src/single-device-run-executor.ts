import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { executeOwnedDeviceRun } from './execute-owned-device-run';
import { aggregateRunResults } from './worker-step-store';
import { finalizeOwnedRun, loadSingleDeviceRunContext, markOwnedRunStatus } from './worker-run-store';
import { createDeviceStepBackend } from './device-step-backend-factory';
import type { WorkerConfig } from './run-claim-coordinator';

export class SingleDeviceRunExecutor {
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
      const context = await loadSingleDeviceRunContext(this.supabase, runId, claimToken);
      await backend.connect();
      await markOwnedRunStatus(this.supabase, context.runId, claimToken, 'RUNNING');
      const result = await executeOwnedDeviceRun({
        supabase: this.supabase,
        backend,
        runId: context.runId,
        claimToken,
        device: context.device,
        definition: context.definition,
        triggeredByUserId: context.triggeredByUserId,
        inputVariables: context.inputVariables,
      });
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
        succeeded: status === 'COMPLETED' ? 1 : 0,
        failed: status === 'FAILED' ? 1 : 0,
        cancelled: status === 'CANCELLED' ? 1 : 0,
        partial: 0,
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
