import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fetchRunMonitorDeviceStatuses } from './run-monitor-device-status-helpers';
import type { Approval, DeviceStatus, RunStep, WorkflowRun } from './run-monitor-types';
import { isTerminalRunStatus } from './run-monitor-runtime';

export function useRunMonitorData(runId: string | undefined, autoRefresh: boolean) {
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [steps, setSteps] = useState<RunStep[]>([]);
  const [deviceStatuses, setDeviceStatuses] = useState<DeviceStatus[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRunData = useCallback(async () => {
    if (!runId) return;

    const { data: runData } = await supabase
      .from('workflow_runs')
      .select('*')
      .eq('id', runId)
      .maybeSingle();

    if (runData) {
      setRun(runData);
    }

    const { data: approvalsData } = await supabase
      .from('approvals')
      .select('*')
      .eq('workflow_run_id', runId)
      .eq('status', 'PENDING');

    if (approvalsData) {
      setPendingApprovals(approvalsData);
    }

    const { data: stepsData } = await supabase
      .from('run_steps')
      .select('*')
      .eq('workflow_run_id', runId)
      .order('step_index', { ascending: true });

    if (stepsData) {
      setSteps(stepsData);
      setDeviceStatuses(await fetchRunMonitorDeviceStatuses(stepsData, runData));
    }

    setLoading(false);
  }, [runId]);

  useEffect(() => {
    fetchRunData();
  }, [fetchRunData]);

  useEffect(() => {
    if (!autoRefresh || !runId || isTerminalRunStatus(run?.status)) return;

    const interval = setInterval(() => {
      fetchRunData();
    }, 2000);

    return () => clearInterval(interval);
  }, [autoRefresh, runId, run?.status, fetchRunData]);

  useEffect(() => {
    if (!runId) return;

    const channel = supabase
      .channel(`run:${runId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workflow_runs',
          filter: `id=eq.${runId}`,
        },
        () => {
          fetchRunData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'run_steps',
          filter: `workflow_run_id=eq.${runId}`,
        },
        () => {
          fetchRunData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [runId, fetchRunData]);

  return {
    deviceStatuses,
    fetchRunData,
    loading,
    pendingApprovals,
    run,
    steps,
  };
}
