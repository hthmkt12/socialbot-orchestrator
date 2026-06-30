import WebSocket from 'ws';
import {
  DEVICE_HEARTBEAT_INTERVAL_MS,
  buildGatewayErrorMessage,
  isGatewayHeartbeatMessage,
  isGatewayRegisterMessage,
  isGatewayStepResultMessage,
  resolveDeviceLifecycle,
  type GatewayDeviceToServerMessage,
  type GatewayDispatchRequest,
  type GatewayDispatchResponse,
  type GatewaySessionSnapshot,
  type GatewayStepDispatchMessage,
  type GatewayStepResultMessage,
  type LaixiCommandResponse,
} from '../../../packages/shared/src';
import { GatewayDeviceStateStore } from './gateway-device-state-store';

interface DeviceSession {
  socket: WebSocket;
  snapshot: GatewaySessionSnapshot;
  pendingRequestIds: Set<string>;
}

interface PendingDispatch {
  deviceId: string;
  resolve: (response: GatewayDispatchResponse) => void;
  timer: ReturnType<typeof setTimeout>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toLaixiCommandResponse(message: GatewayStepResultMessage): LaixiCommandResponse {
  const output = isRecord(message.result.output) ? { ...message.result.output } : {};
  const screenshotArtifact = message.result.artifacts?.find(
    (artifact) => artifact.type === 'SCREENSHOT' && typeof artifact.base64 === 'string'
  );

  if (screenshotArtifact?.base64 && typeof output.base64 !== 'string') {
    output.base64 = screenshotArtifact.base64;
  }

  return {
    success: message.result.success,
    data: output,
    error: message.result.error,
    deviceId: message.deviceId,
    _requestId: message.requestId,
    protocolVersion: message.protocolVersion,
    artifacts: message.result.artifacts,
  };
}

export class GatewaySessionManager {
  private readonly sessions = new Map<string, DeviceSession>();
  private readonly socketToDeviceId = new Map<WebSocket, string>();
  private readonly pendingDispatches = new Map<string, PendingDispatch>();
  private requestCounter = 0;
  private freshnessIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly protocolVersion: string,
    private readonly deviceStateStore?: GatewayDeviceStateStore
  ) {}

  attachSocket(socket: WebSocket) {
    socket.on('message', (raw) => this.handleMessage(socket, raw.toString()));
    socket.on('close', () => this.handleSocketClose(socket, 'Device session closed'));
    socket.on('error', (error) =>
      this.handleSocketClose(socket, error instanceof Error ? error.message : 'Device session error')
    );
  }

  startFreshnessLoop(intervalMs: number = DEVICE_HEARTBEAT_INTERVAL_MS) {
    this.stopFreshnessLoop();
    this.freshnessIntervalId = setInterval(() => {
      for (const deviceId of this.sessions.keys()) {
        void this.persistSessionHealth(deviceId);
      }
    }, intervalMs);
    this.freshnessIntervalId.unref();
  }

  stopFreshnessLoop() {
    if (this.freshnessIntervalId) {
      clearInterval(this.freshnessIntervalId);
      this.freshnessIntervalId = null;
    }
  }

  getSessionSnapshots() {
    return Array.from(this.sessions.values()).map((session) => this.toSessionSnapshot(session));
  }

  getHealthSnapshot() {
    return {
      connectedDevices: this.sessions.size,
      pendingDispatches: this.pendingDispatches.size,
      deviceStatePersistenceEnabled: this.deviceStateStore?.isEnabled() ?? false,
      sessions: this.getSessionSnapshots(),
    };
  }

