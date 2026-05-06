import type { DeviceFreshness, DeviceLifecycleStatus } from './device-lifecycle';

export const GATEWAY_PROTOCOL_VERSION = '1';

export type StepArtifactType =
  | 'SCREENSHOT'
  | 'LOG_BLOB'
  | 'SCRIPT_FILE'
  | 'JSON_RESULT';

export type WorkflowRunControlAction = 'start' | 'cancel';

export type WorkflowRunControlOutcome =
  | 'queued'
  | 'already_queued'
  | 'already_running'
  | 'already_waiting_approval'
  | 'cancelled'
  | 'already_cancelled'
  | 'already_finished';

export interface WorkflowRunControlRequest {
  runId: string;
  action: WorkflowRunControlAction;
}

export interface WorkflowRunControlSection {
  firstRequestedAt: string;
  lastRequestedAt: string;
  requestCount: number;
  lastObservedStatus: string;
  acceptedAt?: string;
}

export interface WorkflowRunClaimSection {
  executionOwner: string;
  claimToken: string;
  claimedAt: string;
  leaseExpiresAt: string;
  lastHeartbeatAt: string;
  lastObservedStatus: string;
  reclaimCount: number;
}

export interface WorkflowRunControlSummary {
  lastAction: WorkflowRunControlAction;
  lastActionAt: string;
  lastKnownRunStatus: string;
  dispatch?: WorkflowRunControlSection;
  cancel?: WorkflowRunControlSection;
  claim?: WorkflowRunClaimSection;
}

export interface WorkflowRunControlResponse {
  success: boolean;
  action: WorkflowRunControlAction;
  runId: string;
  status: string;
  outcome: WorkflowRunControlOutcome;
  replaySafe: true;
  control?: WorkflowRunControlSummary;
  error?: string;
}

export interface StepArtifactRef {
  type: StepArtifactType;
  contentType?: string;
  storageKey?: string;
  base64?: string;
}

export interface StepResultPayload {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  durationMs?: number;
  artifacts?: StepArtifactRef[];
}

export interface LaixiDeviceInfo {
  deviceId: string;
  deviceName: string;
  model: string;
  brand: string;
  androidVersion: string;
  screenWidth: number;
  screenHeight: number;
  batteryLevel?: number;
  isCharging?: boolean;
}

export type LaixiCommandAction =
  | 'All Info'
  | 'screen'
  | 'Screen Control'
  | 'OpenApp'
  | 'InputText'
  | 'ExecuteAdb'
  | 'ExecuteAutoJs'
  | 'CurrentAppInfo';

export interface LaixiCommandRequest {
  action: LaixiCommandAction;
  deviceIds?: string;
  params?: Record<string, unknown>;
  _requestId?: string;
  protocolVersion?: string;
}

export interface LaixiCommandResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  deviceId?: string;
  _requestId?: string;
  protocolVersion?: string;
  artifacts?: StepArtifactRef[];
}

export interface GatewayDeviceRegisterMessage {
  type: 'register';
  deviceId: string;
  deviceName: string;
}

export interface GatewayDeviceHeartbeatMessage {
  type: 'heartbeat';
  deviceId: string;
}

export interface GatewayStepDispatchMessage {
  type: 'dispatch_step';
  protocolVersion: string;
  requestId: string;
  runId: string;
  stepId: string;
  deviceId: string;
  command: LaixiCommandRequest;
}

export interface GatewayStepResultMessage {
  type: 'step_result';
  protocolVersion: string;
  requestId: string;
  runId: string;
  stepId: string;
  deviceId: string;
  result: StepResultPayload;
}

export type GatewayDispatchOutcome =
  | 'completed'
  | 'device_offline'
  | 'timed_out'
  | 'dispatch_failed'
  | 'connection_closed'
  | 'device_error'
  | 'invalid_result';

export interface GatewayDispatchRequest {
  runId: string;
  stepId: string;
  deviceId: string;
  command: LaixiCommandRequest;
  timeoutMs?: number;
}

export interface GatewayDispatchResponse {
  success: boolean;
  outcome: GatewayDispatchOutcome;
  requestId?: string;
  result?: LaixiCommandResponse;
  error?: string;
}

export interface GatewaySessionSnapshot {
  deviceId: string;
  deviceName: string;
  connectedAt: string;
  lastHeartbeatAt: string;
  pendingDispatchCount: number;
  protocolVersion: string;
  status?: DeviceLifecycleStatus;
  freshness?: DeviceFreshness;
  heartbeatAgeMs?: number | null;
  isHeartbeatStale?: boolean;
  lastError?: string;
  lastErrorAt?: string;
}

export interface GatewayRegisterAckMessage {
  type: 'register_ack';
  ok: true;
  protocolVersion: string;
  deviceId: string;
}

export interface GatewayHeartbeatAckMessage {
  type: 'heartbeat_ack';
  ok: true;
  protocolVersion: string;
  deviceId: string;
}

export interface GatewayErrorMessage {
  type: 'error';
  ok: false;
  protocolVersion: string;
  message: string;
  requestId?: string;
}

export type GatewayDeviceToServerMessage =
  | GatewayDeviceRegisterMessage
  | GatewayDeviceHeartbeatMessage
  | GatewayStepResultMessage;

export type GatewayServerToDeviceMessage =
  | GatewayRegisterAckMessage
  | GatewayHeartbeatAckMessage
  | GatewayStepDispatchMessage
  | GatewayErrorMessage;

export function isGatewayRegisterMessage(
  value: unknown
): value is GatewayDeviceRegisterMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'deviceId' in value &&
    value.type === 'register' &&
    typeof value.deviceId === 'string'
  );
}

export function isGatewayHeartbeatMessage(
  value: unknown
): value is GatewayDeviceHeartbeatMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'deviceId' in value &&
    value.type === 'heartbeat' &&
    typeof value.deviceId === 'string'
  );
}

export function isGatewayStepResultMessage(
  value: unknown
): value is GatewayStepResultMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'requestId' in value &&
    'result' in value &&
    value.type === 'step_result' &&
    typeof value.requestId === 'string' &&
    typeof value.result === 'object' &&
    value.result !== null
  );
}

export function buildGatewayErrorMessage(
  message: string,
  requestId?: string
): GatewayErrorMessage {
  return {
    type: 'error',
    ok: false,
    protocolVersion: GATEWAY_PROTOCOL_VERSION,
    message,
    requestId,
  };
}
