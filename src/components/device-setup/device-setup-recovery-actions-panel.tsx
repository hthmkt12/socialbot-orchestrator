import { useState } from 'react';
import { Check, Copy, Power, RefreshCw, ShieldAlert, Smartphone, Sun } from 'lucide-react';
import type { Device, DeviceLock } from '../../lib/database.types';
import { requestDeviceRecovery } from '../../lib/mobile-mcp-orchestrator';
import Badge from '../ui/Badge';
import Spinner from '../ui/Spinner';
import {
  RecoveryActionCard,
} from './device-setup-cards';
import { formatTimestamp } from './device-setup-formatters';

export function RecoveryActionsPanel({
  activeLocks,
  canForceClearLocks,
  canManageLocks,
  checkedAt,
  cleanupExpiredLocksLoading,
  devices,
  deviceLocksError,
  expiredLockCount,
  forceClearLockId,
  loading,
  onCleanupExpiredLocks,
  onForceClearDeviceLock,
  onPrepareReconnect,
  onRecheck,
  profileRole,
  selectedDeviceLabel,
  selectedDeviceSerial,
  workerBaseUrl,
}: {
  activeLocks: DeviceLock[];
  canForceClearLocks: boolean;
  canManageLocks: boolean;
  checkedAt: string | null;
  cleanupExpiredLocksLoading: boolean;
  devices: Device[];
  deviceLocksError: string | null;
  expiredLockCount: number;
  forceClearLockId: string | null;
  loading: boolean;
  onCleanupExpiredLocks: () => void;
  onForceClearDeviceLock: (lockId: string) => void;
  onPrepareReconnect: () => void;
  onRecheck: () => void;
  profileRole: string | undefined;
  selectedDeviceLabel: string | null;
  selectedDeviceSerial?: string;
  workerBaseUrl?: string;
}) {
  const hasProfile = profileRole !== undefined;
  const isOperatorOrAdmin = profileRole === 'ADMIN' || profileRole === 'OPERATOR';
  const deviceNameById = new Map(devices.map((device) => [device.id, device.name || device.laixi_device_id]));

  const [hardwareActionLoading, setHardwareActionLoading] = useState<string | null>(null);
  const [hardwareActionResult, setHardwareActionResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleDeviceHardwareRecovery = async (
    action: 'restart_adb' | 'wake_screen' | 'reboot_device'
  ) => {
    setHardwareActionLoading(action);
    setHardwareActionResult(null);
    try {
      const res = await requestDeviceRecovery(action, selectedDeviceSerial, workerBaseUrl);
      setHardwareActionResult({
        success: res.success,
        message: res.message,
      });
      if (res.success) {
        onRecheck();
      }
    } catch (err) {
      setHardwareActionResult({
        success: false,
        message: err instanceof Error ? err.message : 'Hardware recovery action failed',
      });
    } finally {
      setHardwareActionLoading(null);
    }
  };

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

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h5 className="text-sm font-semibold text-amber-950">Admin stuck-lock cleanup</h5>
            <p className="text-xs text-amber-800 mt-1">
              Force clear a visible active lock only when the owning run is known to be stuck.
            </p>
          </div>
          <Badge variant={activeLocks.length > 0 ? 'yellow' : 'gray'}>
            {activeLocks.length} active
          </Badge>
        </div>

        {activeLocks.length === 0 ? (
          <p className="text-xs text-amber-800">No active lock rows are visible right now.</p>
        ) : (
          <div className="space-y-2">
            {activeLocks.map((lock) => {
              const deviceLabel = deviceNameById.get(lock.device_id) ?? lock.device_id;
              const isClearing = forceClearLockId === lock.id;
              return (
                <div
                  key={lock.id}
                  className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 rounded-lg border border-amber-200 bg-white p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{deviceLabel}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Run {lock.workflow_run_id} - expires {formatTimestamp(lock.expires_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => onForceClearDeviceLock(lock.id)}
                    disabled={isClearing || deviceLocksError !== null || !hasProfile || !canForceClearLocks}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                  >
                    {isClearing ? <Spinner size="sm" /> : <ShieldAlert className="w-4 h-4" />}
                    Force clear
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {!canForceClearLocks && (
          <p className="text-xs text-amber-800">
            Role {profileRole ?? 'unknown'} can inspect lock state, but only admins can force clear active locks.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h5 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-sky-600" />
              Device Hardware & ADB Recovery
            </h5>
            <p className="text-xs text-gray-600 mt-1">
              Direct recovery actions on ADB daemon and attached Android devices without accessing the host terminal.
            </p>
          </div>
          <Badge variant={isOperatorOrAdmin ? 'blue' : 'gray'}>
            {isOperatorOrAdmin ? 'Operator action' : 'Read-only'}
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <button
            onClick={() => handleDeviceHardwareRecovery('restart_adb')}
            disabled={hardwareActionLoading !== null || !isOperatorOrAdmin}
            className="inline-flex flex-col items-start gap-1 p-3 rounded-lg border border-sky-200 bg-white hover:bg-sky-50 disabled:opacity-50 text-left transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
              {hardwareActionLoading === 'restart_adb' ? (
                <Spinner size="sm" />
              ) : (
                <RefreshCw className="w-4 h-4 text-sky-500" />
              )}
              Restart ADB
            </div>
            <span className="text-[11px] text-gray-500">
              Kill & restart host ADB server to recover hanging USB bus.
            </span>
          </button>

          <button
            onClick={() => handleDeviceHardwareRecovery('wake_screen')}
            disabled={hardwareActionLoading !== null || !isOperatorOrAdmin || !selectedDeviceSerial}
            className="inline-flex flex-col items-start gap-1 p-3 rounded-lg border border-sky-200 bg-white hover:bg-sky-50 disabled:opacity-50 text-left transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
              {hardwareActionLoading === 'wake_screen' ? (
                <Spinner size="sm" />
              ) : (
                <Sun className="w-4 h-4 text-amber-500" />
              )}
              Wake & Unlock Screen
            </div>
            <span className="text-[11px] text-gray-500">
              {selectedDeviceSerial
                ? `Send KEYCODE_WAKEUP & unlock to ${selectedDeviceSerial}.`
                : 'Select a device above to wake.'}
            </span>
          </button>

          <button
            onClick={() => handleDeviceHardwareRecovery('reboot_device')}
            disabled={hardwareActionLoading !== null || !isOperatorOrAdmin || !selectedDeviceSerial}
            className="inline-flex flex-col items-start gap-1 p-3 rounded-lg border border-red-200 bg-white hover:bg-red-50 disabled:opacity-50 text-left transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-red-700">
              {hardwareActionLoading === 'reboot_device' ? (
                <Spinner size="sm" />
              ) : (
                <Power className="w-4 h-4 text-red-500" />
              )}
              Quick-Reboot Device
            </div>
            <span className="text-[11px] text-gray-500">
              {selectedDeviceSerial
                ? `Soft reboot ${selectedDeviceSerial} via ADB command.`
                : 'Select a device above to reboot.'}
            </span>
          </button>
        </div>

        {hardwareActionResult && (
          <div
            className={`p-2.5 rounded-lg text-xs font-mono whitespace-pre-wrap ${
              hardwareActionResult.success
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {hardwareActionResult.message}
          </div>
        )}
      </div>
    </div>
  );
}
