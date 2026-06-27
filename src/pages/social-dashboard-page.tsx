import { useState } from 'react';
import { BarChart3, Users, Activity, AlertTriangle, TrendingUp, Sparkles } from 'lucide-react';
import { useAccounts, useUpdateAccount } from '../hooks/use-accounts';
import { useUIStore } from '../stores/ui';
import { useWarmUpAdvancementState, useAdvanceAccounts } from '../hooks/use-warmup-auto-advance';
import Header from '../components/layout/Header';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import Badge from '../components/ui/Badge';
import { WarmUpAdvancementPanel } from '../components/accounts/warmup-progression-panel';
import AccountActionHistoryPanel from '../components/accounts/account-action-history-panel';
import {
  getStageInfo,
  computeRecommendedStage,
  canPerformAction,
  daysInWarmUp,
} from '../lib/account-warmup-engine';
import { getAccountBudgets } from '../lib/action-budget-enforcer';
import { ACTION_TYPE_LABELS } from '../lib/action-budget-types';
import type { Account, AccountActionType } from '../lib/database.types';
import type { AdvancementResult } from '../lib/account-warmup-auto-advance';


function StatCard({ icon: Icon, label, value, color }: {
  icon: typeof BarChart3;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-lg ${color} flex items-center justify-center`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
      </div>
    </div>
  );
}

function AccountHealthCard({ account, onStartWarmUp, onShowHistory }: {
  account: Account;
  onStartWarmUp: (id: string) => void;
  onShowHistory: (id: string) => void;
}) {
  const stageInfo = getStageInfo(account.platform, account.warm_up_stage);
  const recommendedStage = computeRecommendedStage(account);
  const actionCheck = canPerformAction(account);
  const days = daysInWarmUp(account.warm_up_started_at);
  const canAdvance = recommendedStage > account.warm_up_stage;
  const usagePct = Math.min(100, Math.round((account.current_action_count / account.daily_action_limit) * 100));
  const budgets = getAccountBudgets(account);

  return (
    <div
      className={`rounded-xl border p-5 bg-white transition-all hover:shadow-sm cursor-pointer ${
        account.is_blocked ? 'border-red-200' : usagePct >= 80 ? 'border-amber-200' : 'border-gray-200'
      }`}
      onClick={() => onShowHistory(account.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onShowHistory(account.id); }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white ${
            account.platform === 'instagram'
              ? 'bg-gradient-to-br from-purple-500 to-orange-400'
              : account.platform === 'tiktok'
              ? 'bg-black'
              : 'bg-blue-600'
          }`}>
            {account.platform === 'instagram' ? 'IG' : account.platform === 'tiktok' ? 'TT' : 'FB'}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{account.username}</p>
            <p className="text-[11px] text-gray-500 capitalize">{account.platform}</p>
          </div>
        </div>
        <Badge variant={account.is_blocked ? 'red' : actionCheck.allowed ? 'green' : 'yellow'}>
          {account.is_blocked ? 'Blocked' : actionCheck.allowed ? 'Active' : 'Limit Reached'}
        </Badge>
      </div>

      {/* Warm-up stage */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-medium text-gray-700">{stageInfo.label}</span>
          {canAdvance && <span className="text-amber-600 font-medium">↑ Ready for Stage {recommendedStage}</span>}
          {!canAdvance && account.warm_up_stage > 1 && <span className="text-gray-400">{days}d in warm-up</span>}
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              account.warm_up_stage >= 5 ? 'bg-emerald-500'
                : account.warm_up_stage >= 3 ? 'bg-sky-500'
                : 'bg-amber-400'
            }`}
            style={{ width: `${((account.warm_up_stage - 1) / 4) * 100}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-4 text-center">
        <div>
          <p className="text-lg font-bold text-gray-900">{account.current_action_count}</p>
          <p className="text-[10px] text-gray-500 font-medium">Actions Today</p>
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900">{account.daily_action_limit}</p>
          <p className="text-[10px] text-gray-500 font-medium">Daily Limit</p>
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900">{usagePct}%</p>
          <p className="text-[10px] text-gray-500 font-medium">Usage</p>
        </div>
      </div>

      {/* Per-type budget breakdown */}
      <div className="flex flex-wrap gap-1 mb-3">
        {(Object.keys(budgets) as AccountActionType[]).map((type) => {
          const bgt = budgets[type];
          return (
            <span key={type} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
              <span className="font-semibold">{ACTION_TYPE_LABELS[type]}</span>
              {bgt.daily}
            </span>
          );
        })}
      </div>

      {/* Usage bar */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-4">
        <div
          className={`h-full rounded-full transition-all ${
            usagePct >= 90 ? 'bg-red-400' : usagePct >= 60 ? 'bg-amber-400' : 'bg-emerald-400'
          }`}
          style={{ width: `${usagePct}%` }}
        />
      </div>

      {/* Actions */}
      {account.warm_up_stage === 1 && !account.is_blocked && (
        <button
          onClick={(e) => { e.stopPropagation(); onStartWarmUp(account.id); }}
          className="w-full text-center py-2 text-xs font-medium text-sky-600 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors"
        >
          Start Warm-Up
        </button>
      )}
    </div>
  );
}

