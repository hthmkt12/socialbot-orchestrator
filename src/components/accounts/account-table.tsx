import type { Account, AccountPlatform } from '../../lib/database.types';
import Badge from '../ui/Badge';
import { Trash2 } from 'lucide-react';

const platformBadge: Record<AccountPlatform, { label: string; variant: 'blue' | 'red' | 'teal' }> = {
  instagram: { label: 'Instagram', variant: 'red' },
  tiktok: { label: 'TikTok', variant: 'teal' },
  facebook: { label: 'Facebook', variant: 'blue' },
};

const warmUpLabels: Record<number, string> = {
  1: 'Inactive',
  2: 'Day 1-3',
  3: 'Day 4-7',
  4: 'Ramping',
  5: 'Full Speed',
};

interface AccountTableProps {
  accounts: Account[];
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

export function AccountTable({ accounts, onDelete, isDeleting }: AccountTableProps) {
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
            return (
              <tr key={account.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{account.username}</td>
                <td className="px-4 py-3">
                  <Badge variant={platform.variant}>{platform.label}</Badge>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {warmUpLabels[account.warm_up_stage] ?? `Stage ${account.warm_up_stage}`}
                </td>
                <td className="px-4 py-3 text-gray-600">{account.current_action_count}</td>
                <td className="px-4 py-3 text-gray-600">{account.daily_action_limit}</td>
                <td className="px-4 py-3">
                  {account.is_blocked ? (
                    <Badge variant="red">Blocked</Badge>
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
