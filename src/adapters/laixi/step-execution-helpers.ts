import type { LaixiClient } from './client';
import * as cmd from './commands';
export {
  executeSwipeStep,
  executeTapStep,
} from './step-execution-batch-helpers';

export interface StepExecutionResult {
  success: boolean;
  output: Record<string, unknown>;
  error?: string;
  screenshotBase64?: string;
}

function getResponseData(response: Awaited<ReturnType<LaixiClient['sendCommand']>>) {
  return response.data as Record<string, unknown> | undefined;
}

export async function executeLaunchAppStep(
  client: LaixiClient,
  deviceId: string,
  resolvedParams: Record<string, unknown>
): Promise<StepExecutionResult> {
  const appName = String(resolvedParams.appName ?? '');
  const resp = await client.sendCommand(cmd.buildLaunchApp(deviceId, appName));
  return { success: resp.success, output: { appName }, error: resp.error };
}

export async function executeInputTextStep(
  client: LaixiClient,
  deviceId: string,
  resolvedParams: Record<string, unknown>
): Promise<StepExecutionResult> {
  const text = String(resolvedParams.text ?? '');
  const resp = await client.sendCommand(cmd.buildInputText(deviceId, text));
  return { success: resp.success, output: { text }, error: resp.error };
}

export async function executeScreenshotStep(
  client: LaixiClient,
  deviceId: string
): Promise<StepExecutionResult> {
  const resp = await client.sendCommand(cmd.buildScreenshot(deviceId));
  const data = getResponseData(resp);
  const base64 = data?.base64 as string | undefined;

  return {
    success: resp.success,
    output: { captured: resp.success },
    screenshotBase64: base64,
    error: resp.error,
  };
}

export async function executeCurrentAppStep(
  client: LaixiClient,
  deviceId: string
): Promise<StepExecutionResult> {
  const resp = await client.sendCommand(cmd.buildGetCurrentAppInfo(deviceId));
  const data = getResponseData(resp);

  return {
    success: resp.success,
    output: {
      appPackage: data?.packageName ?? data?.package ?? data?.appPackage ?? '',
      appActivity: data?.activityName ?? data?.activity ?? data?.appActivity ?? '',
    },
    error: resp.error,
  };
}

export async function executeAdbStep(
  client: LaixiClient,
  deviceId: string,
  resolvedParams: Record<string, unknown>
): Promise<StepExecutionResult> {
  const command = String(resolvedParams.command ?? '');
  const resp = await client.sendCommand(cmd.buildExecuteAdb(deviceId, command));
  const data = getResponseData(resp);

  return {
    success: resp.success,
    output: { command, result: data?.output ?? data?.result ?? '' },
    error: resp.error,
  };
}

export async function executeAutoJsStep(
  client: LaixiClient,
  deviceId: string,
  resolvedParams: Record<string, unknown>
): Promise<StepExecutionResult> {
  const filePath = String(resolvedParams.filePath ?? '');
  const resp = await client.sendCommand(cmd.buildExecuteAutoJs(deviceId, filePath));
  const data = getResponseData(resp);

  return {
    success: resp.success,
    output: { filePath, result: data?.output ?? data?.result ?? '' },
    error: resp.error,
  };
}

export function executeStopStep(resolvedParams: Record<string, unknown>): StepExecutionResult {
  const reason = String(resolvedParams.reason ?? 'Manual stop');
  return {
    success: false,
    output: { stopped: true, reason },
    error: `STOP: ${reason}`,
  };
}

export async function executeWaitStep(resolvedParams: Record<string, unknown>): Promise<StepExecutionResult> {
  const ms = Number(resolvedParams.ms ?? 1000);
  await new Promise((resolve) => setTimeout(resolve, ms));
  return { success: true, output: { waited: ms } };
}
