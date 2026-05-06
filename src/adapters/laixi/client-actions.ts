import type {
  LaixiAdbResponse,
  LaixiAppInfo,
  LaixiAutoJsResponse,
  LaixiCommand,
  LaixiDeviceInfo,
  LaixiResponse,
  LaixiScreenshotResponse,
} from './types';
import * as cmd from './commands';
import * as mapper from './mapper';

interface LaixiCommandTransport {
  sendCommand(command: LaixiCommand): Promise<LaixiResponse>;
  sendCommands(commands: LaixiCommand[]): Promise<LaixiResponse[]>;
}

export async function getAllInfo(transport: LaixiCommandTransport): Promise<LaixiDeviceInfo[]> {
  const resp = await transport.sendCommand(cmd.buildGetAllInfo());
  if (!resp.success || !resp.data) return [];

  const rawDevices = Array.isArray(resp.data) ? resp.data : [resp.data];
  return rawDevices.map((device: Record<string, unknown>) => mapper.mapToDeviceInfo(device));
}

export async function screenshot(
  transport: LaixiCommandTransport,
  deviceIds: string
): Promise<LaixiScreenshotResponse> {
  const resp = await transport.sendCommand(cmd.buildScreenshot(deviceIds));
  if (!resp.success) {
    throw new Error(resp.error ?? 'Screenshot failed');
  }
  return mapper.mapToScreenshotResponse(resp, deviceIds);
}

export async function tap(transport: LaixiCommandTransport, deviceIds: string, x: number, y: number): Promise<void> {
  const results = await transport.sendCommands(cmd.buildTap(deviceIds, x, y));
  const lastResult = results[results.length - 1];
  if (!lastResult?.success) {
    throw new Error(lastResult?.error ?? 'Tap failed');
  }
}

export async function swipe(
  transport: LaixiCommandTransport,
  deviceIds: string,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): Promise<void> {
  const results = await transport.sendCommands(cmd.buildSwipe(deviceIds, fromX, fromY, toX, toY));
  const lastResult = results[results.length - 1];
  if (!lastResult?.success) {
    throw new Error(lastResult?.error ?? 'Swipe failed');
  }
}

export async function launchApp(transport: LaixiCommandTransport, deviceIds: string, appName: string): Promise<void> {
  const resp = await transport.sendCommand(cmd.buildLaunchApp(deviceIds, appName));
  if (!resp.success) {
    throw new Error(resp.error ?? 'Launch app failed');
  }
}

export async function inputText(transport: LaixiCommandTransport, deviceIds: string, text: string): Promise<void> {
  const resp = await transport.sendCommand(cmd.buildInputText(deviceIds, text));
  if (!resp.success) {
    throw new Error(resp.error ?? 'Input text failed');
  }
}

export async function executeAdb(
  transport: LaixiCommandTransport,
  deviceIds: string,
  command: string
): Promise<LaixiAdbResponse> {
  const resp = await transport.sendCommand(cmd.buildExecuteAdb(deviceIds, command));
  if (!resp.success) {
    throw new Error(resp.error ?? 'ADB command failed');
  }
  return mapper.mapToAdbResponse(resp, deviceIds);
}

export async function runAutoX(
  transport: LaixiCommandTransport,
  deviceIds: string,
  filePath: string
): Promise<LaixiAutoJsResponse> {
  const resp = await transport.sendCommand(cmd.buildExecuteAutoJs(deviceIds, filePath));
  if (!resp.success) {
    throw new Error(resp.error ?? 'AutoX.js execution failed');
  }
  return mapper.mapToAutoJsResponse(resp, deviceIds);
}

export async function getCurrentApp(transport: LaixiCommandTransport, deviceIds: string): Promise<LaixiAppInfo> {
  const resp = await transport.sendCommand(cmd.buildGetCurrentAppInfo(deviceIds));
  if (!resp.success) {
    throw new Error(resp.error ?? 'Get current app failed');
  }
  return mapper.mapToAppInfo(resp, deviceIds);
}
