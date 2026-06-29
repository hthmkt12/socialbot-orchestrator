import assert from 'node:assert/strict';
import type { MacroDefinition } from '../../../../src/contracts/macro';
import type { DeviceCommandClient, DeviceDispatchContext } from '../device-command-client';
import {
  type LaixiCommandRequest,
  type LaixiCommandResponse,
} from '../../../../packages/shared/src';
import { executeOwnedDeviceRun } from '../execute-owned-device-run';
import { LaixiStepBackend } from '../laixi-step-backend';
import { InMemoryBackendDb } from './in-memory-backend-db';

class RecordingFakeDeviceClient implements DeviceCommandClient {
  public readonly commandsReceived: LaixiCommandRequest[] = [];

  async connect() { return; }
  async disconnect() { return; }
  async sendCommand(command: LaixiCommandRequest, context: DeviceDispatchContext): Promise<LaixiCommandResponse> {
    void context;
    this.commandsReceived.push(command);
    
    // Echo back mock output if it's an ADB command
    if (command.action === 'ExecuteAdb') {
      return { success: true, data: { output: `Executed: ${command.params?.command}` } };
    }
    return { success: true, data: {} };
  }
  async sendCommands(commands: LaixiCommandRequest[], context: DeviceDispatchContext): Promise<LaixiCommandResponse[]> {
    const results: LaixiCommandResponse[] = [];
    for (const command of commands) results.push(await this.sendCommand(command, context));
    return results;
  }
}

function buildForeachMacro(arraySourceVar: string, itemName = 'item'): MacroDefinition {
  return {
    version: 1,
    meta: { key: 'smoke_foreach_loop', name: 'Smoke Foreach Loop' },
    inputs: {},
    target: { mode: 'single_device' },
    execution: { defaultTimeoutMs: 1000, maxRetries: 0, onError: 'stop' },
    steps: [
      {
        id: 'foreach_1',
        type: 'foreach',
        params: {
          arraySourceVar,
          itemName,
        },
        steps: [
          {
            id: 'adb_inside_loop',
            type: 'adb',
            params: {
              command: 'echo {{' + itemName + '}}',
            },
          },
        ],
      },
    ],
  };
}

function seedDeviceAndRun(db: InMemoryBackendDb, runId: string, definition: MacroDefinition, inputVariables: Record<string, unknown>) {
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
  db.seed('macro_versions', { id: 'macro-foreach', definition_json: definition });
  db.seed('workflow_runs', {
    id: runId,
    status: 'QUEUED',
    target_type: 'SINGLE_DEVICE',
    target_selector_json: { deviceId: 'device-1' },
    input_variables_json: inputVariables,
    triggered_by_user_id: 'user-1',
    macro_version_id: 'macro-foreach',
    execution_owner: 'smoke-worker',
    execution_claim_token: 'claim-foreach',
    execution_lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
    execution_heartbeat_at: new Date().toISOString(),
    summary_json: {},
  });
}

// Scenario 1: JSON array string
async function scenarioJsonArrayString() {
  const db = new InMemoryBackendDb();
  const definition = buildForeachMacro('tags', 'tag');
  const inputVariables = { tags: '["react", "node", "typescript"]' };
  seedDeviceAndRun(db, 'run-json-string', definition, inputVariables);

  const deviceClient = new RecordingFakeDeviceClient();
  const result = await executeOwnedDeviceRun({
    supabase: db.asSupabase(),
    backend: new LaixiStepBackend(deviceClient),
    runId: 'run-json-string',
    claimToken: 'claim-foreach',
    device: db.getDevice('device-1')!,
    definition,
    triggeredByUserId: 'user-1',
    inputVariables,
  });

  assert.equal(result.status, 'COMPLETED');
  
  // Verify commands received by mock device
  assert.equal(deviceClient.commandsReceived.length, 3);
  assert.equal((deviceClient.commandsReceived[0].params as Record<string, unknown>).command, 'echo react');
  assert.equal((deviceClient.commandsReceived[1].params as Record<string, unknown>).command, 'echo node');
  assert.equal((deviceClient.commandsReceived[2].params as Record<string, unknown>).command, 'echo typescript');

  // Verify DB state
  const steps = db.rows('run_steps');
  const foreachStep = steps.find(r => r.step_id === 'foreach_1');
  assert.equal(foreachStep?.status, 'SUCCESS');
  assert.deepEqual(foreachStep?.output_json, { iterationsCompleted: 3 });
}

