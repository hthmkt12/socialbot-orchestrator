import { Check, Copy, RefreshCw } from 'lucide-react';
import Badge from '../ui/Badge';
import Spinner from '../ui/Spinner';
import {
  RecoveryActionCard,
} from './device-setup-cards';
import { formatTimestamp } from './device-setup-formatters';

export function RecoveryActionsPanel({
  canManageLocks,
  checkedAt,
  cleanupExpiredLocksLoading,
  deviceLocksError,
  expiredLockCount,
  loading,
  onCleanupExpiredLocks,
  onPrepareReconnect,
  onRecheck,
  profileRole,
  selectedDeviceLabel,
}: {
  canManageLocks: boolean;
  checkedAt: string | null;
  cleanupExpiredLocksLoading: boolean;
  deviceLocksError: string | null;
  expiredLockCount: number;
  loading: boolean;
  onCleanupExpiredLocks: () => void;
  onPrepareReconnect: () => void;
  onRecheck: () => void;
  profileRole: string | undefined;
  selectedDeviceLabel: string | null;
}) {
  const hasProfile = profileRole !== undefined;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h4 className="text-base font-semibold text-gray-900">Recovery actions</h4>
          <p className="text-xs text-gray-500 mt-1">
            Safe operator actions for recheck, reconnect prep, and stale-lock cleanup without opening the database directly.
          </p>
        </div>
        <Badge variant="blue">OPS-05</Badge>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <RecoveryActionCard
          title="Run full recheck"
          detail="Refresh gateway health, worker health, devices, and lock visibility from the current endpoints."
          hint={checkedAt ? `Last verification at ${formatTimestamp(checkedAt)}` : 'No verification timestamp yet'}
          tone={loading ? 'blue' : 'gray'}
        >
          <button
            onClick={onRecheck}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            {loading ? <Spinner size="sm" /> : <RefreshCw className="w-4 h-4" />}
            Recheck now
          </button>
        </RecoveryActionCard>

        <RecoveryActionCard
          title="Prepare selected device reconnect"
          detail="Copy the current AutoJS bootstrap and jump to Guide so the operator can relaunch the agent against the current gateway websocket URL."
          hint={selectedDeviceLabel ? `Target: ${selectedDeviceLabel}` : 'Select a device first to prepare reconnect'}
          tone={selectedDeviceLabel ? 'yellow' : 'gray'}
        >
          <button
            onClick={onPrepareReconnect}
            disabled={!selectedDeviceLabel}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            <Copy className="w-4 h-4" />
            Copy script + open guide
          </button>
        </RecoveryActionCard>

        <RecoveryActionCard
          title="Clean expired locks"
          detail="Delete only lock rows whose lease is already past `expires_at`. Active locks remain untouched."
          hint={
            deviceLocksError
              ? 'Lock visibility failed, so cleanup is disabled'
              : !hasProfile
                ? 'Log in first to manage locks'
                : !canManageLocks
                  ? `Role ${profileRole} is read-only for lock cleanup`
                  : expiredLockCount > 0
                    ? `${expiredLockCount} expired lock(s) ready for cleanup`
                    : 'No expired locks detected right now'
          }
          tone={deviceLocksError ? 'gray' : expiredLockCount > 0 ? 'blue' : 'green'}
        >
          <button
            onClick={onCleanupExpiredLocks}
            disabled={cleanupExpiredLocksLoading || deviceLocksError !== null || !hasProfile || !canManageLocks || expiredLockCount === 0}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            {cleanupExpiredLocksLoading ? <Spinner size="sm" /> : <Check className="w-4 h-4" />}
            Clear expired locks
          </button>
        </RecoveryActionCard>
      </div>
    </div>
  );
}
