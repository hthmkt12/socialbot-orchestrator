import { supabase } from './supabase';

export interface SystemMonitorMetrics {
  database: {
    status: 'ONLINE' | 'ERROR';
    latencyMs: number;
    lastChecked: string;
  };
  queue: {
    queuedRuns: number;
    runningRuns: number;
    stalledRuns: number;
    failedLast24h: number;
  };
  activeWorkers: number;
}

export async function fetchSystemMetrics(): Promise<SystemMonitorMetrics> {
  const start = performance.now();

  let dbStatus: 'ONLINE' | 'ERROR' = 'ONLINE';
  let latencyMs = 0;

  try {
    // Ping DB
    const { error: pingError } = await supabase.from('workflow_runs').select('id').limit(1);
    if (pingError) throw pingError;
    latencyMs = Math.round(performance.now() - start);
  } catch {
    dbStatus = 'ERROR';
  }

  const now = new Date().toISOString();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Queue metrics
  const { count: queuedCount } = await supabase
    .from('workflow_runs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'QUEUED');

  const { count: runningCount } = await supabase
    .from('workflow_runs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'RUNNING');

  const { count: stalledCount } = await supabase
    .from('workflow_runs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'RUNNING')
    .lt('execution_lease_expires_at', now);

  const { count: failedCount } = await supabase
    .from('workflow_runs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'FAILED')
    .gte('updated_at', yesterday);

  // Active workers (inferred from unique execution_owners with active leases)
  const { data: owners } = await supabase
    .from('workflow_runs')
    .select('execution_owner')
    .in('status', ['RUNNING', 'WAITING_APPROVAL'])
    .gte('execution_lease_expires_at', now);

  const uniqueWorkers = new Set((owners ?? []).map((o) => o.execution_owner)).size;

  return {
    database: {
      status: dbStatus,
      latencyMs,
      lastChecked: now,
    },
    queue: {
      queuedRuns: queuedCount ?? 0,
      runningRuns: runningCount ?? 0,
      stalledRuns: stalledCount ?? 0,
      failedLast24h: failedCount ?? 0,
    },
    activeWorkers: uniqueWorkers,
  };
}