export default function SocialDashboardPage() {
  const { data: accounts, isLoading } = useAccounts();
  const updateAccount = useUpdateAccount();
  const addToast = useUIStore((s) => s.addToast);

  const { readyAccounts, estimates, warmingUpCount, fullSpeedCount } =
    useWarmUpAdvancementState(accounts ?? []);
  const advanceAccounts = useAdvanceAccounts();

  const [historyAccountId, setHistoryAccountId] = useState<string | null>(null);
  const historyAccount = accounts?.find((a) => a.id === historyAccountId);

  const handleStartWarmUp = async (id: string) => {
    try {
      await updateAccount.mutateAsync({
        id,
        warm_up_stage: 2,
        warm_up_started_at: new Date().toISOString(),
      });
      addToast('Warm-up started', 'success');
    } catch {
      addToast('Failed to start warm-up', 'error');
    }
  };

  const handleAdvanceWarmUp = async (candidates: AdvancementResult[]) => {
    try {
      const results = await advanceAccounts.mutateAsync(candidates);
      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      if (succeeded > 0) addToast(`Advanced ${succeeded} account${succeeded !== 1 ? 's' : ''}`, 'success');
      if (failed > 0) addToast(`Failed to advance ${failed} account${failed !== 1 ? 's' : ''}`, 'error');
    } catch {
      addToast('Failed to advance accounts', 'error');
    }
  };

  const activeAccounts = (accounts ?? []).filter((a) => !a.is_blocked);
  const blockedAccounts = (accounts ?? []).filter((a) => a.is_blocked);
  const totalActions = (accounts ?? []).reduce((sum, a) => sum + a.current_action_count, 0);

  return (
    <>
      <Header
        title="Social Dashboard"
        subtitle="Account health, warm-up status, and activity at a glance"
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : !accounts?.length ? (
          <EmptyState
            icon={<Users className="w-6 h-6" />}
            title="No accounts yet"
            description="Add social media accounts in Account Setup to see your dashboard."
          />
        ) : (
          <>
            {/* Stats cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard icon={Users} label="Total Accounts" value={accounts.length} color="bg-sky-500" />
              <StatCard icon={Activity} label="Active Accounts" value={activeAccounts.length} color="bg-emerald-500" />
              <StatCard icon={BarChart3} label="Actions Today" value={totalActions} color="bg-indigo-500" />
              <StatCard icon={TrendingUp} label="Full Speed" value={fullSpeedCount} color="bg-violet-500" />
            </div>

            {/* Blocked warning */}
            {blockedAccounts.length > 0 && (
              <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                <span className="text-red-700">{blockedAccounts.length} account{blockedAccounts.length !== 1 ? 's' : ''} blocked. Check Account Setup for details.</span>
              </div>
            )}

            {/* Warm-up auto-advancement */}
            {(readyAccounts.length > 0 || (warmingUpCount > 0 && estimates.length > 0)) && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <h2 className="text-sm font-semibold text-gray-900">Warm-Up Progression</h2>
                </div>
                <WarmUpAdvancementPanel
                  readyAccounts={readyAccounts}
                  estimates={estimates}
                  onAdvance={handleAdvanceWarmUp}
                  isAdvancing={advanceAccounts.isPending}
                />
              </div>
            )}

            {/* Account health cards */}
            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Account Health</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.map((account) => (
                  <AccountHealthCard
                    key={account.id}
                    account={account}
                    onStartWarmUp={handleStartWarmUp}
                    onShowHistory={setHistoryAccountId}
                  />
                ))}
              </div>
            </div>

            {/* Action history modal */}
            <AccountActionHistoryPanel
              accountId={historyAccountId ?? ''}
              accountLabel={historyAccount ? `${historyAccount.username} (${historyAccount.platform})` : ''}
              open={!!historyAccountId}
              onClose={() => setHistoryAccountId(null)}
            />
          </>
        )}
      </div>
    </>
  );
}
