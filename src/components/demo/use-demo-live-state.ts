import { useEffect, useMemo, useState } from 'react';
import { requestRunCancel, useRun, useRunArtifacts, useRunSteps } from '../../hooks/useRuns';
import { supabase } from '../../lib/supabase';
import {
  DEMO_STEPS,
  getDurationMs,
  mapRunStepStatus,
  TERMINAL_RUN_STATUSES,
  type DemoMode,
  type StepState,
} from './demo-workflow-state';

interface UseDemoLiveStateParams {
  activeRunId: string | null;
  mode: DemoMode;
  steps: StepState[];
  setIsRunning: (value: boolean) => void;
  setLastRunStatus: (value: string | null) => void;
  setRunComplete: (value: boolean) => void;
  setTotalDuration: (value: number) => void;
}

export function useDemoLiveState({
  activeRunId,
  mode,
  steps,
  setIsRunning,
  setLastRunStatus,
  setRunComplete,
  setTotalDuration,
}: UseDemoLiveStateParams) {
  const { data: liveRun } = useRun(activeRunId ?? '');
  const { data: liveRunSteps } = useRunSteps(activeRunId ?? '');
  const { data: liveArtifacts } = useRunArtifacts(activeRunId ?? '');
  const [liveApprovals, setLiveApprovals] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!activeRunId) {
      setLiveApprovals({});
      return;
    }

    const loadApprovals = async () => {
      const { data } = await supabase
        .from('approvals')
        .select('step_id, status')
        .eq('workflow_run_id', activeRunId)
        .order('created_at', { ascending: true });

      setLiveApprovals(
        (data ?? []).reduce<Record<string, string>>((byStep, approval) => {
          if (approval.step_id) byStep[approval.step_id] = approval.status;
          return byStep;
        }, {})
      );
    };

    void loadApprovals();
    const interval = window.setInterval(loadApprovals, 3000);
    return () => window.clearInterval(interval);
  }, [activeRunId]);

  useEffect(() => {
    if (mode !== 'live' || !activeRunId || !liveRun) return;

    setLastRunStatus(liveRun.status);
    const isTerminal = TERMINAL_RUN_STATUSES.has(liveRun.status);
    setRunComplete(isTerminal);
    setIsRunning(!isTerminal);

    if (liveRun.started_at) {
      setTotalDuration(getDurationMs(liveRun.started_at, liveRun.finished_at) ?? 0);
    }
  }, [activeRunId, liveRun, mode, setIsRunning, setLastRunStatus, setRunComplete, setTotalDuration]);

  const displaySteps = useMemo<StepState[]>(() => {
    if (mode !== 'live' || !activeRunId) return steps;

    const artifactsByStep = (liveArtifacts ?? []).reduce<Record<string, number>>((counts, artifact) => {
      const stepId = typeof artifact.metadata_json?.stepId === 'string' ? artifact.metadata_json.stepId : null;
      if (stepId) counts[stepId] = (counts[stepId] ?? 0) + 1;
      return counts;
    }, {});

    if (!liveRunSteps?.length) {
      return DEMO_STEPS.map((step) => ({
        ...step,
        status: liveRun?.status === 'QUEUED' ? 'queued' as const : 'pending' as const,
        output: activeRunId ? { runId: activeRunId, runStatus: liveRun?.status ?? 'PENDING' } : undefined,
      }));
    }

    return liveRunSteps.map((runStep) => ({
      id: runStep.step_id,
      type: runStep.step_type,
      label: DEMO_STEPS.find((step) => step.id === runStep.step_id)?.label ?? runStep.step_id,
      status: mapRunStepStatus(runStep.status),
      output: runStep.error_json
        ? { error: runStep.error_json, input: runStep.input_json }
        : { ...runStep.output_json, input: runStep.input_json },
      durationMs: getDurationMs(runStep.started_at, runStep.finished_at),
      artifactCount: artifactsByStep[runStep.step_id] ?? 0,
      approvalStatus: liveApprovals[runStep.step_id],
    }));
  }, [activeRunId, liveApprovals, liveArtifacts, liveRun?.status, liveRunSteps, mode, steps]);

  return { displaySteps, requestRunCancel };
}
