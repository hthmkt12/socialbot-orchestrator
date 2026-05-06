export interface GatewaySessionView {
  deviceId: string;
  deviceName: string;
  status?: string;
  freshness?: string;
  lastHeartbeatAt?: string;
  lastError?: string;
}

export interface GatewayHealthView {
  service: string;
  status: string;
  protocolVersion: string;
  connectedDevices: number;
  pendingDispatches: number;
  deviceStatePersistenceEnabled?: boolean;
  sessions?: GatewaySessionView[];
}

export interface WorkerHealthView {
  service: string;
  status: string;
  gatewayBaseUrl: string;
  mobileMcpBridgeUrl?: string;
  deviceBackend?: string;
  gatewayProtocolVersion: string;
  pollIntervalMs: number;
  leaseTtlMs: number;
  activeClaimCount: number;
}

export interface MobileMcpBridgeHealthView {
  service: string;
  status: string;
  platform: string;
  sessionCount: number;
}

export interface MobileMcpDeviceView {
  id: string;
  status: string;
}

export type SetupProbeKind = 'current-app' | 'screenshot';

export interface SetupProbeResult {
  kind: SetupProbeKind;
  success: boolean;
  checkedAt: string;
  output?: Record<string, unknown>;
  error?: string;
  screenshotBase64?: string;
}
