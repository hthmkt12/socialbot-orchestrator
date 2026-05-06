import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import RoleAccessNotice from '../components/ui/RoleAccessNotice';
import { ApprovalDialog } from '../components/runs/ApprovalDialog';
import { RunMonitorApprovalPanel } from '../components/runs/RunMonitorApprovalPanel';
import { RunMonitorDeviceList } from '../components/runs/RunMonitorDeviceList';
import { RunMonitorHeader } from '../components/runs/RunMonitorHeader';
import {
  RunMonitorLoadingState,
  RunMonitorNotFoundState,
} from '../components/runs/run-monitor-page-shell';
import { buildRunMonitorProgress } from '../components/runs/run-monitor-progress';
import { RunMonitorSummaryPanel } from '../components/runs/RunMonitorSummaryPanel';
import { useRunMonitorData } from '../components/runs/use-run-monitor-data';
import { requestRunCancel } from '../hooks/useRuns';
import { useAuthStore } from '../stores/auth';
import { canManageApprovals, canManageRuns, getRoleLabel } from '../lib/role-access';

export function RunMonitorPage() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [expandedDevice, setExpandedDevice] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const profile = useAuthStore((s) => s.profile);
  const canCancelRun = canManageRuns(profile?.role);
  const canResolveApproval = canManageApprovals(profile?.role);
  const {
    deviceStatuses,
    fetchRunData,
    loading,
    pendingApprovals,
    run,
    steps,
  } = useRunMonitorData(runId, autoRefresh);

  const handleCancelRun = async () => {
    if (!canCancelRun) return;
    if (!runId || !confirm('Are you sure you want to cancel this run?')) return;

    await requestRunCancel(runId);
    fetchRunData();
  };

  const toggleDeviceExpanded = (deviceId: string) => {
    setExpandedDevice(expandedDevice === deviceId ? null : deviceId);
  };

  const toggleStepExpanded = (stepId: string) => {
    setExpandedSteps(previous => {
      const newSet = new Set(previous);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  };

  if (loading) {
    return <RunMonitorLoadingState />;
  }

  if (!run) {
    return <RunMonitorNotFoundState onBack={() => navigate('/runs')} />;
  }

  const { completedSteps, failedSteps, progressPercent, totalSteps } =
    buildRunMonitorProgress(steps);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <RunMonitorHeader
          autoRefresh={autoRefresh}
          canCancelRun={canCancelRun}
          canResolveApproval={canResolveApproval}
          pendingApprovalCount={pendingApprovals.length}
          run={run}
          runId={runId}
          onBack={() => navigate('/runs')}
          onCancelRun={handleCancelRun}
          onOpenApproval={() => setShowApprovalDialog(true)}
          onToggleAutoRefresh={() => setAutoRefresh(!autoRefresh)}
        />

        {(!canCancelRun || (pendingApprovals.length > 0 && !canResolveApproval)) && (
          <div className="mb-6">
            <RoleAccessNotice
              title={`${getRoleLabel(profile?.role)} role is read-only for live run control`}
              detail="You can inspect live execution and open approval context, but only operators and admins can cancel runs or resolve approvals from this screen."
            />
          </div>
        )}

        {pendingApprovals.length > 0 && (
          <RunMonitorApprovalPanel
            approval={pendingApprovals[0]}
            canResolveApproval={canResolveApproval}
            pendingApprovalCount={pendingApprovals.length}
            onOpenApproval={() => setShowApprovalDialog(true)}
          />
        )}

        <RunMonitorSummaryPanel
          completedSteps={completedSteps}
          deviceStatuses={deviceStatuses}
          failedSteps={failedSteps}
          progressPercent={progressPercent}
          run={run}
          steps={steps}
          totalSteps={totalSteps}
        />

        <RunMonitorDeviceList
          deviceStatuses={deviceStatuses}
          expandedDevice={expandedDevice}
          expandedSteps={expandedSteps}
          onToggleDevice={toggleDeviceExpanded}
          onToggleStep={toggleStepExpanded}
        />

        {showApprovalDialog && pendingApprovals.length > 0 && (
          <ApprovalDialog
            approval={pendingApprovals[0]}
            readOnly={!canResolveApproval}
            onClose={() => setShowApprovalDialog(false)}
            onApproved={() => {
              fetchRunData();
            }}
            onRejected={() => {
              fetchRunData();
            }}
          />
        )}
      </div>
    </div>
  );
}
