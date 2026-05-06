import type { MacroDefinition } from '../contracts/macro';
import { getLaixiClient } from '../adapters/laixi/client';
import { supabase } from '../lib/supabase';
import { releaseAllRunLocks } from './device-lock';
import { buildRunnerContext } from './orchestrator-context';
import {
  buildExecutionErrorResult,
  buildExecutionResult,
  buildWorkflowSummaryUpdate,
  resolveMultiRunStatus,
  resolveSingleRunStatus,
} from './orchestrator-results';
import { WorkflowRunner } from './runner';
import { createCancellationToken, type CancellationToken } from './types';
import type { Device, RunStatus } from '../lib/database.types';
import type { ExecutionResult, MultiDeviceResult } from './types';

const activeTokens = new Map<string, CancellationToken>();

export class RunOrchestrator {
  async executeRun(
    runId: string,
    device: Device,
    definition: MacroDefinition,
    inputs: Record<string, string>,
    userId: string = ''
  ): Promise<ExecutionResult> {
    const token = this.registerRun(runId);
    const runner = new WorkflowRunner(getLaixiClient());
    const ctx = buildRunnerContext({ definition, device, inputs, runId, token, userId });

    await this.updateRunStatus(runId, 'RUNNING');

    try {
      const result = await runner.executeForDevice(definition.steps, ctx);
      const status = resolveSingleRunStatus(result.success, token.cancelled);
      await this.updateRunStatus(runId, status);
      return buildExecutionResult(runId, device.id, ctx, result, token.cancelled);
    } catch (error) {
      await this.updateRunStatus(runId, 'FAILED');
      return buildExecutionErrorResult(runId, device.id, definition, error);
    } finally {
      this.clearRun(runId);
    }
  }

  async executeMultiDeviceRun(
    runId: string,
    userId: string,
    devices: Device[],
    definition: MacroDefinition,
    inputs: Record<string, string>
  ): Promise<MultiDeviceResult> {
    const token = this.registerRun(runId);
    const runner = new WorkflowRunner(getLaixiClient());
    const deviceResults = new Map<string, ExecutionResult>();
    let successfulDevices = 0;
    let failedDevices = 0;
    let cancelledDevices = 0;

    await this.updateRunStatus(runId, 'RUNNING');

    const executions = devices.map(async (device) => {
      const ctx = buildRunnerContext({ definition, device, inputs, runId, token, userId });

      try {
        const result = await runner.executeForDevice(definition.steps, ctx);
        const execResult = buildExecutionResult(runId, device.id, ctx, result, token.cancelled);
        deviceResults.set(device.id, execResult);

        if (result.success) successfulDevices++;
        else if (token.cancelled) cancelledDevices++;
        else failedDevices++;

        return execResult;
      } catch (error) {
        if (token.cancelled) cancelledDevices++;
        else failedDevices++;

        const errorResult = buildExecutionErrorResult(runId, device.id, definition, error);
        deviceResults.set(device.id, errorResult);
        return errorResult;
      }
    });

    await Promise.allSettled(executions);

    const overallStatus = resolveMultiRunStatus(
      token.cancelled,
      successfulDevices,
      failedDevices,
      devices.length
    );

    await this.updateRunStatus(runId, overallStatus === 'PARTIAL' ? 'PARTIAL_SUCCESS' : overallStatus);

    const summary = await runner.aggregateRunResults(runId);
    await supabase
      .from('workflow_runs')
      .update({
        summary_json: buildWorkflowSummaryUpdate(
          devices.length,
          successfulDevices,
          failedDevices,
          cancelledDevices,
          summary
        ),
      })
      .eq('id', runId);

    this.clearRun(runId);

    return {
      runId,
      overallStatus,
      deviceResults,
      totalDevices: devices.length,
      successfulDevices,
      failedDevices,
    };
  }

  requestCancellation(runId: string): void {
    const token = activeTokens.get(runId);
    if (token) {
      token.cancel('Cancelled by user');
    }
  }

  async cancelRun(runId: string): Promise<void> {
    this.requestCancellation(runId);
    await this.updateRunStatus(runId, 'CANCELLED');
    await releaseAllRunLocks(runId);
    this.clearRun(runId);
  }

  private registerRun(runId: string): CancellationToken {
    const token = createCancellationToken();
    activeTokens.set(runId, token);
    return token;
  }

  private clearRun(runId: string) {
    activeTokens.delete(runId);
  }

  private async updateRunStatus(runId: string, status: RunStatus): Promise<void> {
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { status };

    if (status === 'RUNNING') updates.started_at = now;
    if (['COMPLETED', 'FAILED', 'CANCELLED', 'PARTIAL_SUCCESS'].includes(status)) updates.finished_at = now;
    if (status === 'CANCELLED') updates.cancelled_at = now;

    await supabase.from('workflow_runs').update(updates).eq('id', runId);
  }
}
