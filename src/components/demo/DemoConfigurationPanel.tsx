import { Play, RotateCcw } from 'lucide-react';
import type { UserRole } from '../../lib/database.types';
import type { DemoMode } from './demo-workflow-state';
import {
  DemoConfigurationDeviceSelector,
  DemoConfigurationModeNotices,
  type DemoDeviceOption,
  type DeviceHealthSummary,
} from './demo-configuration-sections';

export function DemoConfigurationPanel({
  appName,
  canLaunchRuns,
  deviceOptions,
  devicesCount,
  isRunning,
  mode,
  onAppNameChange,
  onModeChange,
  onReset,
  onRun,
  onSelectedDeviceChange,
  profileRole,
  runComplete,
  selectedDeviceHealth,
  selectedDeviceId,
}: {
  appName: string;
  canLaunchRuns: boolean;
  deviceOptions: DemoDeviceOption[];
  devicesCount: number;
  isRunning: boolean;
  mode: DemoMode;
  onAppNameChange: (value: string) => void;
  onModeChange: (mode: DemoMode) => void;
  onReset: () => void;
  onRun: () => void;
  onSelectedDeviceChange: (deviceId: string) => void;
  profileRole: UserRole | undefined;
  runComplete: boolean;
  selectedDeviceHealth: DeviceHealthSummary | null;
  selectedDeviceId: string;
}) {
  const liveRunDisabled = mode === 'live' && (
    !canLaunchRuns ||
    !selectedDeviceId ||
    !selectedDeviceHealth?.lifecycle.isRunnable
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Configuration</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Mode</label>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => onModeChange('simulated')}
              disabled={isRunning}
              className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
                mode === 'simulated' ? 'bg-sky-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Simulated
            </button>
            <button
              onClick={() => onModeChange('live')}
              disabled={isRunning}
              className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
                mode === 'live' ? 'bg-sky-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Live (Laixi)
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">App Package Name</label>
          <input
            type="text"
            value={appName}
            onChange={(event) => onAppNameChange(event.target.value)}
            disabled={isRunning}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent font-mono"
          />
        </div>
      </div>

      {mode === 'live' && (
        <DemoConfigurationDeviceSelector
          deviceOptions={deviceOptions}
          devicesCount={devicesCount}
          isRunning={isRunning}
          onSelectedDeviceChange={onSelectedDeviceChange}
          selectedDeviceId={selectedDeviceId}
        />
      )}

      <DemoConfigurationModeNotices
        canLaunchRuns={canLaunchRuns}
        mode={mode}
        profileRole={profileRole}
        selectedDeviceHealth={selectedDeviceHealth}
        selectedDeviceId={selectedDeviceId}
      />

      <div className="flex items-center gap-3">
        <button
          onClick={onRun}
          disabled={isRunning || liveRunDisabled || !appName}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Play className="w-4 h-4" />
          Execute Run
        </button>
        {(isRunning || runComplete) && (
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
