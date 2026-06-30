import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { buildClaimSummary } from './run-claim-summary';

export interface WorkerConfig {
  port: number;
  pollIntervalMs: number;
  leaseTtlMs: number;
  maxActiveClaims: number;
  instanceId: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  gatewayBaseUrl: string;
  mobileMcpBridgeUrl: string;
  deviceBackend: 'laixi' | 'mobile-mcp' | 'mobilerun';
  commandTimeoutMs: number;
  bridgeToken?: string;
}

interface ClaimedWorkflowRun {
  id: string;
  status: string;
  target_type: string;
  summary_json: Record<string, unknown> | null;
  execution_lease_expires_at: string | null;
  execution_claim_token: string | null;
  created_at: string;
}

interface ActiveClaim {
  claimToken: string;
  claimedAt: string;
  leaseExpiresAt: string;
}

const CLAIM_SELECT =
  'id, status, target_type, summary_json, execution_lease_expires_at, execution_claim_token, created_at';
const ACTIVE_CLAIMED_RUN_STATUSES = new Set(['QUEUED', 'RUNNING', 'WAITING_APPROVAL']);
const CLAIMABLE_TARGET_TYPES = ['SINGLE_DEVICE', 'MULTI_DEVICE', 'DEVICE_GROUP', 'ALL_DEVICES'];

type ClaimHandler = (params: { runId: string; claimToken: string; targetType: string }) => Promise<void>;

export class RunClaimCoordinator {
  private readonly supabase: SupabaseClient;
  private readonly activeClaims = new Map<string, ActiveClaim>();
  private pollInFlight = false;
  private pollIntervalId: ReturnType<typeof setInterval> | null = null;
  private stopped = false;

