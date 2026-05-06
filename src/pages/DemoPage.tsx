import { useState, useCallback, useRef } from 'react';
import { Zap } from 'lucide-react';
import Header from '../components/layout/Header';
import Badge from '../components/ui/Badge';
import { DemoConfigurationPanel } from '../components/demo/DemoConfigurationPanel';
import { DemoMacroDefinitionPanel } from '../components/demo/DemoMacroDefinitionPanel';
import { DemoStepExecutionPanel } from '../components/demo/DemoStepExecutionPanel';
import { useDemoDevices } from '../components/demo/use-demo-devices';
import { useDemoLiveState } from '../components/demo/use-demo-live-state';
import { useDemoRunController } from '../components/demo/use-demo-run-controller';
import {
  DEMO_STEPS,
  getDemoProgress,
  getDemoStatusBadgeVariant,
  type DemoMode,
  type StepState,
} from '../components/demo/demo-workflow-state';
import { useAuthStore } from '../stores/auth';
import { canManageMacros, canManageRuns } from '../lib/role-access';

export default function DemoPage() {
  const [mode, setMode] = useState<DemoMode>('simulated');
  const [appName, setAppName] = useState('com.android.settings');
  const [steps, setSteps] = useState<StepState[]>(DEMO_STEPS.map((s) => ({ ...s, status: 'pending' })));
  const [isRunning, setIsRunning] = useState(false);
  const [runComplete, setRunComplete] = useState(false);
  const [totalDuration, setTotalDuration] = useState(0);
  const [lastRunStatus, setLastRunStatus] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const profile = useAuthStore((s) => s.profile);
  const canCreateDemoMacros = canManageMacros(profile?.role);
  const canLaunchRuns = canManageRuns(profile?.role);
  const abortRef = useRef(false);
  const { deviceOptions, devices, selectedDeviceHealth, selectedDeviceId, setSelectedDeviceId } = useDemoDevices();
  const { displaySteps, requestRunCancel } = useDemoLiveState({
    activeRunId,
    mode,
    setIsRunning,
    setLastRunStatus,
    setRunComplete,
    setTotalDuration,
    steps,
  });

  const resetSteps = useCallback(() => {
    setSteps(DEMO_STEPS.map((s) => ({ ...s, status: 'pending' })));
    setRunComplete(false);
    setTotalDuration(0);
    setLastRunStatus(null);
    setActiveRunId(null);
    abortRef.current = false;
  }, []);

  const updateStep = useCallback((id: string, update: Partial<StepState>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...update } : s)));
  }, []);

  const { handleReset, handleRun } = useDemoRunController({
    abortRef,
    activeRunId,
    appName,
    canCreateDemoMacros,
    canLaunchRuns,
    devices,
    mode,
    profile,
    requestRunCancel,
    resetSteps,
    selectedDeviceId,
    setActiveRunId,
    setIsRunning,
    setLastRunStatus,
    setRunComplete,
    setTotalDuration,
    updateStep,
  });

  const progress = getDemoProgress(displaySteps);
  const statusBadgeVariant = getDemoStatusBadgeVariant(lastRunStatus);

  return (
    <>
      <Header
        title="End-to-End Demo"
        subtitle="launch_app_and_capture workflow"
        actions={
          <Badge variant="blue">
            <Zap className="w-3 h-3 mr-1" />
            Interactive Demo
          </Badge>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <DemoConfigurationPanel
            appName={appName}
            canLaunchRuns={canLaunchRuns}
            deviceOptions={deviceOptions}
            devicesCount={devices.length}
            isRunning={isRunning}
            mode={mode}
            onAppNameChange={setAppName}
            onModeChange={setMode}
            onReset={handleReset}
            onRun={() => void handleRun()}
            onSelectedDeviceChange={setSelectedDeviceId}
            profileRole={profile?.role}
            runComplete={runComplete}
            selectedDeviceHealth={selectedDeviceHealth}
            selectedDeviceId={selectedDeviceId}
          />

          <DemoStepExecutionPanel
            displaySteps={displaySteps}
            lastRunStatus={lastRunStatus}
            progress={progress}
            statusBadgeVariant={statusBadgeVariant}
            totalDuration={totalDuration}
          />

          <DemoMacroDefinitionPanel />
        </div>
      </div>
    </>
  );
}
