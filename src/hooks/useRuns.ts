import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { logAudit } from '../lib/audit';
import { supabase } from '../lib/supabase';
import { requestRunCancel, requestRunStart } from './run-control-requests';
import {
  fetchRun,
  fetchRunArtifacts,
  fetchRuns,
  fetchRunSteps,
  getRunRefetchInterval,
  getRunsRefetchInterval,
} from './run-query-helpers';

export { requestRunCancel, requestRunStart } from './run-control-requests';

export function useRuns() {
  return useQuery({
    queryKey: ['runs'],
    queryFn: fetchRuns,
    refetchInterval: (query) => getRunsRefetchInterval(query.state.data),
  });
}

export function useRun(id: string) {
  return useQuery({
    queryKey: ['runs', id],
    queryFn: () => fetchRun(id),
    enabled: !!id,
    refetchInterval: (query) => getRunRefetchInterval(query.state.data),
  });
}

export function useRunSteps(runId: string) {
  return useQuery({
    queryKey: ['run-steps', runId],
    queryFn: () => fetchRunSteps(runId),
    enabled: !!runId,
    refetchInterval: 2000,
  });
}

export function useRunArtifacts(runId: string) {
  return useQuery({
    queryKey: ['run-artifacts', runId],
    queryFn: () => fetchRunArtifacts(runId),
    enabled: !!runId,
  });
}

export function useCreateRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      macroVersionId,
      profileId,
      targetType,
      targetSelector,
      inputVariables,
    }: {
      macroVersionId: string;
      profileId: string;
      targetType: string;
      targetSelector: Record<string, unknown>;
      inputVariables: Record<string, unknown>;
    }) => {
      const { data: run, error } = await supabase
        .from('workflow_runs')
        .insert({
          macro_version_id: macroVersionId,
          triggered_by_user_id: profileId,
          target_type: targetType,
          target_selector_json: targetSelector,
          input_variables_json: inputVariables,
          status: 'PENDING',
        })
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!run) throw new Error('Failed to create workflow run');

      await logAudit('run.create', 'workflow_run', run.id, { macroVersionId, targetType });
      const dispatch = await requestRunStart(run.id);
      await logAudit('run.dispatch_requested', 'workflow_run', run.id, {
        status: dispatch.status,
        outcome: dispatch.outcome,
      });

      return {
        ...(run as Record<string, unknown>),
        id: run.id,
        status: dispatch.status,
        dispatchOutcome: dispatch.outcome,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runs'] });
    },
  });
}

export function useCancelRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (runId: string) => {
      const result = await requestRunCancel(runId);
      await logAudit('run.cancel', 'workflow_run', runId, {
        status: result.status,
        outcome: result.outcome,
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runs'] });
    },
  });
}
