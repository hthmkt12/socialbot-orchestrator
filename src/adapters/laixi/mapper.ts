import type { MacroStep } from '../../contracts/macro';
import type { Device } from '../../lib/database.types';
import type { LaixiClient } from './client';
import {
  executeAdbStep,
  executeAutoJsStep,
  executeCurrentAppStep,
  executeInputTextStep,
  executeLaunchAppStep,
  executeScreenshotStep,
  executeStopStep,
  executeSwipeStep,
  executeTapStep,
  executeWaitStep,
  type StepExecutionResult,
} from './step-execution-helpers';

export {
  mapToAdbResponse,
  mapToAppInfo,
  mapToAutoJsResponse,
  mapToDeviceInfo,
  mapToScreenshotResponse,
} from './response-mappers';

export type { StepExecutionResult } from './step-execution-helpers';

export async function executeStepOnDevice(
  client: LaixiClient,
  step: MacroStep,
  device: Device,
  resolvedParams: Record<string, unknown>
): Promise<StepExecutionResult> {
  const deviceId = device.laixi_device_id;

  switch (step.type) {
    case 'wait': {
      return executeWaitStep(resolvedParams);
    }

    case 'launch_app': {
      return executeLaunchAppStep(client, deviceId, resolvedParams);
    }

    case 'input_text': {
      return executeInputTextStep(client, deviceId, resolvedParams);
    }

    case 'tap': {
      return executeTapStep(client, device, resolvedParams);
    }

    case 'swipe': {
      return executeSwipeStep(client, device, resolvedParams);
    }

    case 'screenshot': {
      return executeScreenshotStep(client, deviceId);
    }

    case 'get_current_app': {
      return executeCurrentAppStep(client, deviceId);
    }

    case 'adb': {
      return executeAdbStep(client, deviceId, resolvedParams);
    }

    case 'run_autox': {
      return executeAutoJsStep(client, deviceId, resolvedParams);
    }

    case 'stop': {
      return executeStopStep(resolvedParams);
    }

    default:
      return { success: false, output: {}, error: `Unknown step type: ${step.type}` };
  }
}
