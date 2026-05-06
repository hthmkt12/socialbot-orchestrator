import { AppWindow, Camera, Clock, Info, Play } from 'lucide-react';

export interface StepState {
  id: string;
  type: string;
  label: string;
  status: 'pending' | 'queued' | 'running' | 'success' | 'failed' | 'cancelled' | 'skipped' | 'waiting_approval';
  output?: Record<string, unknown>;
  durationMs?: number;
  artifactCount?: number;
  approvalStatus?: string;
}

export type DemoMode = 'simulated' | 'live';

export const DEMO_STEPS: Omit<StepState, 'status'>[] = [
  { id: 'launch', type: 'launch_app', label: 'Launch App' },
  { id: 'wait1', type: 'wait', label: 'Wait 3s' },
  { id: 'screen1', type: 'screenshot', label: 'Capture Screenshot' },
  { id: 'current1', type: 'get_current_app', label: 'Get Current App Info' },
];

export const SEEDED_DEMO_MACRO_KEY = 'launch_app_and_capture';
export const TERMINAL_RUN_STATUSES = new Set(['COMPLETED', 'FAILED', 'CANCELLED', 'PARTIAL_SUCCESS']);

export const stepIcons: Record<string, typeof Play> = {
  launch_app: AppWindow,
  wait: Clock,
  screenshot: Camera,
  get_current_app: Info,
};

export const mapRunStepStatus = (status: string): StepState['status'] => {
  switch (status) {
    case 'RUNNING':
    case 'RETRYING':
      return 'running';
    case 'SUCCESS':
      return 'success';
    case 'FAILED':
      return 'failed';
    case 'CANCELLED':
      return 'cancelled';
    case 'SKIPPED':
      return 'skipped';
    case 'WAITING_APPROVAL':
      return 'waiting_approval';
    default:
      return 'pending';
  }
};

export const getDurationMs = (startedAt: string | null, finishedAt: string | null) => {
  if (!startedAt) return undefined;
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  return Math.max(0, end - new Date(startedAt).getTime());
};

export const getDemoStatusBadgeVariant = (status: string | null): 'green' | 'red' | 'orange' | 'gray' | 'blue' => (
  status === 'COMPLETED' ? 'green' :
  status === 'FAILED' ? 'red' :
  status === 'WAITING_APPROVAL' ? 'orange' :
  status === 'CANCELLED' ? 'gray' :
  'blue'
);

export const getDemoProgress = (steps: StepState[]) => (
  steps.length > 0
    ? (steps.filter((step) => ['success', 'failed', 'cancelled', 'skipped'].includes(step.status)).length / steps.length) * 100
    : 0
);
