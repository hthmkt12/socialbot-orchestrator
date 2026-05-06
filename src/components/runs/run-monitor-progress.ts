import type { RunStep } from './run-monitor-types';

export function buildRunMonitorProgress(steps: RunStep[]) {
  const totalSteps = steps.length;
  const completedSteps = steps.filter(
    (step) => step.status === 'SUCCESS' || step.status === 'SKIPPED'
  ).length;
  const failedSteps = steps.filter((step) => step.status === 'FAILED').length;
  const doneSteps =
    completedSteps +
    failedSteps +
    steps.filter((step) => step.status === 'CANCELLED').length;

  return {
    completedSteps,
    failedSteps,
    progressPercent: totalSteps > 0 ? (doneSteps / totalSteps) * 100 : 0,
    totalSteps,
  };
}
