import Badge from '../ui/Badge';
import {
  getStageInfo,
  computeRecommendedStage,
  canPerformAction,
  daysInWarmUp,
} from '../../lib/account-warmup-engine';
import { getAccountBudgets } from '../../lib/action-budget-enforcer';
import { ACTION_TYPE_LABELS } from '../../lib/action-budget-types';
import type { Account, AccountActionType } from '../../lib/database.types';

interface AccountHealthCardProps {
  account: Account;
  onStartWarmUp: (id: string) => void;
  onShowHistory: (id: string) => void;
}

export function AccountHealthCard({ account, onStartWarmUp, onShowHistory }: AccountHealthCardProps) {
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
