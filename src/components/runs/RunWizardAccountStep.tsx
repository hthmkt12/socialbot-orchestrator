import { Smartphone } from 'lucide-react';
import { useAccounts } from '../../hooks/use-accounts';
import { canPerformAction } from '../../lib/account-warmup-engine';
import type { Account } from '../../lib/database.types';
import Spinner from '../ui/Spinner';

interface Props {
  selectedAccountId: string;
  onSelectAccount: (id: string) => void;
}

export function RunWizardAccountStep({ selectedAccountId, onSelectAccount }: Props) {
  const { data: accounts, isLoading } = useAccounts();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const socialAccounts = accounts ?? [];

  if (socialAccounts.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <Smartphone className="w-8 h-8 text-gray-300 mx-auto" />
        <p className="text-sm text-gray-500">No active social accounts found.</p>
        <p className="text-xs text-gray-400">
          Add accounts in <span className="font-medium">Accounts</span> before running social engagement macros.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Choose the social media account to use for this engagement run.
      </p>
      <div className="grid gap-3">
        {socialAccounts.map((account: Account) => {
          const selected = selectedAccountId === account.id;
          const actionCheck = canPerformAction(account);
          const disabled = !actionCheck.allowed;
          return (
            <button
              key={account.id}
              type="button"
              onClick={() => {
                if (!disabled) onSelectAccount(account.id);
              }}
              disabled={disabled}
              className={`flex items-center gap-4 rounded-xl border p-4 text-left transition-all ${
                selected
                  ? 'border-sky-300 bg-sky-50 ring-1 ring-sky-300'
                  : disabled
                    ? 'border-gray-200 bg-gray-50 opacity-70 cursor-not-allowed'
                    : 'border-gray-200 hover:border-sky-200 hover:bg-gray-50'
              }`}
            >
              {/* Platform icon */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                account.platform === 'instagram'
                  ? 'bg-gradient-to-br from-purple-500 to-orange-400 text-white'
                  : account.platform === 'tiktok'
                  ? 'bg-black text-white'
                  : 'bg-blue-600 text-white'
              }`}>
                {account.platform === 'instagram' ? 'IG' : account.platform === 'tiktok' ? 'TT' : 'FB'}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{account.username}</p>
                <p className="text-xs text-gray-500 capitalize mt-0.5">
                  {account.platform}
                  {!actionCheck.allowed && <span className="text-red-600"> · {actionCheck.reason}</span>}
                </p>
              </div>

              {/* Warm-up badge */}
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${
                account.warm_up_stage < 3
                  ? 'bg-amber-100 text-amber-700'
                  : account.warm_up_stage < 5
                  ? 'bg-sky-100 text-sky-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}>
                Stage {account.warm_up_stage}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