// Scenario 2: Comma separated string
async function scenarioCommaSeparatedString() {
  const db = new InMemoryBackendDb();
  const definition = buildForeachMacro('colors', 'color');
  const inputVariables = { colors: 'red, green, blue' };
  seedDeviceAndRun(db, 'run-csv-string', definition, inputVariables);

  const deviceClient = new RecordingFakeDeviceClient();
  const result = await executeOwnedDeviceRun({
    supabase: db.asSupabase(),
    backend: new LaixiStepBackend(deviceClient),
    runId: 'run-csv-string',
    claimToken: 'claim-foreach',
    device: db.getDevice('device-1')!,
    definition,
    triggeredByUserId: 'user-1',
    inputVariables,
  });

  assert.equal(result.status, 'COMPLETED');
  assert.equal(deviceClient.commandsReceived.length, 3);
  assert.equal((deviceClient.commandsReceived[0].params as Record<string, unknown>).command, 'echo red');
  assert.equal((deviceClient.commandsReceived[1].params as Record<string, unknown>).command, 'echo green');
  assert.equal((deviceClient.commandsReceived[2].params as Record<string, unknown>).command, 'echo blue');
  
  // Verify DB state
  const steps = db.rows('run_steps');
  const foreachStep = steps.find(r => r.step_id === 'foreach_1');
  assert.equal(foreachStep?.status, 'SUCCESS');
  assert.deepEqual(foreachStep?.output_json, { iterationsCompleted: 3 });
}

// Scenario 3: Real array input
async function scenarioRealArrayInput() {
  const db = new InMemoryBackendDb();
  const definition = buildForeachMacro('items', 'item');
  const inputVariables = { items: ['apple', 'banana'] };
  seedDeviceAndRun(db, 'run-real-array', definition, inputVariables);

  const deviceClient = new RecordingFakeDeviceClient();
  const result = await executeOwnedDeviceRun({
    supabase: db.asSupabase(),
    backend: new LaixiStepBackend(deviceClient),
    runId: 'run-real-array',
    claimToken: 'claim-foreach',
    device: db.getDevice('device-1')!,
    definition,
    triggeredByUserId: 'user-1',
    inputVariables,
  });

  assert.equal(result.status, 'COMPLETED');
  assert.equal(deviceClient.commandsReceived.length, 2);
  assert.equal((deviceClient.commandsReceived[0].params as Record<string, unknown>).command, 'echo apple');
  assert.equal((deviceClient.commandsReceived[1].params as Record<string, unknown>).command, 'echo banana');

  // Verify DB state
  const steps = db.rows('run_steps');
  const foreachStep = steps.find(r => r.step_id === 'foreach_1');
  assert.equal(foreachStep?.status, 'SUCCESS');
  assert.deepEqual(foreachStep?.output_json, { iterationsCompleted: 2 });
}

export const foreachScenarios: Array<[string, () => Promise<void>]> = [
  ['foreach over JSON array string', scenarioJsonArrayString],
  ['foreach over comma-separated string', scenarioCommaSeparatedString],
  ['foreach over native array object', scenarioRealArrayInput],
];

export async function runForeachSmokeTests() {
  let failures = 0;
  for (const [name, run] of foreachScenarios) {
    try {
      await run();
      console.log(`[smoke] PASS foreach ${name}`);
    } catch (error) {
      failures += 1;
      console.error(`[smoke] FAIL foreach ${name}`);
      console.error(error);
    }
  }

  if (failures > 0) {
    throw new Error(`${failures} foreach scenario(s) failed`);
  }
}

