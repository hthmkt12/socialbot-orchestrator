import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import Header from '../components/layout/Header';
import RoleAccessNotice from '../components/ui/RoleAccessNotice';
import { useRuns } from '../hooks/useRuns';
import RunWizard from '../components/runs/RunWizard';
import RunsFilterBar from '../components/runs/RunsFilterBar';
import RunsList from '../components/runs/RunsList';
import RunsSummaryStats from '../components/runs/RunsSummaryStats';
import { isLiveRunStatus } from '../components/runs/runs-page-status';
import type { FilterStatus } from '../components/runs/runs-page-types';
import { canManageRuns, getRoleLabel } from '../lib/role-access';
import type { WorkflowRun } from '../lib/database.types';
import { useAuthStore } from '../stores/auth';

export default function RunsPage() {
  const { data: runs, isLoading } = useRuns();
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const [showWizard, setShowWizard] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
  const canLaunchRuns = canManageRuns(profile?.role);

  const filtered = useMemo(() => {
    if (!runs) return [];
    return runs.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return r.id.toLowerCase().includes(q) || (r.target_type ?? '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [runs, search, statusFilter]);

  const stats = useMemo(() => {
    if (!runs) return { total: 0, running: 0, completed: 0, failed: 0 };
    return {
      total: runs.length,
      running: runs.filter((r) => ['RUNNING', 'PENDING', 'QUEUED'].includes(r.status)).length,
      completed: runs.filter((r) => r.status === 'COMPLETED').length,
      failed: runs.filter((r) => r.status === 'FAILED').length,
    };
  }, [runs]);

  const openRun = (run: WorkflowRun) => {
    navigate(isLiveRunStatus(run.status) ? `/runs/${run.id}/monitor` : `/runs/${run.id}`);
  };

  return (
    <>
      <Header
        title="Workflow Runs"
        subtitle={`${runs?.length ?? 0} total runs`}
        actions={
          <button
            onClick={() => {
              if (!canLaunchRuns) return;
              setShowWizard(true);
            }}
            disabled={!canLaunchRuns}
            className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Play className="w-4 h-4" /> New Run
          </button>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        {!canLaunchRuns && (
          <div className="mb-6">
            <RoleAccessNotice
              title={`${getRoleLabel(profile?.role)} role is read-only for run control`}
              detail="You can inspect existing runs, monitors, and evidence, but only operators and admins can launch or cancel runs."
            />
          </div>
        )}
        <RunsSummaryStats stats={stats} />
        <RunsFilterBar
          search={search}
          statusFilter={statusFilter}
          onSearchChange={setSearch}
          onStatusFilterChange={setStatusFilter}
        />
        <RunsList runs={runs} filteredRuns={filtered} isLoading={isLoading} onOpenRun={openRun} />
      </div>

      {showWizard && canLaunchRuns && <RunWizard onClose={() => setShowWizard(false)} />}
    </>
  );
}
