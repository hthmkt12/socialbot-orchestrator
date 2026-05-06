import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { MultiTargetRunExecutor } from '../multi-target-run-executor';
import { RunClaimCoordinator } from '../run-claim-coordinator';
import { SingleDeviceRunExecutor } from '../single-device-run-executor';
import { getTargetSerials, loadRootEnv, LOG_PREFIX, readWorkerConfig } from './mobile-mcp-db-smoke-env';
import {
  assertRunCompleted,
  createQueuedRun,
  ensureSmokeMacroVersion,
  loadSmokeProfile,
  upsertSmokeDevice,
} from './mobile-mcp-db-smoke-store';

const QUEUE_LOG_PREFIX = LOG_PREFIX.replace('multi-smoke', 'queue-smoke');
const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED', 'CANCELLED', 'PARTIAL_SUCCESS', 'WAITING_APPROVAL']);

void main().catch((error) => {
  console.error(`${QUEUE_LOG_PREFIX} FAIL`, error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

async function main() {
  loadRootEnv();
  const serials = await getTargetSerials();
  if (serials.length < 1) throw new Error('Need at least 1 online ADB device');

  const config = { ...readWorkerConfig(), pollIntervalMs: 500, maxActiveClaims: 1 };
  const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
  const profile = await loadSmokeProfile(supabase);
  const targetCount = Number(process.env.MOBILE_MCP_DB_QUEUE_TARGET_COUNT ?? Math.min(serials.length, 2));
  const devices = await Promise.all(serials.slice(0, targetCount).map((serial, index) => upsertSmokeDevice(supabase, serial, index)));
  const macroVersionId = await ensureSmokeMacroVersion(supabase, profile.id);
  const runId = await createQueuedRun(supabase, macroVersionId, profile.id, devices);

  console.log(`${QUEUE_LOG_PREFIX} QUEUED ${runId} serials=${devices.map((device) => device.laixi_device_id).join(',')}`);
  startCoordinator(config);
  await waitForTerminalRun(supabase, runId, Number(process.env.MOBILE_MCP_DB_QUEUE_TIMEOUT_MS ?? 180_000));
  await assertRunCompleted(supabase, runId, devices);
}

function startCoordinator(config: ReturnType<typeof readWorkerConfig>) {
  let releaseClaim: (runId: string, claimToken: string) => void = () => undefined;
  const singleTargetExecutor = new SingleDeviceRunExecutor(config, (runId, claimToken) => {
    releaseClaim(runId, claimToken);
  });
  const multiTargetExecutor = new MultiTargetRunExecutor(config, (runId, claimToken) => {
    releaseClaim(runId, claimToken);
  });
  const coordinator = new RunClaimCoordinator(config, ({ runId, claimToken, targetType }) =>
    targetType === 'SINGLE_DEVICE'
      ? singleTargetExecutor.executeClaimedRun(runId, claimToken)
      : multiTargetExecutor.executeClaimedRun(runId, claimToken)
  );
  releaseClaim = (runId, claimToken) => coordinator.releaseClaim(runId, claimToken);
  coordinator.start();
}

async function waitForTerminalRun(supabase: SupabaseClient, runId: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { data, error } = await supabase
      .from('workflow_runs')
      .select('status, execution_owner, execution_claim_token')
      .eq('id', runId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(`Run ${runId} disappeared`);
    if (TERMINAL_STATUSES.has(data.status)) {
      console.log(`${QUEUE_LOG_PREFIX} TERMINAL ${runId} status=${data.status}`);
      return data.status;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Timed out waiting for queued run ${runId}`);
}
