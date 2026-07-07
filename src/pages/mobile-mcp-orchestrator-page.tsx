import { useMemo, useState } from 'react';
import { Camera, Play, RefreshCw, Smartphone, Terminal } from 'lucide-react';
import Header from '../components/layout/Header';
import Badge from '../components/ui/Badge';
import RoleAccessNotice from '../components/ui/RoleAccessNotice';
import Spinner from '../components/ui/Spinner';
import MobileMcpDeviceCard from '../components/mobile-mcp/mobile-mcp-device-card';
import {
  executeMobileMcpStep,
  loadMobileMcpFleet,
  normalizeMobileMcpBridgeUrl,
  type MobileMcpFleetSnapshot,
  type MobileMcpStepResult,
} from '../lib/mobile-mcp-orchestrator';
import { canManageDevices, getRoleLabel } from '../lib/role-access';
import { useAuthStore } from '../stores/auth';
import { useUIStore } from '../stores/ui';

const DEFAULT_BRIDGE_URL = import.meta.env.VITE_MOBILE_MCP_BRIDGE_URL ?? 'http://127.0.0.1:4321';

type ActionKind = 'launch_app' | 'get_current_app' | 'screenshot';

export default function MobileMcpOrchestratorPage() {
  const [bridgeUrl, setBridgeUrl] = useState(DEFAULT_BRIDGE_URL);
  const [appPackage, setAppPackage] = useState('com.brave.browser');
  const [snapshot, setSnapshot] = useState<MobileMcpFleetSnapshot | null>(null);
  const [selectedSerials, setSelectedSerials] = useState<string[]>([]);
  const [results, setResults] = useState<Record<string, MobileMcpStepResult>>({});
  const [loading, setLoading] = useState(false);
  const [runningAction, setRunningAction] = useState<ActionKind | null>(null);
  const profile = useAuthStore((s) => s.profile);
  const addToast = useUIStore((s) => s.addToast);
  const canExecuteDeviceActions = canManageDevices(profile?.role);

  const selectedCount = selectedSerials.length;
  const selectedSet = useMemo(() => new Set(selectedSerials), [selectedSerials]);

  const refreshFleet = async () => {
    setLoading(true);
    try {
      const nextSnapshot = await loadMobileMcpFleet(bridgeUrl);
      setSnapshot(nextSnapshot);
      setSelectedSerials((current) => current.filter((serial) => nextSnapshot.devices.some((device) => device.id === serial)));
      addToast(`Mobile MCP devices: ${nextSnapshot.devices.length}`, 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to load Mobile MCP fleet', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleSerial = (serial: string) => {
    setSelectedSerials((current) => (
      current.includes(serial) ? current.filter((item) => item !== serial) : [...current, serial]
    ));
  };

  const selectOnline = () => {
    setSelectedSerials((snapshot?.devices ?? []).filter((device) => device.status === 'device').map((device) => device.id));
  };

  const runAction = async (action: ActionKind) => {
    if (!canExecuteDeviceActions) {
      addToast('Only operators and admins can send Mobile MCP device actions', 'error');
      return;
    }
    if (selectedSerials.length === 0) {
      addToast('Select at least one device serial first', 'error');
      return;
    }
    setRunningAction(action);
    try {
      const params = action === 'launch_app'
        ? { appName: appPackage }
        : action === 'screenshot'
          ? { description: 'mobile_mcp_orchestrator' }
          : {};
      const actionResults = await Promise.all(
        selectedSerials.map((serial) => executeMobileMcpStep(bridgeUrl, serial, action, params))
      );
      setResults((current) => ({
        ...current,
        ...Object.fromEntries(actionResults.map((result) => [result.serial, result])),
      }));
      const failures = actionResults.filter((result) => !result.success).length;
      addToast(`${action} done: ${actionResults.length - failures}/${actionResults.length} pass`, failures ? 'error' : 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : `Failed to run ${action}`, 'error');
    } finally {
      setRunningAction(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header
        title="Mobile MCP Orchestrator"
        subtitle="Codex/controller surface for many device serials"
        icon={<Smartphone className="w-5 h-5" />}
        actions={<button onClick={refreshFleet} disabled={loading} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white">{loading ? <Spinner size="sm" /> : <RefreshCw className="w-4 h-4" />}Refresh</button>}
      />

      <main className="flex-1 overflow-auto p-6 space-y-6">
        {!canExecuteDeviceActions && (
          <RoleAccessNotice
            title={`${getRoleLabel(profile?.role)} role can inspect Mobile MCP fleet state but not control devices`}
            detail="You can refresh and inspect connected serials. Only operators and admins can launch apps, query current apps, or request screenshot grids."
          />
        )}

        <section className="rounded-2xl bg-white border border-gray-200 p-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-gray-600">Mobile MCP bridge URL</span>
              <input value={bridgeUrl} onChange={(event) => setBridgeUrl(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-gray-600">Launch package</span>
              <input value={appPackage} onChange={(event) => setAppPackage(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </label>
            <div className="flex items-end gap-2">
              <button onClick={selectOnline} className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50">Select online</button>
              <Badge variant={snapshot?.health.status === 'ok' ? 'green' : 'gray'}>{snapshot ? `${snapshot.devices.length} devices` : 'not checked'}</Badge>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">Normalized bridge: {normalizeMobileMcpBridgeUrl(bridgeUrl)} · Selected: {selectedCount}</p>
        </section>

        <section className="rounded-2xl bg-white border border-gray-200 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => runAction('launch_app')} disabled={!!runningAction || !canExecuteDeviceActions} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white"><Play className="w-4 h-4" />Launch app</button>
            <button onClick={() => runAction('get_current_app')} disabled={!!runningAction || !canExecuteDeviceActions} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white"><Terminal className="w-4 h-4" />Current app</button>
            <button onClick={() => runAction('screenshot')} disabled={!!runningAction || !canExecuteDeviceActions} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white"><Camera className="w-4 h-4" />Screenshot grid</button>
            {runningAction && <span className="inline-flex items-center gap-2 text-sm text-gray-500"><Spinner size="sm" />Running {runningAction}</span>}
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {(snapshot?.devices ?? []).map((device) => (
            <MobileMcpDeviceCard
              key={device.id}
              device={device}
              selected={selectedSet.has(device.id)}
              result={results[device.id]}
              onToggle={() => toggleSerial(device.id)}
            />
          ))}
          {snapshot && snapshot.devices.length === 0 && <div className="rounded-xl border border-dashed border-gray-300 p-8 text-sm text-gray-500">No Android serials from Mobile MCP bridge.</div>}
          {!snapshot && <div className="rounded-xl border border-dashed border-gray-300 p-8 text-sm text-gray-500">Click Refresh to load the Mobile MCP fleet.</div>}
        </section>
      </main>
    </div>
  );
}
