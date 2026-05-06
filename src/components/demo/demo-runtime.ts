import type { MutableRefObject } from 'react';
import type { Device, Profile } from '../../lib/database.types';
import type { StepState } from './demo-workflow-state';
import { createAndDispatchDemoRun } from './demo-live-run-request';

const simulateDelay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runSimulatedDemo({
  abortRef,
  appName,
  onComplete,
  updateStep,
}: {
  abortRef: MutableRefObject<boolean>;
  appName: string;
  onComplete: (durationMs: number) => void;
  updateStep: (id: string, update: Partial<StepState>) => void;
}) {
  const start = Date.now();

  updateStep('launch', { status: 'running' });
  await simulateDelay(800);
  if (abortRef.current) return;
  updateStep('launch', { status: 'success', output: { appName }, durationMs: 800 });

  updateStep('wait1', { status: 'running' });
  await simulateDelay(3000);
  if (abortRef.current) return;
  updateStep('wait1', { status: 'success', output: { waited: 3000 }, durationMs: 3000 });

  updateStep('screen1', { status: 'running' });
  await simulateDelay(600);
  if (abortRef.current) return;
  updateStep('screen1', { status: 'success', output: { captured: true, format: 'PNG', size: '245KB' }, durationMs: 600 });

  updateStep('current1', { status: 'running' });
  await simulateDelay(400);
  if (abortRef.current) return;
  updateStep('current1', {
    status: 'success',
    output: { appPackage: appName, appActivity: `${appName}.MainActivity` },
    durationMs: 400,
  });

  onComplete(Date.now() - start);
}

export async function runLiveDemo({
  appName,
  canCreateDemoMacros,
  canLaunchRuns,
  devices,
  onActiveRunId,
  profile,
  selectedDeviceId,
  updateStep,
}: {
  appName: string;
  canCreateDemoMacros: boolean;
  canLaunchRuns: boolean;
  devices: Device[];
  onActiveRunId: (runId: string) => void;
  profile: Profile | null;
  selectedDeviceId: string;
  updateStep: (id: string, update: Partial<StepState>) => void;
}) {
  const start = Date.now();
  const dispatch = await createAndDispatchDemoRun({
    appName,
    canCreateDemoMacros,
    canLaunchRuns,
    devices,
    onActiveRunId,
    profile,
    selectedDeviceId,
    updateStep,
  });

  if (!dispatch) {
    return null;
  }

  return { durationMs: Date.now() - start, status: dispatch.status };
}
