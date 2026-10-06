import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Gauge, Power, ShieldAlert, Smartphone, Sun, Trash2, Unlock, X } from 'lucide-react';
import Badge from '../ui/Badge';
import Spinner from '../ui/Spinner';
import { getDeviceHealthSummary } from '../../lib/device-health';
import { describeDeviceLockState, type DeviceLockState } from '../../lib/device-locks';
import {
  fetchDeviceGuardrailUsage,
  fetchDeviceQuarantineState,
  requestDeviceRecovery,
  requestLiftDeviceQuarantine,
  type DeviceGuardrailUsage,
  type DeviceQuarantineStatus,
} from '../../lib/mobile-mcp-orchestrator';
import type { Device } from '../../lib/database.types';
import DeviceLockBadge from './DeviceLockBadge';
import { DeviceBatteryIcon } from './DeviceBatteryIcon';
import { DeviceDrawerFacts, DeviceDrawerRawMetadata } from './device-drawer-detail-sections';

interface DeviceDrawerProps {
  canDelete: boolean;
  canManage?: boolean;
  deletePending: boolean;
  device: Device;
  lockState: DeviceLockState;
  onClose: () => void;
  onDelete: () => void;
  onRefetch?: () => void;
}

export function DeviceDrawer({
  canDelete,
  canManage = false,
  deletePending,
  device,
  lockState,
  onClose,
  onDelete,
  onRefetch,
}: DeviceDrawerProps) {
  const meta = device.metadata_json ?? {};
  const batteryLevel = meta.batteryLevel as number | undefined;
  const isCharging = meta.isCharging as boolean | undefined;
  const health = getDeviceHealthSummary(device);

  const [recoveryLoading, setRecoveryLoading] = useState<string | null>(null);
  const [recoveryResult, setRecoveryResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [guardrailUsage, setGuardrailUsage] = useState<DeviceGuardrailUsage | null>(null);
  const [quarantineStatus, setQuarantineStatus] = useState<DeviceQuarantineStatus | null>(null);
  const [quarantineLifting, setQuarantineLifting] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [usage, qStatus] = await Promise.allSettled([
          fetchDeviceGuardrailUsage(device.id),
          fetchDeviceQuarantineState(device.id),
        ]);
        if (!active) return;
        if (usage.status === 'fulfilled') setGuardrailUsage(usage.value);
        if (qStatus.status === 'fulfilled') setQuarantineStatus(qStatus.value);
      } catch {
        // Non-blocking telemetry fetch
      }
    })();
    return () => {
      active = false;
    };
  }, [device.id]);

  const handleLiftQuarantine = async () => {
    setQuarantineLifting(true);
    try {
      const res = await requestLiftDeviceQuarantine(device.id);
      setQuarantineStatus(res.state);
      setRecoveryResult({
        success: true,
        message: 'Quarantine lifted successfully',
      });
      if (onRefetch) onRefetch();
    } catch (err) {
      setRecoveryResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to lift quarantine',
      });
    } finally {
      setQuarantineLifting(false);
    }
  };

  const handleDeviceAction = async (action: 'wake_screen' | 'reboot_device') => {
    setRecoveryLoading(action);
    setRecoveryResult(null);
    try {
      const res = await requestDeviceRecovery(action, device.laixi_device_id);
      setRecoveryResult({
        success: res.success,
        message: res.message,
      });
      if (res.success && onRefetch) {
        onRefetch();
      }
    } catch (err) {
      setRecoveryResult({
        success: false,
        message: err instanceof Error ? err.message : 'Action failed',
      });
    } finally {
      setRecoveryLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-2xl overflow-y-auto animate-in">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
          <h3 className="text-lg font-semibold text-gray-900">Device Details</h3>
          <div className="flex items-center gap-2">
            {canDelete && (
              <button
                onClick={onDelete}
                disabled={deletePending}
                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors"
                title="Delete device"
              >
                {deletePending ? <Spinner size="sm" /> : <Trash2 className="w-5 h-5" />}
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <DeviceDrawerIdentity device={device} health={health} lockState={lockState} />
          {batteryLevel != null && (
            <DeviceDrawerBattery batteryLevel={batteryLevel} isCharging={isCharging} />
          )}

          {quarantineStatus?.isQuarantined && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-red-900 uppercase tracking-wider">
                      Device Quarantined
                    </h5>
                    <Badge variant="red">
                      {quarantineStatus.consecutiveFailures} Failures
                    </Badge>
                  </div>
                  <p className="text-xs text-red-700">
                    {quarantineStatus.reason ?? 'Device failed consecutive runs and is isolated from dispatch.'}
                  </p>
                  {canManage && (
                    <button
                      onClick={handleLiftQuarantine}
                      disabled={quarantineLifting}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-red-300 text-red-700 hover:bg-red-100 text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                    >
                      {quarantineLifting ? <Spinner size="sm" /> : <Unlock className="w-3.5 h-3.5" />}
                      Lift Quarantine
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {guardrailUsage && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 border border-gray-100">
              <div className="flex items-center justify-between text-xs font-medium text-gray-700">
                <span className="inline-flex items-center gap-1.5 text-gray-600">
                  <Gauge className="w-3.5 h-3.5 text-indigo-500" />
                  Daily Action Guardrail
                </span>
                <span className="font-mono text-gray-900 font-semibold">
                  {guardrailUsage.currentCount} / {guardrailUsage.dailyLimit}
                </span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    !guardrailUsage.allowed || guardrailUsage.remaining <= 0
                      ? 'bg-red-500'
                      : guardrailUsage.currentCount > guardrailUsage.dailyLimit * 0.8
                        ? 'bg-amber-500'
                        : 'bg-indigo-500'
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((guardrailUsage.currentCount / Math.max(1, guardrailUsage.dailyLimit)) * 100)
                    )}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-500">
                <span>Remaining: {guardrailUsage.remaining}</span>
                {!guardrailUsage.allowed && (
                  <span className="text-red-600 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Budget Exhausted
                  </span>
                )}
                {guardrailUsage.allowed && guardrailUsage.currentCount > 0 && (
                  <span className="text-emerald-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Within Limit
                  </span>
                )}
              </div>
            </div>
          )}

          <DeviceDrawerFacts device={device} health={health} lockState={lockState} />

          {canManage && (
            <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-4 space-y-3">
              <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Hardware Actions
              </h5>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleDeviceAction('wake_screen')}
                  disabled={recoveryLoading !== null}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium shadow-sm transition-colors disabled:opacity-50"
                >
                  {recoveryLoading === 'wake_screen' ? (
                    <Spinner size="sm" />
                  ) : (
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                  )}
                  Wake Screen
                </button>
                <button
                  onClick={() => handleDeviceAction('reboot_device')}
                  disabled={recoveryLoading !== null}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-red-200 hover:bg-red-50 text-red-700 text-xs font-medium shadow-sm transition-colors disabled:opacity-50"
                >
                  {recoveryLoading === 'reboot_device' ? (
                    <Spinner size="sm" />
                  ) : (
                    <Power className="w-3.5 h-3.5 text-red-500" />
                  )}
                  Quick Reboot
                </button>
              </div>
              {recoveryResult && (
                <p
                  className={`text-[11px] font-mono p-2 rounded ${
                    recoveryResult.success
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                      : 'bg-red-50 text-red-800 border border-red-100'
                  }`}
                >
                  {recoveryResult.message}
                </p>
              )}
            </div>
          )}

          <DeviceDrawerRawMetadata metadata={meta} />
        </div>
      </div>
    </div>
  );
}

function DeviceDrawerIdentity({
  device,
  health,
  lockState,
}: Pick<DeviceDrawerProps, 'device' | 'lockState'> & { health: ReturnType<typeof getDeviceHealthSummary> }) {
  const sc = health.appearance;

  return (
    <div className="flex items-center gap-4">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
        <Smartphone className="w-8 h-8 text-gray-500" />
      </div>
      <div>
        <h4 className="text-base font-semibold text-gray-900">{device.name || device.model}</h4>
        <p className="text-sm text-gray-500">{device.brand}</p>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <Badge variant={sc.variant as 'green'}>{sc.label}</Badge>
          <DeviceLockBadge lockState={lockState} />
        </div>
        <p className={`mt-2 text-xs ${health.lifecycle.isHeartbeatStale ? 'text-amber-600' : 'text-gray-500'}`}>
          {health.detail}
        </p>
        {(lockState.activeLock || lockState.latestExpiredLock) && (
          <p className={`mt-1 text-xs ${lockState.activeLock ? 'text-red-600' : 'text-amber-600'}`}>
            {describeDeviceLockState(lockState)}
          </p>
        )}
      </div>
    </div>
  );
}

function DeviceDrawerBattery({
  batteryLevel,
  isCharging,
}: {
  batteryLevel: number;
  isCharging?: boolean;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-600">Battery</span>
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
          <DeviceBatteryIcon level={batteryLevel} charging={isCharging} />
          {batteryLevel}%{isCharging ? ' (Charging)' : ''}
        </div>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            batteryLevel < 20 ? 'bg-red-500' : batteryLevel < 60 ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
          style={{ width: `${batteryLevel}%` }}
        />
      </div>
    </div>
  );
}
