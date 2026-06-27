import { ChevronRight, TrendingUp, Calendar } from 'lucide-react';
import Badge from '../ui/Badge';
import Spinner from '../ui/Spinner';
import type { AdvancementResult, NextAdvancementEstimate } from '../../lib/account-warmup-auto-advance';

function platformColor(platform: string) {
  switch (platform) {
    case 'instagram': return 'from-purple-500 to-orange-400';
    case 'tiktok': return 'bg-black text-white';
    case 'facebook': return 'bg-blue-600';
    default: return 'bg-gray-500';
  }
}

function platformInitial(platform: string) {
  switch (platform) {
    case 'instagram': return 'IG';
    case 'tiktok': return 'TT';
    case 'facebook': return 'FB';
    default: return '??';
  }
}

function stageBadgeVariant(stage: number): 'yellow' | 'green' | 'blue' | 'red' {
  if (stage >= 5) return 'green';
  if (stage >= 3) return 'blue';
  return 'yellow';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return 'Tomorrow';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays <= 7) return `In ${diffDays} days`;
  return d.toLocaleDateString();
}

export function WarmUpAdvancementPanel({
  readyAccounts,
  estimates,
  onAdvance,
  isAdvancing,
}: {
  readyAccounts: AdvancementResult[];
  estimates: NextAdvancementEstimate[];
  onAdvance: (accounts: AdvancementResult[]) => void;
  isAdvancing: boolean;
}) {
  if (!readyAccounts.length && !estimates.length) return null;

  return (
    <div className="space-y-4">
      {/* Ready to advance section */}
      {readyAccounts.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              <h3 className="text-sm font-semibold text-gray-900">
                Ready to Advance ({readyAccounts.length})
              </h3>
            </div>
            <button
              onClick={() => onAdvance(readyAccounts)}
              disabled={isAdvancing}
              className="px-4 py-1.5 text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-1.5"
            >
              {isAdvancing ? <Spinner size="sm" /> : null}
              Advance All
            </button>
          </div>

          <div className="space-y-2">
            {readyAccounts.map((account) => (
              <div
                key={account.accountId}
                className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${platformColor(account.platform)}`}>
                    {platformInitial(account.platform)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{account.username}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-gray-500 capitalize">{account.platform}</span>
                      <ChevronRight className="w-3 h-3 text-gray-400" />
                      <Badge variant={stageBadgeVariant(account.currentStage)}>
                        Stage {account.currentStage}
                      </Badge>
                      <ChevronRight className="w-3 h-3 text-emerald-500" />
                      <Badge variant="green">Stage {account.targetStage}</Badge>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onAdvance([account])}
                  disabled={isAdvancing}
                  className="px-3 py-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  {isAdvancing ? '...' : 'Advance'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Advancement timeline */}
      {estimates.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">Upcoming Advancements</h3>
          </div>

          <div className="space-y-2">
            {estimates.map((est) => (
              <div
                key={est.accountId}
                className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${platformColor(est.platform)}`}>
                    {platformInitial(est.platform)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{est.username}</p>
                    <p className="text-[11px] text-gray-500">
                      Stage {est.currentStage} → {est.nextLabel}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-gray-700">
                    {est.daysRemaining === 0
                      ? 'Any day now'
                      : formatDate(est.estimatedDate!)}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {est.daysElapsed}d elapsed / {est.daysRequired}d needed
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
