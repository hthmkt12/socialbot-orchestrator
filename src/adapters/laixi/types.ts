export type {
  LaixiCommandRequest as LaixiCommand,
  LaixiCommandResponse as LaixiResponse,
  LaixiDeviceInfo,
} from '../../../packages/shared/src';

export interface LaixiScreenshotResponse {
  base64: string;
  format: string;
  deviceId: string;
}

export interface LaixiAppInfo {
  packageName: string;
  activityName: string;
  deviceId: string;
}

export interface LaixiAdbResponse {
  output: string;
  exitCode: number;
  deviceId: string;
}

export interface LaixiAutoJsResponse {
  output: string;
  success: boolean;
  deviceId: string;
}

export type LaixiConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface LaixiClientOptions {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  commandTimeout?: number;
}
