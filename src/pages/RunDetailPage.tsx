import { useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import RunArtifactsPanel from '../components/runs/RunArtifactsPanel';
import { RunDetailFocusBanner } from '../components/runs/RunDetailFocusBanner';
import { RunDetailHeader } from '../components/runs/RunDetailHeader';
import { RunDetailInfoCards } from '../components/runs/RunDetailInfoCards';
import { RunDetailProgressCard } from '../components/runs/RunDetailProgressCard';
import { RunDetailStepsTimeline } from '../components/runs/RunDetailStepsTimeline';
import { RunDetailSummaryView } from '../components/runs/RunDetailSummaryView';
import RoleAccessNotice from '../components/ui/RoleAccessNotice';
import Spinner from '../components/ui/Spinner';
import { useCancelRun, useRun, useRunArtifacts, useRunSteps } from '../hooks/useRuns';
import { buildRunArtifactStepKey } from '../lib/run-artifacts';
import { canManageRuns, getRoleLabel } from '../lib/role-access';
import { useAuthStore } from '../stores/auth';
import { useUIStore } from '../stores/ui';
import { runDetailStatusColor } from '../components/runs/run-detail-status';

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: run, isLoading } = useRun(id ?? '');
  const { data: steps } = useRunSteps(id ?? '');
  const { data: artifacts } = useRunArtifacts(id ?? '');
  const cancelRun = useCancelRun();
  const profile = useAuthStore((s) => s.profile);
  const addToast = useUIStore((s) => s.addToast);
  const canCancelRun = canManageRuns(profile?.role);
  const focusStepId = searchParams.get('stepId');

  const clearStepFocus = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('stepId');
    setSearchParams(next, { replace: true });
  };

  const handleCancel = async () => {
    if (!id) return;
    if (!canCancelRun) {
      addToast('Only operators and admins can cancel runs', 'error');
      return;
    }
    try {
      const result = await cancelRun.mutateAsync(id);
      if (result.status === 'CANCELLED') {
        addToast('Run cancelled', 'success');
      } else {
        addToast(`Run is already ${result.status.toLowerCase()}`, 'info');
      }
    } catch {
      addToast('Failed to cancel run', 'error');
    }
  };

  const stepStats = useMemo(() => {
    if (!steps?.length) return null;
    const total = steps.length;
    const done = steps.filter((s) => ['SUCCESS', 'FAILED', 'SKIPPED', 'CANCELLED'].includes(s.status)).length;
    const success = steps.filter((s) => s.status === 'SUCCESS').length;
    const failed = steps.filter((s) => s.status === 'FAILED').length;
    return { total, done, success, failed, percent: Math.round((done / total) * 100) };
  }, [steps]);

  const artifactCountsByStepKey = useMemo(() => {
    return (artifacts ?? []).reduce<Map<string, number>>((counts, artifact) => {
      const metadata = artifact.metadata_json ?? {};
      const stepId = typeof metadata.stepId === 'string' ? metadata.stepId : null;
      const key = buildRunArtifactStepKey(artifact.device_id, stepId);
      if (!key) return counts;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts;
    }, new Map());
  }, [artifacts]);

  if (isLoading) {
    return <div className="flex items-center justify-center flex-1"><Spinner size="lg" /></div>;
  }

  if (!run) {
    return <div className="flex items-center justify-center flex-1 text-gray-500">Run not found</div>;
  }

  const isRunning = ['RUNNING', 'PENDING', 'QUEUED', 'WAITING_APPROVAL'].includes(run.status);
  const barColor = runDetailStatusColor[run.status] ?? 'bg-gray-400';

  return (
    <>
      <RunDetailHeader
        cancelPending={cancelRun.isPending}
        canCancelRun={canCancelRun}
        isRunning={isRunning}
        runId={run.id}
        status={run.status}
        onBack={() => navigate('/runs')}
        onCancel={handleCancel}
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {focusStepId && <RunDetailFocusBanner focusStepId={focusStepId} onClear={clearStepFocus} />}
          {isRunning && !canCancelRun && (
            <RoleAccessNotice
              title={`${getRoleLabel(profile?.role)} role is read-only for active runs`}
              detail="You can inspect live progress and evidence, but only operators and admins can cancel or intervene in an active run."
            />
          )}
          {stepStats && <RunDetailProgressCard barColor={barColor} isRunning={isRunning} stepStats={stepStats} />}
          <RunDetailInfoCards isRunning={isRunning} run={run} />
          <RunDetailStepsTimeline
            artifactCountsByStepKey={artifactCountsByStepKey}
            focusStepId={focusStepId}
            isRunning={isRunning}
            steps={steps}
          />
          {artifacts && artifacts.length > 0 && steps && (
            <RunArtifactsPanel artifacts={artifacts} steps={steps} focusStepId={focusStepId} />
          )}
          {run.summary_json && Object.keys(run.summary_json).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Run Summary</h3>
              </div>
              <div className="p-5">
                <RunDetailSummaryView summary={run.summary_json} />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
