import {
  AlertTriangle,
  BookOpen,
  ClipboardCheck,
  Terminal,
} from 'lucide-react';
import Badge from '../ui/Badge';
import { StatCard } from './device-setup-cards';

export type DeviceSetupTab = 'verify' | 'guide' | 'protocol' | 'troubleshoot';

export function DeviceSetupHero({
  checkedAt,
  connectedSessions,
  runnableDeviceCount,
  staleDeviceCount,
}: {
  checkedAt: string | null;
  connectedSessions: number;
  runnableDeviceCount: number;
  staleDeviceCount: number;
}) {
  return (
    <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-6">
      <div className="flex flex-col lg:flex-row lg:items-center gap-6">
        <div className="flex-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-sky-100 text-sky-700 text-xs font-semibold">
            <ClipboardCheck className="w-3.5 h-3.5" />
            OPS-03/OPS-04 operator verification
          </div>
          <h3 className="text-2xl font-semibold text-gray-900 mt-4">
            Verify the control plane before trusting a device
          </h3>
          <p className="text-sm text-gray-600 mt-2 max-w-3xl leading-relaxed">
            This page now starts with live health checks and device probes. Use it to confirm gateway reachability,
            worker readiness, registered devices, heartbeat freshness, and screenshot permission before opening the macro or run flows.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Badge variant="blue">Gateway /health</Badge>
            <Badge variant="blue">Worker /health</Badge>
            <Badge variant="green">Current-app probe</Badge>
            <Badge variant="green">Screenshot probe</Badge>
            <Badge variant="yellow">Lock diagnostics</Badge>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 min-w-full lg:min-w-[360px] lg:max-w-[420px]">
          <StatCard
            title="Connected Sessions"
            value={String(connectedSessions)}
            hint="Live sessions reported by the gateway"
            tone={connectedSessions > 0 ? 'blue' : 'gray'}
          />
          <StatCard
            title="Runnable Devices"
            value={String(runnableDeviceCount)}
            hint="Devices currently allowed to run"
            tone={runnableDeviceCount > 0 ? 'green' : 'yellow'}
          />
          <StatCard
            title="Stale Devices"
            value={String(staleDeviceCount)}
            hint="Freshness drifted beyond the stale threshold"
            tone={staleDeviceCount > 0 ? 'yellow' : 'gray'}
          />
          <StatCard
            title="Last Check"
            value={checkedAt ? new Date(checkedAt).toLocaleTimeString() : '--'}
            hint="Most recent verification timestamp"
            tone="gray"
          />
        </div>
      </div>
    </div>
  );
}

export function DeviceSetupTabNav({
  activeTab,
  onChange,
}: {
  activeTab: DeviceSetupTab;
  onChange: (tab: DeviceSetupTab) => void;
}) {
  const tabs = [
    { id: 'verify' as const, label: 'Verify', icon: ClipboardCheck },
    { id: 'guide' as const, label: 'Guide', icon: BookOpen },
    { id: 'protocol' as const, label: 'Protocol', icon: Terminal },
    { id: 'troubleshoot' as const, label: 'Troubleshoot', icon: AlertTriangle },
  ];

  return (
    <div className="flex gap-1 bg-gray-200 rounded-xl p-1">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors ${
            activeTab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Icon className="w-4 h-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
