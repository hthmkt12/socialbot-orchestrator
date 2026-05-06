import type { Device } from '../../../src/lib/database.types';
import type { MacroStep } from '../../../src/contracts/macro';
import {
  buildExecuteAdb,
  buildExecuteAutoJs,
  buildGetCurrentAppInfo,
  buildInputText,
  buildLaunchApp,
  buildScreenshot,
  buildSwipe,
  buildTap,
} from '../../../packages/laixi-adapter/src';
import type { StepArtifactRef } from '../../../packages/shared/src';
import type { DeviceCommandClient, DeviceDispatchContext } from './device-command-client';

export interface StepExecutionResult {
  success: boolean;
  output: Record<string, unknown>;
  error?: string;
  screenshotBase64?: string;
  artifacts?: StepArtifactRef[];
}

function resolveAbsoluteCoords(relative: number, screenDimension: number) {
  return Math.round(relative * screenDimension);
}

function extractArtifacts(artifacts: StepArtifactRef[] | undefined) {
  return Array.isArray(artifacts) && artifacts.length > 0 ? artifacts : undefined;
}

async function waitWithCancellation(ms: number, isCancelled: () => Promise<boolean>) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await isCancelled()) return false;
    await new Promise((resolve) => setTimeout(resolve, Math.min(500, deadline - Date.now())));
  }
  return true;
}

export async function executeDeviceStep(
  client: DeviceCommandClient,
  step: MacroStep,
  runId: string,
  device: Device,
  resolvedParams: Record<string, unknown>,
  isCancelled: () => Promise<boolean>
): Promise<StepExecutionResult> {
  const deviceId = device.laixi_device_id;
  const dispatchContext: DeviceDispatchContext = { runId, stepId: step.id, deviceId };

  switch (step.type) {
    case 'wait': {
      const ms = Number(resolvedParams.ms ?? 1000);
      const completed = await waitWithCancellation(ms, isCancelled);
      return completed
        ? { success: true, output: { waited: ms } }
        : { success: false, output: { waited: ms, cancelled: true }, error: 'Cancelled during wait' };
    }
    case 'launch_app': {
      const appName = String(resolvedParams.appName ?? '');
      const resp = await client.sendCommand(buildLaunchApp(deviceId, appName), dispatchContext);
      return { success: resp.success, output: { appName }, error: resp.error, artifacts: extractArtifacts(resp.artifacts) };
    }
    case 'input_text': {
      const text = String(resolvedParams.text ?? '');
      const resp = await client.sendCommand(buildInputText(deviceId, text), dispatchContext);
      return { success: resp.success, output: { text }, error: resp.error, artifacts: extractArtifacts(resp.artifacts) };
    }
    case 'tap': {
      const relX = Number(resolvedParams.x ?? 0.5);
      const relY = Number(resolvedParams.y ?? 0.5);
      const absX = resolveAbsoluteCoords(relX, device.screen_width);
      const absY = resolveAbsoluteCoords(relY, device.screen_height);
      const results = await client.sendCommands(buildTap(deviceId, absX, absY), dispatchContext);
      const lastResult = results[results.length - 1];
      return {
        success: lastResult?.success ?? false,
        output: { x: absX, y: absY, relX, relY },
        error: lastResult?.error,
        artifacts: extractArtifacts(lastResult?.artifacts),
      };
    }
    case 'swipe': {
      const fromX = resolveAbsoluteCoords(Number(resolvedParams.fromX ?? 0.5), device.screen_width);
      const fromY = resolveAbsoluteCoords(Number(resolvedParams.fromY ?? 0.7), device.screen_height);
      const toX = resolveAbsoluteCoords(Number(resolvedParams.toX ?? 0.5), device.screen_width);
      const toY = resolveAbsoluteCoords(Number(resolvedParams.toY ?? 0.2), device.screen_height);
      const results = await client.sendCommands(buildSwipe(deviceId, fromX, fromY, toX, toY), dispatchContext);
      const lastResult = results[results.length - 1];
      return {
        success: lastResult?.success ?? false,
        output: { fromX, fromY, toX, toY },
        error: lastResult?.error,
        artifacts: extractArtifacts(lastResult?.artifacts),
      };
    }
    case 'screenshot': {
      const resp = await client.sendCommand(buildScreenshot(deviceId), dispatchContext);
      const data = resp.data as Record<string, unknown> | undefined;
      const screenshotArtifact = resp.artifacts?.find(
        (artifact) => artifact.type === 'SCREENSHOT' && typeof artifact.base64 === 'string'
      );
      const base64 = typeof data?.base64 === 'string'
        ? data.base64
        : typeof screenshotArtifact?.base64 === 'string'
          ? screenshotArtifact.base64
          : undefined;
      return {
        success: resp.success,
        output: { captured: resp.success },
        screenshotBase64: base64,
        error: resp.error,
        artifacts: extractArtifacts(resp.artifacts),
      };
    }
    case 'get_current_app': {
      const resp = await client.sendCommand(buildGetCurrentAppInfo(deviceId), dispatchContext);
      const data = resp.data as Record<string, unknown> | undefined;
      return {
        success: resp.success,
        output: {
          appPackage: data?.packageName ?? data?.package ?? data?.appPackage ?? '',
          appActivity: data?.activityName ?? data?.activity ?? data?.appActivity ?? '',
        },
        error: resp.error,
        artifacts: extractArtifacts(resp.artifacts),
      };
    }
    case 'adb': {
      const command = String(resolvedParams.command ?? '');
      const resp = await client.sendCommand(buildExecuteAdb(deviceId, command), dispatchContext);
      const data = resp.data as Record<string, unknown> | undefined;
      return {
        success: resp.success,
        output: { command, result: data?.output ?? data?.result ?? '' },
        error: resp.error,
        artifacts: extractArtifacts(resp.artifacts),
      };
    }
    case 'run_autox': {
      const filePath = String(resolvedParams.filePath ?? '');
      const resp = await client.sendCommand(buildExecuteAutoJs(deviceId, filePath), dispatchContext);
      const data = resp.data as Record<string, unknown> | undefined;
      return {
        success: resp.success,
        output: { filePath, result: data?.output ?? data?.result ?? '' },
        error: resp.error,
        artifacts: extractArtifacts(resp.artifacts),
      };
    }
    case 'stop': {
      const reason = String(resolvedParams.reason ?? 'Manual stop');
      return { success: false, output: { stopped: true, reason }, error: `STOP: ${reason}` };
    }
    default:
      return { success: false, output: {}, error: `Unknown step type: ${step.type}` };
  }
}
