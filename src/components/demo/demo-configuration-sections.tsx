import { AlertTriangle, Info, Smartphone } from 'lucide-react';
import type { Device, UserRole } from '../../lib/database.types';
import type { getDeviceHealthSummary } from '../../lib/device-health';
import { getRoleLabel } from '../../lib/role-access';
import type { DemoMode } from './demo-workflow-state';
import Badge from '../ui/Badge';

export type DeviceHealthSummary = ReturnType<typeof getDeviceHealthSummary>;

export interface DemoDeviceOption {
  device: Device;
  health: DeviceHealthSummary;
}

export function DemoConfigurationDeviceSelector({
  deviceOptions,
  devicesCount,
  isRunning,
  onSelectedDeviceChange,
  selectedDeviceId,
}: {
  deviceOptions: DemoDeviceOption[];
  devicesCount: number;
  isRunning: boolean;
  onSelectedDeviceChange: (deviceId: string) => void;
  selectedDeviceId: string;
}) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-gray-700 mb-1.5">Target Device</label>
      {devicesCount === 0 ? (
        <p className="text-xs text-gray-500 py-2">No devices found.</p>
      ) : (
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {deviceOptions.map(({ device, health }) => (
            <button
              key={device.id}
              onClick={() => onSelectedDeviceChange(device.id)}
              disabled={isRunning}
              className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all flex items-center gap-3 ${
                selectedDeviceId === device.id ? 'border-sky-500 bg-sky-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Smartphone className={`w-4 h-4 ${selectedDeviceId === device.id ? 'text-sky-500' : 'text-gray-400'}`} />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-700">{device.name || device.model}</span>
                <p className={`text-[11px] ${health.lifecycle.isHeartbeatStale ? 'text-amber-600' : 'text-gray-500'}`}>
                  {health.detail}
                </p>
              </div>
              <Badge variant={health.appearance.variant}>{health.appearance.label}</Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DemoConfigurationModeNotices({
  canLaunchRuns,
  mode,
  profileRole,
  selectedDeviceHealth,
  selectedDeviceId,
}: {
  canLaunchRuns: boolean;
  mode: DemoMode;
  profileRole: UserRole | undefined;
  selectedDeviceHealth: DeviceHealthSummary | null;
  selectedDeviceId: string;
}) {
  if (mode === 'simulated') {
    return (
      <div className="bg-gray-50 rounded-lg p-3 mb-4">
        <p className="text-xs text-gray-500">
          Simulated mode runs the workflow locally with realistic timing delays.
          No Laixi connection or physical device is required.
        </p>
      </div>
    );
  }

  return (
    <>
      {selectedDeviceHealth?.lifecycle.isHeartbeatStale && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <p className="text-xs text-amber-700">
            The selected device is still treated as runnable, but its heartbeat is stale. Verify the gateway session before treating this as proof of healthy device connectivity.
          </p>
        </div>
      )}

      {selectedDeviceId && selectedDeviceHealth && !selectedDeviceHealth.lifecycle.isRunnable && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">
            The selected device is not currently runnable under the shared lifecycle policy.
          </p>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
        <p className="text-xs text-amber-700">
          Live mode creates a real backend run and mirrors worker-owned queued,
          running, approval, completion, failure, and artifact state below.
        </p>
      </div>

      {!canLaunchRuns && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4 flex items-start gap-2">
          <Info className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-slate-700">
            {getRoleLabel(profileRole)} role is read-only here, matching Runs access.
            You can inspect the demo shape, but only operators and admins can dispatch live runs.
          </p>
        </div>
      )}
    </>
  );
}
