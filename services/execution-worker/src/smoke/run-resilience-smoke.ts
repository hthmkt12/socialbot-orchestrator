import assert from 'node:assert/strict';
import type { MacroDefinition } from '../../../../src/contracts/macro';
import type { DeviceCommandClient, DeviceDispatchContext } from '../device-command-client';
import {
  handleCancelControlAction,
  handleStartControlAction,
  type LaixiCommandRequest,
  type LaixiCommandResponse,
  type StepArtifactRef,
} from '../../../../packages/shared/src';
import { executeOwnedDeviceRun } from '../execute-owned-device-run';
import { LaixiStepBackend } from '../laixi-step-backend';
import { aggregateRunResults, loadPersistedRunSteps } from '../worker-step-store';
import { finalizeOwnedRun, markOwnedRunStatus } from '../worker-run-store';
import { InMemoryBackendDb } from './in-memory-backend-db';

class FakeDeviceClient implements DeviceCommandClient {
  async connect() { return; }
  async disconnect() { return; }
  async sendCommand(command: LaixiCommandRequest, context: DeviceDispatchContext): Promise<LaixiCommandResponse> {
    void context;
    if (command.action === 'ExecuteAdb') {
      return { success: true, data: { output: 'pm list packages -> ok' } };
    }
    if (command.action === 'screen') {
      const artifacts: StepArtifactRef[] = [{ type: 'SCREENSHOT', contentType: 'image/png', base64: 'ZmFrZS1zY3JlZW5zaG90' }];
      return {
        success: true,
        data: { base64: 'ZmFrZS1zY3JlZW5zaG90' },
        artifacts,
      };
    }
    return { success: true, data: {} };
  }
  async sendCommands(commands: LaixiCommandRequest[], context: DeviceDispatchContext): Promise<LaixiCommandResponse[]> {
    const results: LaixiCommandResponse[] = [];
    for (const command of commands) results.push(await this.sendCommand(command, context));
    return results;
  }
}

function buildApprovalMacro(): MacroDefinition {
  return {
    version: 1,
    meta: { key: 'smoke_approval_resume', name: 'Smoke Approval Resume' },
    inputs: {},
    target: { mode: 'single_device' },
    execution: { defaultTimeoutMs: 1000, maxRetries: 0, onError: 'stop' },
    steps: [
      { id: 'adb_1', type: 'adb', params: { command: 'pm list packages' }, policy: { requiresApproval: true } },
      { id: 'screen_1', type: 'screenshot', params: { saveToArtifact: true } },
    ],
  };
}

function seedSingleDeviceRun(db: InMemoryBackendDb, runId: string, definition: MacroDefinition) {
  db.seed('devices', {
    id: 'device-1',
    laixi_device_id: 'laixi-1',
    name: 'Smoke Device',
    model: 'Pixel',
    brand: 'Google',
    android_version: '14',
    screen_width: 1080,
    screen_height: 2400,
    status: 'ONLINE',
    last_seen_at: new Date().toISOString(),
    metadata_json: {},
  });
  db.seed('macro_versions', { id: 'macro-1', definition_json: definition });
  db.seed('workflow_runs', {
    id: runId,
    status: 'QUEUED',
    target_type: 'SINGLE_DEVICE',
    target_selector_json: { deviceId: 'device-1' },
    input_variables_json: {},
    triggered_by_user_id: 'user-1',
    macro_version_id: 'macro-1',
    execution_owner: 'smoke-worker',
    execution_claim_token: 'claim-1',
    execution_lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
    execution_heartbeat_at: new Date().toISOString(),
    summary_json: {},
  });
}

async function scenarioStartQueuesRun() {
  const db = new InMemoryBackendDb();
  db.seed('workflow_runs', { id: 'run-start', status: 'PENDING', summary_json: {} });
  const run = await db.getRun('run-start');
  assert(run);
  const result = await handleStartControlAction(db, run);
  assert.equal(result.status, 'QUEUED');
  assert.equal(result.outcome, 'queued');
  assert.equal(db.getWorkflowRun('run-start')?.status, 'QUEUED');
}