  async dispatch(request: GatewayDispatchRequest): Promise<GatewayDispatchResponse> {
    const session = this.sessions.get(request.deviceId);
    if (!session || session.socket.readyState !== WebSocket.OPEN) {
      return { success: false, outcome: 'device_offline', error: `No active session for device ${request.deviceId}` };
    }

    const lifecycle = this.resolveSessionLifecycle(session);
    if (lifecycle.isHeartbeatOffline) {
      return { success: false, outcome: 'device_offline', error: `Heartbeat is offline for device ${request.deviceId}` };
    }

    const requestId = `gw_${++this.requestCounter}_${Date.now()}`;
    const message: GatewayStepDispatchMessage = {
      type: 'dispatch_step',
      protocolVersion: this.protocolVersion,
      requestId,
      runId: request.runId,
      stepId: request.stepId,
      deviceId: request.deviceId,
      command: request.command,
    };

    return new Promise<GatewayDispatchResponse>((resolve) => {
      const timer = setTimeout(() => {
        session.pendingRequestIds.delete(requestId);
        this.pendingDispatches.delete(requestId);
        this.noteSessionError(session, `Gateway dispatch timed out after ${request.timeoutMs ?? 15000}ms`);
        void this.persistSessionHealth(request.deviceId);
        resolve({ success: false, outcome: 'timed_out', requestId, error: `Gateway dispatch timed out after ${request.timeoutMs ?? 15000}ms` });
      }, request.timeoutMs ?? 15000);

      this.pendingDispatches.set(requestId, { deviceId: request.deviceId, resolve, timer });
      session.pendingRequestIds.add(requestId);
      void this.persistSessionHealth(request.deviceId);

      try {
        session.socket.send(JSON.stringify(message), (error) => {
          if (!error) return;
          clearTimeout(timer);
          session.pendingRequestIds.delete(requestId);
          this.pendingDispatches.delete(requestId);
          const messageText = error instanceof Error ? error.message : 'Failed to dispatch device step';
          this.noteSessionError(session, messageText);
          void this.persistSessionHealth(request.deviceId);
          resolve({
            success: false,
            outcome: 'dispatch_failed',
            requestId,
            error: messageText,
          });
        });
      } catch (error) {
        clearTimeout(timer);
        session.pendingRequestIds.delete(requestId);
        this.pendingDispatches.delete(requestId);
        const messageText = error instanceof Error ? error.message : 'Failed to dispatch device step';
        this.noteSessionError(session, messageText);
        void this.persistSessionHealth(request.deviceId);
        resolve({
          success: false,
          outcome: 'dispatch_failed',
          requestId,
          error: messageText,
        });
      }
    });
  }

  private handleMessage(socket: WebSocket, raw: string) {
    try {
      const payload = JSON.parse(raw) as GatewayDeviceToServerMessage;
      if (isGatewayRegisterMessage(payload)) {
        this.handleRegister(socket, payload.deviceId, payload.deviceName || payload.deviceId);
        return;
      }
      if (isGatewayHeartbeatMessage(payload)) {
        this.handleHeartbeat(payload.deviceId);
        return;
      }
      if (isGatewayStepResultMessage(payload)) {
        this.handleStepResult(payload);
        return;
      }
      socket.send(JSON.stringify(buildGatewayErrorMessage('Unsupported gateway message type')));
    } catch (error) {
      socket.send(JSON.stringify(buildGatewayErrorMessage(error instanceof Error ? error.message : String(error))));
    }
  }

  private handleRegister(socket: WebSocket, deviceId: string, deviceName: string) {
    const existing = this.sessions.get(deviceId);
    if (existing && existing.socket !== socket) {
      existing.socket.close(4000, 'Replaced by newer device session');
      this.rejectPendingForDevice(deviceId, 'connection_closed', 'Replaced by newer device session');
    }

    this.socketToDeviceId.set(socket, deviceId);
    this.sessions.set(deviceId, {
      socket,
      snapshot: {
        deviceId,
        deviceName,
        connectedAt: new Date().toISOString(),
        lastHeartbeatAt: new Date().toISOString(),
        pendingDispatchCount: 0,
        protocolVersion: this.protocolVersion,
      },
      pendingRequestIds: new Set(),
    });

    void this.persistSessionHealth(deviceId);
    socket.send(JSON.stringify({ type: 'register_ack', ok: true, protocolVersion: this.protocolVersion, deviceId }));
  }

  private handleHeartbeat(deviceId: string) {
    const session = this.sessions.get(deviceId);
    if (!session) return;
    session.snapshot.lastHeartbeatAt = new Date().toISOString();
    void this.persistSessionHealth(deviceId);
    session.socket.send(JSON.stringify({ type: 'heartbeat_ack', ok: true, protocolVersion: this.protocolVersion, deviceId }));
  }

