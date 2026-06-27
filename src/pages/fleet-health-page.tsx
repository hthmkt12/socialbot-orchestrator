import { useMemo } from 'react';
import Header from '../components/layout/Header';
import Spinner from '../components/ui/Spinner';
import { useDevices, useDeviceLocks } from '../hooks/useDevices';
import { buildDeviceFleetMetrics, type DeviceFleetMetrics } from '../lib/device-fleet-metrics';
import { getDeviceHealthSummary, type DeviceHealthSummary } from '../lib/device-health';
import { buildDeviceLockSnapshot, getDeviceLockState, type DeviceLockState } from '../lib/device-locks';
import type { Device } from '../lib/database.types';
import {
  Heart,
  Clock,
  Activity,
  AlertTriangle,
  WifiOff,
  Lock,
  Monitor,
} from 'lucide-react';

/* ── fleet stat card ──────────────────────────────────────── */

interface StatCardProps {
  label: string;
  value: number;
  total: number;
  color: string;
  icon: React.ElementType;
}

function StatCard({ label, value, total, color, icon: Icon }: StatCardProps) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        <span className="text-sm text-gray-400">/ {total}</span>
        <span className={`text-xs font-medium ${color}`}>{pct}%</span>
      </div>
    </div>
  );
}

/* ── fleet stat grid ──────────────────────────────────────── */

function FleetStatGrid({ metrics }: { metrics: DeviceFleetMetrics }) {
  const cards: StatCardProps[] = [
    { label: 'Healthy', value: metrics.healthy, total: metrics.total, color: 'text-emerald-500', icon: Heart },
    { label: 'Stale', value: metrics.stale, total: metrics.total, color: 'text-amber-500', icon: Clock },
    { label: 'Busy', value: metrics.busy, total: metrics.total, color: 'text-blue-500', icon: Activity },
    { label: 'Error', value: metrics.error, total: metrics.total, color: 'text-red-500', icon: AlertTriangle },
    { label: 'Offline', value: metrics.offline, total: metrics.total, color: 'text-gray-400', icon: WifiOff },
    { label: 'Locked', value: metrics.locked, total: metrics.total, color: 'text-purple-500', icon: Lock },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => (
        <StatCard key={c.label} {...c} />
      ))}
    </div>
  );
}

/* ── per-device health card ───────────────────────────────── */

const VARIANT_STYLES: Record<string, string> = {
  green: 'border-emerald-200 bg-emerald-50',
  yellow: 'border-amber-200 bg-amber-50',
  red: 'border-red-200 bg-red-50',
  gray: 'border-gray-200 bg-gray-50',
};

const VARIANT_DOT: Record<string, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
  gray: 'bg-gray-400',
};

interface DeviceHealthCardProps {
  device: Device;
  health: DeviceHealthSummary;
  lockState: DeviceLockState;
}

function DeviceHealthCard({ device, health, lockState }: DeviceHealthCardProps) {
  const variant = health.appearance.variant;
  const StatusIcon = health.appearance.icon;

  return (
    <div className={`rounded-lg border p-4 ${VARIANT_STYLES[variant] ?? 'border-gray-200 bg-white'}`}>
      {/* header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${VARIANT_DOT[variant] ?? 'bg-gray-400'}`} />
          <span className="text-sm font-semibold text-gray-900 truncate max-w-[160px]">
            {device.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusIcon className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-xs font-medium text-gray-600">{health.appearance.label}</span>
        </div>
      </div>

      {/* detail row */}
      <p className="text-xs text-gray-500 mb-2">{health.detail}</p>

      {/* meta */}
      <div className="space-y-1 text-[11px] text-gray-500">
        <div className="flex justify-between">
          <span>Model</span>
          <span className="font-medium text-gray-700">{device.model ?? '—'}</span>
        </div>
        <div className="flex justify-between">
          <span>Last Seen</span>
          <span className="font-medium text-gray-700">{health.lastSeenLabel}</span>
        </div>
        <div className="flex justify-between">
          <span>Heartbeat</span>
          <span className="font-medium text-gray-700">{health.freshnessLabel}</span>
        </div>
        {lockState.activeLock && (
          <div className="flex justify-between">
            <span>Lock</span>
            <span className="font-medium text-purple-600 truncate max-w-[140px]">
              Run {lockState.activeLock.workflow_run_id.slice(0, 8)}…
            </span>
          </div>
        )}
        {health.lastErrorMessage && (
          <div className="mt-2 p-2 bg-red-100 rounded text-[11px] text-red-700 leading-tight">
            {health.lastErrorMessage}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── main page ────────────────────────────────────────────── */

export default function FleetHealthPage() {
  const { data: devices, isLoading } = useDevices();
  const { data: deviceLocks } = useDeviceLocks();

  const lockSnapshot = useMemo(
    () => buildDeviceLockSnapshot(deviceLocks ?? []),
    [deviceLocks]
  );

  const metrics = useMemo(
    () => buildDeviceFleetMetrics(devices ?? [], lockSnapshot),
    [devices, lockSnapshot]
  );

  const deviceRows = useMemo(() => {
    if (!devices) return [];
    return devices.map((d) => ({
      device: d,
      health: getDeviceHealthSummary(d),
      lockState: getDeviceLockState(d.id, lockSnapshot),
    }));
  }, [devices, lockSnapshot]);

  // sort: errors first, then stale, busy, offline, healthy
  const sorted = useMemo(() => {
    const ORDER: Record<string, number> = { ERROR: 0, BUSY: 1, OFFLINE: 2, ONLINE: 3 };
    return [...deviceRows].sort((a, b) => {
      const aStale = a.health.lifecycle.isHeartbeatStale ? -0.5 : 0;
      const bStale = b.health.lifecycle.isHeartbeatStale ? -0.5 : 0;
      const aOrder = (ORDER[a.health.lifecycle.displayStatus] ?? 9) + aStale;
      const bOrder = (ORDER[b.health.lifecycle.displayStatus] ?? 9) + bStale;
      return aOrder - bOrder;
    });
  }, [deviceRows]);

  return (
    <>
      <Header
        title="Fleet Health"
        subtitle={`${metrics.total} devices · ${metrics.healthy} healthy`}
        actions={
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500">Auto-refreshes every 10s</span>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <Spinner size="lg" />
          </div>
        ) : (
          <>
            <FleetStatGrid metrics={metrics} />

            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Per-Device Status ({sorted.length})
              </h2>
              {sorted.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  No devices registered. Sync devices from the Devices page.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {sorted.map(({ device, health, lockState }) => (
                    <DeviceHealthCard
                      key={device.id}
                      device={device}
                      health={health}
                      lockState={lockState}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