async function scenarioCancelCleansLiveState() {
  const db = new InMemoryBackendDb();
  db.seed('workflow_runs', { id: 'run-cancel', status: 'RUNNING', summary_json: {}, execution_claim_token: 'claim-cancel' });
  db.seed('run_steps', { workflow_run_id: 'run-cancel', device_id: 'device-1', step_index: 0, step_id: 'wait_1', step_type: 'wait', status: 'RUNNING', input_json: {}, output_json: {}, error_json: null, retry_count: 0, screenshot_artifact_id: null });
  db.seed('run_steps', { workflow_run_id: 'run-cancel', device_id: 'device-1', step_index: 1, step_id: 'done_1', step_type: 'wait', status: 'SUCCESS', input_json: {}, output_json: {}, error_json: null, retry_count: 0, screenshot_artifact_id: null });
  db.seed('approvals', { workflow_run_id: 'run-cancel', step_id: 'adb_1', step_type: 'adb', reason: 'Need approval', status: 'PENDING', metadata: {} });
  db.seed('device_locks', { device_id: 'device-1', workflow_run_id: 'run-cancel', expires_at: new Date(Date.now() + 60_000).toISOString() });
  const run = await db.getRun('run-cancel');
  assert(run);
  const result = await handleCancelControlAction(db, run);
  assert.equal(result.status, 'CANCELLED');
  assert.equal(db.getWorkflowRun('run-cancel')?.status, 'CANCELLED');
  assert.equal(db.rows('device_locks').length, 0);
  assert.equal(db.rows('approvals')[0]?.status, 'EXPIRED');
  assert.equal(db.rows('run_steps')[0]?.status, 'CANCELLED');
  assert.equal(db.rows('run_steps')[1]?.status, 'SUCCESS');
}

async function scenarioApprovalResumeAfterUiDisconnect() {
  const db = new InMemoryBackendDb();
  const definition = buildApprovalMacro();
  seedSingleDeviceRun(db, 'run-approval', definition);

  const supabase = db.asSupabase();
  const device = db.getDevice('device-1');
  assert(device);

  await markOwnedRunStatus(supabase, 'run-approval', 'claim-1', 'RUNNING');
  const firstPass = await executeOwnedDeviceRun({
    supabase,
    backend: new LaixiStepBackend(new FakeDeviceClient()),
    runId: 'run-approval',
    claimToken: 'claim-1',
    device,
    definition,
    triggeredByUserId: 'user-1',
    inputVariables: {},
  });
  assert.equal(firstPass.status, 'WAITING_APPROVAL');
  await finalizeOwnedRun(supabase, 'run-approval', 'claim-1', 'WAITING_APPROVAL', {});
  assert.equal(db.getWorkflowRun('run-approval')?.status, 'WAITING_APPROVAL');
  assert.equal(db.rows('device_locks').length, 0);
  assert.equal(db.rows('approvals').length, 1);
  assert.equal(db.rows('approvals')[0]?.status, 'PENDING');

  db.approveAndRequeue('run-approval', 'adb_1');
  Object.assign(db.getWorkflowRun('run-approval')!, {
    execution_owner: 'smoke-worker',
    execution_claim_token: 'claim-2',
    execution_lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
    execution_heartbeat_at: new Date().toISOString(),
  });

  await markOwnedRunStatus(supabase, 'run-approval', 'claim-2', 'RUNNING');
  const secondPass = await executeOwnedDeviceRun({
    supabase,
    backend: new LaixiStepBackend(new FakeDeviceClient()),
    runId: 'run-approval',
    claimToken: 'claim-2',
    device,
    definition,
    triggeredByUserId: 'user-1',
    inputVariables: {},
  });
  assert.equal(secondPass.status, 'COMPLETED');
  const aggregate = await aggregateRunResults(supabase, 'run-approval');
  await finalizeOwnedRun(supabase, 'run-approval', 'claim-2', 'COMPLETED', {
    totalDevices: 1,
    succeeded: 1,
    failed: 0,
    cancelled: 0,
    partial: 0,
    totalSteps: aggregate.totalSteps,
    completedSteps: aggregate.completedSteps,
    failedSteps: aggregate.failedSteps,
    avgCompletionRate: aggregate.avgCompletionRate,
  });

  const persisted = await loadPersistedRunSteps(supabase, 'run-approval', 'device-1');
  assert.equal(db.getWorkflowRun('run-approval')?.status, 'COMPLETED');
  assert.equal(persisted.get('adb_1')?.status, 'SUCCESS');
  assert.equal(persisted.get('screen_1')?.status, 'SUCCESS');
  assert.equal(db.rows('artifacts').filter((row) => row.type === 'SCREENSHOT').length, 1);
  assert.equal(db.rows('artifacts').filter((row) => row.type === 'LOG_BLOB').length, 1);
}

async function main() {
  const scenarios: Array<[string, () => Promise<void>]> = [
    ['start queues a pending run', scenarioStartQueuesRun],
    ['cancel cleans active steps, approvals, and locks', scenarioCancelCleansLiveState],
    ['approval resume completes after refresh/tab-close style reconnect', scenarioApprovalResumeAfterUiDisconnect],
  ];

  let failures = 0;
  for (const [name, run] of scenarios) {
    try {
      await run();
      console.log(`[smoke] PASS ${name}`);
    } catch (error) {
      failures += 1;
      console.error(`[smoke] FAIL ${name}`);
      console.error(error);
    }
  }

  if (failures > 0) {
    console.error(`[smoke] ${failures} scenario(s) failed`);
    process.exit(1);
  }

  console.log(`[smoke] PASS ${scenarios.length} scenario(s)`);
}

void main();
