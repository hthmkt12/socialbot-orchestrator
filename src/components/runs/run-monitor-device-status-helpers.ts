import { supabase } from '../../lib/supabase';
import type { DeviceStatus, RunStep, WorkflowRun } from './run-monitor-types';

function getPendingStepCount(deviceSteps: RunStep[]) {
  return deviceSteps.filter((step) =>
    step.status === 'PENDING' || step.status === 'RUNNING' || step.status === 'RETRYING'
  ).length;
}

function getDeviceRunStatus(
  run: WorkflowRun | null,
  deviceSteps: RunStep[],
  failedCount: number,
  pendingCount: number
): DeviceStatus['status'] {
  const cancelledCount = deviceSteps.filter((step) => step.status === 'CANCELLED').length;

  if (run?.status === 'PENDING' || run?.status === 'QUEUED') {
    return 'QUEUED';
  }

  if (run?.status === 'WAITING_APPROVAL') {
    return 'WAITING_APPROVAL';
  }

  if (run?.status === 'CANCELLED' && pendingCount === 0) {
    return 'CANCELLED';
  }

  if (pendingCount === 0 && failedCount > 0 && cancelledCount > 0) {
    return 'PARTIAL_SUCCESS';
  }

  if (failedCount > 0 && pendingCount === 0) {
    return 'FAILED';
  }

  if (pendingCount === 0 && deviceSteps.length > 0 && failedCount === 0 && cancelledCount === 0) {
    return 'COMPLETED';
  }

  return 'RUNNING';
}

export async function fetchRunMonitorDeviceStatuses(steps: RunStep[], run: WorkflowRun | null) {
  const deviceIds = [...new Set(steps.map((step) => step.device_id))];
  const { data: devicesData } = await supabase
    .from('devices')
    .select('*')
    .in('id', deviceIds);

  if (!devicesData) {
    return [];
  }

  const deviceMap = new Map(devicesData.map((device) => [device.id, device]));

  return deviceIds.flatMap((deviceId) => {
    const device = deviceMap.get(deviceId);
    if (!device) {
      return [];
    }

    const deviceSteps = steps.filter((step) => step.device_id === deviceId);
    const successCount = deviceSteps.filter((step) => step.status === 'SUCCESS').length;
    const failedCount = deviceSteps.filter((step) => step.status === 'FAILED').length;
    const pendingCount = getPendingStepCount(deviceSteps);

    return {
      device,
      steps: deviceSteps,
      successCount,
      failedCount,
      pendingCount,
      status: getDeviceRunStatus(run, deviceSteps, failedCount, pendingCount),
    };
  });
}
