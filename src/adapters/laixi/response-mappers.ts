import type {
  LaixiAdbResponse,
  LaixiAppInfo,
  LaixiAutoJsResponse,
  LaixiDeviceInfo,
  LaixiResponse,
  LaixiScreenshotResponse,
} from './types';

export function mapToDeviceInfo(raw: Record<string, unknown>): LaixiDeviceInfo {
  return {
    deviceId: String(raw.deviceId ?? raw.id ?? ''),
    deviceName: String(raw.deviceName ?? raw.name ?? ''),
    model: String(raw.model ?? ''),
    brand: String(raw.brand ?? ''),
    androidVersion: String(raw.androidVersion ?? raw.version ?? ''),
    screenWidth: Number(raw.screenWidth ?? raw.width ?? 0),
    screenHeight: Number(raw.screenHeight ?? raw.height ?? 0),
    batteryLevel: raw.batteryLevel != null ? Number(raw.batteryLevel) : undefined,
    isCharging: raw.isCharging != null ? Boolean(raw.isCharging) : undefined,
  };
}

export function mapToScreenshotResponse(response: LaixiResponse, deviceId: string): LaixiScreenshotResponse {
  const data = response.data as Record<string, unknown> | undefined;
  return {
    base64: String(data?.base64 ?? data?.screenshot ?? ''),
    format: String(data?.format ?? 'png'),
    deviceId: response.deviceId ?? deviceId,
  };
}

export function mapToAppInfo(response: LaixiResponse, deviceId: string): LaixiAppInfo {
  const data = response.data as Record<string, unknown> | undefined;
  return {
    packageName: String(data?.packageName ?? data?.package ?? data?.appPackage ?? ''),
    activityName: String(data?.activityName ?? data?.activity ?? data?.appActivity ?? ''),
    deviceId: response.deviceId ?? deviceId,
  };
}

export function mapToAdbResponse(response: LaixiResponse, deviceId: string): LaixiAdbResponse {
  const data = response.data as Record<string, unknown> | undefined;
  return {
    output: String(data?.output ?? data?.result ?? ''),
    exitCode: Number(data?.exitCode ?? data?.code ?? 0),
    deviceId: response.deviceId ?? deviceId,
  };
}

export function mapToAutoJsResponse(response: LaixiResponse, deviceId: string): LaixiAutoJsResponse {
  const data = response.data as Record<string, unknown> | undefined;
  return {
    output: String(data?.output ?? data?.result ?? ''),
    success: response.success,
    deviceId: response.deviceId ?? deviceId,
  };
}