  constructor(
    private readonly config: WorkerConfig,
    private readonly onClaim?: ClaimHandler
  ) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
  }

  start() {
    console.log('[execution-worker] claim loop ready');
    console.log(
      `[execution-worker] instance ${this.config.instanceId}, poll ${this.config.pollIntervalMs}ms, lease ${this.config.leaseTtlMs}ms`
    );

    void this.poll();
    this.pollIntervalId = setInterval(() => void this.poll(), this.config.pollIntervalMs);
    this.pollIntervalId.unref();
  }

  /** Stop polling and release all active claims. */
  async stop() {
    this.stopped = true;
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }

    // Release all active claims so runs become claimable by other workers
    for (const [runId, claim] of this.activeClaims.entries()) {
      try {
        await this.supabase
          .from('workflow_runs')
          .update({
            execution_owner: null,
            execution_claim_token: null,
            execution_lease_expires_at: null,
          })
          .eq('id', runId)
          .eq('execution_claim_token', claim.claimToken);
        console.log(`[execution-worker] released claim for run ${runId}`);
      } catch (error) {
        console.error(`[execution-worker] failed to release claim for run ${runId}`, error);
      }
    }
    this.activeClaims.clear();
    console.log('[execution-worker] graceful shutdown complete');
  }

  getHealthSnapshot() {
    return {
      instanceId: this.config.instanceId,
      maxActiveClaims: this.config.maxActiveClaims,
      activeClaimCount: this.activeClaims.size,
      activeClaims: Array.from(this.activeClaims.entries()).map(([runId, claim]) => ({
        runId,
        claimToken: claim.claimToken,
        claimedAt: claim.claimedAt,
        leaseExpiresAt: claim.leaseExpiresAt,
      })),
    };
  }

  releaseClaim(runId: string, claimToken: string) {
    const active = this.activeClaims.get(runId);
    if (active?.claimToken === claimToken) {
      this.activeClaims.delete(runId);
    }
  }

  private async poll() {
    if (this.pollInFlight || this.stopped) return;
    this.pollInFlight = true;

    try {
      await this.renewActiveClaims();
      const remainingCapacity = this.config.maxActiveClaims - this.activeClaims.size;
      if (remainingCapacity > 0) {
        await this.claimQueuedRuns(remainingCapacity);
      }
    } catch (error) {
      console.error('[execution-worker] claim loop error', error);
    } finally {
      this.pollInFlight = false;
    }
  }

  private async renewActiveClaims() {
    for (const [runId, claim] of this.activeClaims.entries()) {
      const now = new Date().toISOString();
      const nextLease = new Date(Date.now() + this.config.leaseTtlMs).toISOString();
      const { data, error } = await this.supabase
        .from('workflow_runs')
        .select('summary_json, status, execution_claim_token')
        .eq('id', runId)
        .maybeSingle();

      if (
        error ||
        !data ||
        !ACTIVE_CLAIMED_RUN_STATUSES.has(data.status) ||
        data.execution_claim_token !== claim.claimToken
      ) {
        this.activeClaims.delete(runId);
        continue;
      }

      const summaryJson = buildClaimSummary(
        data.summary_json as Record<string, unknown> | null,
        this.config.instanceId,
        claim.claimToken,
        claim.claimedAt,
        now,
        nextLease,
        data.status,
        false
      );

      const { data: renewed, error: renewError } = await this.supabase
        .from('workflow_runs')
        .update({
          execution_lease_expires_at: nextLease,
          execution_heartbeat_at: now,
          summary_json: summaryJson,
        })
        .eq('id', runId)
        .eq('execution_owner', this.config.instanceId)
        .eq('execution_claim_token', claim.claimToken)
        .select('id')
        .maybeSingle();

      if (renewError || !renewed) {
        this.activeClaims.delete(runId);
        continue;
      }

      this.activeClaims.set(runId, { ...claim, leaseExpiresAt: nextLease });
    }
  }

  private async claimQueuedRuns(limit: number) {
    const nowIso = new Date().toISOString();
      const freshRuns = await this.selectQueuedRuns(limit, false, nowIso);
    for (const run of freshRuns) {
      if (this.activeClaims.size >= this.config.maxActiveClaims) return;
      await this.tryClaimRun(run, false, nowIso);
    }

    const remaining = this.config.maxActiveClaims - this.activeClaims.size;
    if (remaining <= 0) return;

    const expiredRuns = await this.selectQueuedRuns(remaining, true, nowIso);
    for (const run of expiredRuns) {
      if (this.activeClaims.size >= this.config.maxActiveClaims) return;
      await this.tryClaimRun(run, true, nowIso);
    }
  }

  private async selectQueuedRuns(limit: number, expiredOnly: boolean, nowIso: string) {
    let query = this.supabase
      .from('workflow_runs')
      .select(CLAIM_SELECT)
      .eq('status', 'QUEUED')
      .in('target_type', CLAIMABLE_TARGET_TYPES)
      .limit(limit);

    query = expiredOnly
      ? query.lt('execution_lease_expires_at', nowIso).order('execution_lease_expires_at', { ascending: true })
      : query.is('execution_lease_expires_at', null).order('created_at', { ascending: true });

    const { data, error } = await query;
    if (error || !data) {
      if (error) {
        console.error('[execution-worker] failed to load claim candidates', error);
      }
      return [];
    }

    return data as ClaimedWorkflowRun[];
  }

  private async tryClaimRun(run: ClaimedWorkflowRun, isReclaim: boolean, nowIso: string) {
    if (this.activeClaims.has(run.id)) return;

    const claimToken = randomUUID();
    const claimedAt = new Date().toISOString();
    const leaseExpiresAt = new Date(Date.now() + this.config.leaseTtlMs).toISOString();
    const summaryJson = buildClaimSummary(
      run.summary_json,
      this.config.instanceId,
      claimToken,
      claimedAt,
      claimedAt,
      leaseExpiresAt,
      run.status,
      isReclaim
    );

    let query = this.supabase
      .from('workflow_runs')
      .update({
        execution_owner: this.config.instanceId,
        execution_claim_token: claimToken,
        execution_lease_expires_at: leaseExpiresAt,
        execution_heartbeat_at: claimedAt,
        summary_json: summaryJson,
      })
      .eq('id', run.id)
      .eq('status', 'QUEUED');

    query = isReclaim ? query.lt('execution_lease_expires_at', nowIso) : query.is('execution_lease_expires_at', null);

    const { data, error } = await query.select(CLAIM_SELECT).maybeSingle();
    if (error || !data) return;

    this.activeClaims.set(run.id, { claimToken, claimedAt, leaseExpiresAt });
    console.log(
      `[execution-worker] ${isReclaim ? 'reclaimed' : 'claimed'} run ${run.id} with token ${claimToken}`
    );

    if (this.onClaim) {
      void this.onClaim({ runId: run.id, claimToken, targetType: run.target_type }).catch((error) => {
        console.error(`[execution-worker] claim handler failed for run ${run.id}`, error);
      });
    }
  }
}
