import type { Account, AccountPlatform } from '../../lib/database.types';
import Badge from '../ui/Badge';
import { Trash2, Play } from 'lucide-react';
import {
  computeRecommendedStage,
  getStageInfo,
  canPerformAction,
  daysInWarmUp,
} from '../../lib/account-warmup-engine';

const platformBadge: Record<AccountPlatform, { label: string; variant: 'blue' | 'red' | 'teal' }> = {
  instagram: { label: 'Instagram', variant: 'red' },
  tiktok: { label: 'TikTok', variant: 'teal' },
  facebook: { label: 'Facebook', variant: 'blue' },
};

interface AccountTableProps {
  accounts: Account[];
  onDelete: (id: string) => void;
  onStartWarmUp?: (id: string) => void;
  isDeleting: boolean;
}

export function AccountTable({ accounts, onDelete, onStartWarmUp, isDeleting }: AccountTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left">
            <th className="px-4 py-3 font-medium text-gray-500">Username</th>
            <th className="px-4 py-3 font-medium text-gray-500">Platform</th>
            <th className="px-4 py-3 font-medium text-gray-500">Warm-Up</th>
            <th className="px-4 py-3 font-medium text-gray-500">Actions Today</th>
            <th className="px-4 py-3 font-medium text-gray-500">Limit</th>
            <th className="px-4 py-3 font-medium text-gray-500">Status</th>
            <th className="px-4 py-3 font-medium text-gray-500" />
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => {
            const platform = platformBadge[account.platform] ?? platformBadge.instagram;
            const stageInfo = getStageInfo(account.platform, account.warm_up_stage);
            const recommendedStage = computeRecommendedStage(account);
            const actionCheck = canPerformAction(account);
            const days = daysInWarmUp(account.warm_up_started_at);
            const canAdvance = recommendedStage > account.warm_up_stage;

            return (
              <tr key={account.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{account.username}</td>
                <td className="px-4 py-3">
                  <Badge variant={platform.variant}>{platform.label}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">{stageInfo.label}</span>
                    {account.warm_up_stage === 1 && onStartWarmUp && (
                      <button
                        onClick={() => onStartWarmUp(account.id)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-sky-600 bg-sky-50 hover:bg-sky-100 transition-colors"
                        title="Start warm-up"
                      >
                        <Play className="w-3 h-3" />
                        Start
                      </button>
                    )}
                    {canAdvance && account.warm_up_stage > 1 && (
                      <span className="text-xs text-amber-600" title={`Ready for stage ${recommendedStage} (${days}d elapsed)`}>
                        ↑ ready
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={actionCheck.allowed ? 'text-gray-600' : 'text-red-500'}>
                    {account.current_action_count}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{account.daily_action_limit}</td>
                <td className="px-4 py-3">
                  {account.is_blocked ? (
                    <Badge variant="red">Blocked</Badge>
                  ) : !actionCheck.allowed ? (
                    <Badge variant="yellow">{actionCheck.reason}</Badge>
                  ) : (
                    <Badge variant="green">Active</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => onDelete(account.id)}
                    disabled={isDeleting}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                    title="Delete account"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
