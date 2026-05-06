import { supabase } from '../lib/supabase';
import type { Artifact, RunStep, WorkflowRun } from '../lib/database.types';

export const TERMINAL_RUN_STATUSES = new Set([
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'PARTIAL_SUCCESS',
]);

export async function fetchRuns(): Promise<WorkflowRun[]> {
  const { data, error } = await supabase
    .from('workflow_runs')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as WorkflowRun[];
}

export function getRunsRefetchInterval(runs: WorkflowRun[] | undefined) {
  const hasLive = runs?.some((run) => !TERMINAL_RUN_STATUSES.has(run.status));
  return hasLive ? 5000 : 30_000;
}

export async function fetchRun(id: string): Promise<WorkflowRun | null> {
  const { data, error } = await supabase
    .from('workflow_runs')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as WorkflowRun | null;
}

export function getRunRefetchInterval(run: WorkflowRun | null | undefined) {
  return run?.status && TERMINAL_RUN_STATUSES.has(run.status) ? false : 3000;
}

export async function fetchRunSteps(runId: string): Promise<RunStep[]> {
  const { data, error } = await supabase
    .from('run_steps')
    .select('*')
    .eq('workflow_run_id', runId)
    .order('step_index', { ascending: true });
  if (error) throw error;
  return (data ?? []) as RunStep[];
}

export async function fetchRunArtifacts(runId: string): Promise<Artifact[]> {
  const { data, error } = await supabase
    .from('artifacts')
    .select('*')
    .eq('workflow_run_id', runId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Artifact[];
}
