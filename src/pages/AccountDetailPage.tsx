import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, AlertCircle, RefreshCw, BarChart2 } from 'lucide-react';
import Header from '../components/layout/Header';
import { useAccount } from '../hooks/use-accounts';
import AccountActionHistoryPanel from '../components/accounts/account-action-history-panel';
import { WarmUpAdvancementPanel } from '../components/accounts/warmup-progression-panel';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import { getAdvancementEstimates } from '../lib/account-warmup-auto-advance';

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: account, isLoading: isLoadingAccount } = useAccount(id!);

  if (isLoadingAccount) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!account) {
    return (
      <EmptyState
        icon={<Users className="w-6 h-6" />}
        title="Account not found"
        description="The account you're looking for doesn't exist or has been deleted."
        action={
          <button
            onClick={() => navigate('/accounts')}
            className="text-sm font-medium text-sky-500 hover:text-sky-600"
          >
            <ArrowLeft className="w-4 h-4 mr-2 inline" />
            Back to Accounts
          </button>
        }
      />
    );
  }

  // Calculate the estimate for the single account if it's warming up
  const estimates = account.warm_up_stage < 5 && account.warm_up_started_at
    ? getAdvancementEstimates([account])
    : [];

  return (
    <>
      <Header
        title={account.username}
        subtitle={account.platform}
        actions={
          <>
            <button
              onClick={() => navigate('/accounts')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          <div className="flex items-center gap-2">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
              account.is_blocked 
                ? 'bg-red-100 text-red-700' 
                : account.warm_up_stage < 5 
                ? 'bg-amber-100 text-amber-700' 
                : 'bg-emerald-100 text-emerald-700'
            }`}>
              {account.is_blocked ? 'Blocked' : account.warm_up_stage < 5 ? 'Warming Up' : 'Active'}
            </span>
          </div>
          </>
        }
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {account.is_blocked && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Account Blocked</h3>
              <p className="text-sm text-red-700 mt-1">
                Reason: {account.detected_block_reason || 'Unknown block reason detected.'}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <BarChart2 className="w-5 h-5 text-gray-500" />
                Action Limits
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-sm font-medium text-gray-500">Daily Limit</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{account.daily_action_limit}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-sm font-medium text-gray-500">Actions Today</p>
                  <div className="flex items-end gap-2 mt-1">
                    <p className="text-2xl font-bold text-gray-900">{account.current_action_count}</p>
                    <p className="text-sm text-gray-500 mb-1">
                      / {account.daily_action_limit}
                    </p>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                    <div 
                      className={`h-1.5 rounded-full ${account.current_action_count >= account.daily_action_limit ? 'bg-red-500' : 'bg-sky-500'}`} 
                      style={{ width: `${Math.min((account.current_action_count / account.daily_action_limit) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <RefreshCw className="w-5 h-5 text-gray-500" />
                Recent Actions
              </h2>
              <div className="border border-gray-100 rounded-lg">
                  <AccountActionHistoryPanel accountId={account.id} accountLabel={account.username} open={true} onClose={() => {}} />
              </div>
            </div>
          </div>

          <div className="space-y-6">
             {account.warm_up_stage < 5 && !account.is_blocked && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Warm-up Status</h2>
                <WarmUpAdvancementPanel 
                    readyAccounts={[]} 
                    estimates={estimates as any} 
                    onAdvance={() => {}} 
                    isAdvancing={false} 
                />
                </div>
             )}
          </div>
        </div>
      </div>
    </>
  );
}