  private handleStepResult(payload: GatewayStepResultMessage) {
    const pending = this.pendingDispatches.get(payload.requestId);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pendingDispatches.delete(payload.requestId);

    const session = this.sessions.get(pending.deviceId);
    session?.pendingRequestIds.delete(payload.requestId);

    const result = toLaixiCommandResponse(payload);
    if (session) {
      session.snapshot.lastHeartbeatAt = new Date().toISOString();
      if (result.success) {
        session.snapshot.lastError = undefined;
        session.snapshot.lastErrorAt = undefined;
      } else {
        this.noteSessionError(session, result.error ?? 'Device reported an error');
      }
      void this.persistSessionHealth(pending.deviceId);
    }

    pending.resolve({
      success: result.success,
      outcome: result.success ? 'completed' : 'device_error',
      requestId: payload.requestId,
      result,
      error: result.error,
    });
  }

  private handleSocketClose(socket: WebSocket, reason: string) {
    const deviceId = this.socketToDeviceId.get(socket);
    if (!deviceId) return;

    this.socketToDeviceId.delete(socket);
    const session = this.sessions.get(deviceId);
    if (!session || session.socket !== socket) return;

    this.sessions.delete(deviceId);
    void this.persistOfflineSessionHealth(session);
    this.rejectPendingForDevice(deviceId, 'connection_closed', reason);
  }

  private rejectPendingForDevice(deviceId: string, outcome: GatewayDispatchResponse['outcome'], error: string) {
    const session = this.sessions.get(deviceId);
    if (session && outcome !== 'connection_closed') {
      this.noteSessionError(session, error);
      void this.persistSessionHealth(deviceId);
    }

    for (const [requestId, pending] of this.pendingDispatches.entries()) {
      if (pending.deviceId !== deviceId) continue;
      clearTimeout(pending.timer);
      this.pendingDispatches.delete(requestId);
      pending.resolve({ success: false, outcome, requestId, error });
    }
  }

  private noteSessionError(session: DeviceSession, message: string) {
    session.snapshot.lastError = message;
    session.snapshot.lastErrorAt = new Date().toISOString();
  }

  private resolveSessionLifecycle(session: DeviceSession) {
    const rawStatus =
      session.pendingRequestIds.size > 0 ? 'BUSY' :
      session.snapshot.lastError ? 'ERROR' :
      'ONLINE';
    return resolveDeviceLifecycle({
      status: rawStatus,
      lastSeenAt: session.snapshot.lastHeartbeatAt,
      lastErrorMessage: session.snapshot.lastError,
    });
  }

  private toSessionSnapshot(session: DeviceSession): GatewaySessionSnapshot {
    const lifecycle = this.resolveSessionLifecycle(session);
    return {
      ...session.snapshot,
      pendingDispatchCount: session.pendingRequestIds.size,
      status: lifecycle.displayStatus,
      freshness: lifecycle.freshness,
      heartbeatAgeMs: lifecycle.heartbeatAgeMs,
      isHeartbeatStale: lifecycle.isHeartbeatStale,
    };
  }

  private async persistSessionHealth(deviceId: string) {
    const session = this.sessions.get(deviceId);
    if (!session || !this.deviceStateStore?.isEnabled()) return;

    const snapshot = this.toSessionSnapshot(session);
    await this.deviceStateStore.upsertDeviceHealth({
      laixiDeviceId: snapshot.deviceId,
      deviceName: snapshot.deviceName,
      status: snapshot.status ?? 'OFFLINE',
      heartbeatFreshness: snapshot.freshness ?? 'offline',
      lastSeenAt: snapshot.lastHeartbeatAt,
      ...(snapshot.lastError ? { lastErrorMessage: snapshot.lastError } : {}),
      ...(snapshot.lastErrorAt ? { lastErrorAt: snapshot.lastErrorAt } : {}),
    }).catch((error) => {
      console.error('[laixi-gateway] failed to persist device health', error);
    });
  }

  private async persistOfflineSessionHealth(session: DeviceSession) {
    if (!this.deviceStateStore?.isEnabled()) return;

    await this.deviceStateStore.upsertDeviceHealth({
      laixiDeviceId: session.snapshot.deviceId,
      deviceName: session.snapshot.deviceName,
      status: 'OFFLINE',
      heartbeatFreshness: 'offline',
      lastSeenAt: session.snapshot.lastHeartbeatAt,
      ...(session.snapshot.lastError ? { lastErrorMessage: session.snapshot.lastError } : {}),
      ...(session.snapshot.lastErrorAt ? { lastErrorAt: session.snapshot.lastErrorAt } : {}),
    }).catch((error) => {
      console.error('[laixi-gateway] failed to persist offline device health', error);
    });
  }
}
