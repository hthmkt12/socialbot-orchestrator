import { Clock, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import { useAccountHistory } from '../../hooks/use-accounts';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';
import Spinner from '../ui/Spinner';
import EmptyState from '../ui/EmptyState';
import type { AccountActionType } from '../../lib/database.types';

const actionTypeLabels: Record<AccountActionType, string> = {
  like: 'Like',
  follow: 'Follow',
  comment: 'Comment',
  post: 'Post',
  share: 'Share',
};

const actionTypeColors: Record<AccountActionType, 'green' | 'blue' | 'orange' | 'teal' | 'gray'> = {
  like: 'green',
  follow: 'blue',
  comment: 'orange',
  post: 'teal',
  share: 'gray',
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AccountActionHistoryPanel({
  accountId,
  accountLabel,
  open,
  onClose,
}: {
  accountId: string;
  accountLabel: string;
  open: boolean;
  onClose: () => void;
}) {
  const { data: actions, isLoading } = useAccountHistory(accountId);

  return (
    <Modal open={open} onClose={onClose} title={`Action History: ${accountLabel}`} maxWidth="max-w-xl">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : !actions?.length ? (
        <EmptyState
          icon={<Clock className="w-6 h-6" />}
          title="No actions recorded"
          description="Actions will appear here once the account starts performing social engagement tasks."
        />
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 font-medium mb-3">
            {actions.length} action{actions.length !== 1 ? 's' : ''} recorded
          </p>
          <div className="space-y-1">
            {actions.map((action) => (
              <div
                key={action.id}
                className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-2.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {action.success === true ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : action.success === false ? (
                    <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                  ) : (
                    <HelpCircle className="w-4 h-4 text-gray-400 shrink-0" />
                  )}
                  <Badge variant={actionTypeColors[action.action_type] ?? 'gray'}>
                    {actionTypeLabels[action.action_type] ?? action.action_type}
                  </Badge>
                  {action.step_id && (
                    <span className="text-[11px] text-gray-400 font-mono truncate" title={action.step_id}>
                      step:{action.step_id.slice(0, 8)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-gray-400">{formatTimestamp(action.created_at)}</span>
                  {action.error_message && (
                    <span className="text-[10px] text-red-500 max-w-[160px] truncate" title={action.error_message}>
                      {action.error_message}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
