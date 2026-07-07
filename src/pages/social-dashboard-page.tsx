import { useState } from 'react';
import { BarChart3, Users, Activity, AlertTriangle, TrendingUp, Sparkles } from 'lucide-react';
import { useAccounts, useUpdateAccount } from '../hooks/use-accounts';
import { useUIStore } from '../stores/ui';
import { useWarmUpAdvancementState, useAdvanceAccounts } from '../hooks/use-warmup-auto-advance';
import Header from '../components/layout/Header';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import { WarmUpAdvancementPanel } from '../components/accounts/warmup-progression-panel';
import AccountActionHistoryPanel from '../components/accounts/account-action-history-panel';
import { StatCard } from '../components/social-dashboard/StatCard';
import { AccountHealthCard } from '../components/social-dashboard/AccountHealthCard';
import type { AdvancementResult } from '../lib/account-warmup-auto-advance';

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
            description="Add social media accounts in Accounts to see your dashboard."
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
                <span className="text-red-700">{blockedAccounts.length} account{blockedAccounts.length !== 1 ? 's' : ''} blocked. Check Accounts for details.</span>
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
