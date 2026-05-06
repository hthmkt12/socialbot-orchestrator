import { useCallback, type MutableRefObject } from 'react';
import type { Device, Profile } from '../../lib/database.types';
import { runLiveDemo, runSimulatedDemo } from './demo-runtime';
import type { DemoMode, StepState } from './demo-workflow-state';

interface UseDemoRunControllerArgs {
  abortRef: MutableRefObject<boolean>;
  appName: string;
  canCreateDemoMacros: boolean;
  canLaunchRuns: boolean;
  devices: Device[];
  mode: DemoMode;
  profile: Profile | null;
  requestRunCancel: (runId: string) => Promise<unknown>;
  resetSteps: () => void;
  selectedDeviceId: string;
  setActiveRunId: (runId: string | null) => void;
  setIsRunning: (running: boolean) => void;
  setLastRunStatus: (status: string | null) => void;
  setRunComplete: (complete: boolean) => void;
  setTotalDuration: (duration: number) => void;
  updateStep: (id: string, update: Partial<StepState>) => void;
  activeRunId: string | null;
}

export function useDemoRunController({
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
}: UseDemoRunControllerArgs) {
  const runSimulated = useCallback(async () => {
    await runSimulatedDemo({
      abortRef,
      appName,
      onComplete: (durationMs) => {
        setLastRunStatus('COMPLETED');
        setTotalDuration(durationMs);
      },
      updateStep,
    });
  }, [abortRef, appName, setLastRunStatus, setTotalDuration, updateStep]);

  const runLive = useCallback(async () => {
    const result = await runLiveDemo({
      appName,
      canCreateDemoMacros,
      canLaunchRuns,
      devices,
      onActiveRunId: setActiveRunId,
      profile,
      selectedDeviceId,
      updateStep,
    });

    if (result) {
      setLastRunStatus(result.status);
      setTotalDuration(result.durationMs);
    }
  }, [
    appName,
    canCreateDemoMacros,
    canLaunchRuns,
    devices,
    profile,
    selectedDeviceId,
    setActiveRunId,
    setLastRunStatus,
    setTotalDuration,
    updateStep,
  ]);

  const handleRun = useCallback(async () => {
    resetSteps();
    setIsRunning(true);
    abortRef.current = false;

    await new Promise((resolve) => setTimeout(resolve, 50));

    if (mode === 'simulated') {
      await runSimulated();
    } else {
      await runLive();
    }

    if (mode === 'simulated') {
      if (!abortRef.current) setRunComplete(true);
      setIsRunning(false);
    }
  }, [
    abortRef,
    mode,
    resetSteps,
    runLive,
    runSimulated,
    setIsRunning,
    setRunComplete,
  ]);

  const handleReset = useCallback(() => {
    abortRef.current = true;
    if (activeRunId) {
      void requestRunCancel(activeRunId);
    }
    setIsRunning(false);
    resetSteps();
  }, [abortRef, activeRunId, requestRunCancel, resetSteps, setIsRunning]);

  return {
    handleReset,
    handleRun,
  };
}
