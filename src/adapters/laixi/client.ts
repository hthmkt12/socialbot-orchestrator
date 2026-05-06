import * as actions from './client-actions';
import {
  bindSocketLifecycle,
  buildFailureResponse,
  ConnectionListener,
  createRequestId,
  DEFAULT_OPTIONS,
  isSocketOpenOrConnecting,
  MessageListener,
  PendingRequest,
  resolvePendingRequest,
} from './client-transport-helpers';
import type { LaixiAdbResponse, LaixiAppInfo, LaixiAutoJsResponse, LaixiClientOptions, LaixiCommand, LaixiConnectionState, LaixiDeviceInfo, LaixiResponse, LaixiScreenshotResponse } from './types';

export class LaixiClient {
  private ws: WebSocket | null = null;
  private options: Required<LaixiClientOptions>;
  private state: LaixiConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectionListeners = new Set<ConnectionListener>();
  private messageListeners = new Set<MessageListener>();
  private pendingRequests = new Map<string, PendingRequest>();
  private requestCounter = 0;

  constructor(options?: Partial<LaixiClientOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  get connectionState(): LaixiConnectionState {
    return this.state;
  }

  onConnectionChange(listener: ConnectionListener): () => void {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  onMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  connect(): void {
    if (isSocketOpenOrConnecting(this.ws)) {
      return;
    }

    this.setState('connecting');

    try {
      this.ws = new WebSocket(this.options.url);
      bindSocketLifecycle(this.ws, {
        onOpen: () => {
          this.setState('connected');
          this.reconnectAttempts = 0;
        },
        onClose: () => {
          this.setState('disconnected');
          this.attemptReconnect();
        },
        onError: () => {
          this.setState('error');
        },
        onMessage: (data) => {
          this.messageListeners.forEach((listener) => listener(data));
          resolvePendingRequest(this.pendingRequests, data);
        },
      });
    } catch {
      this.setState('error');
      this.attemptReconnect();
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = this.options.maxReconnectAttempts;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setState('disconnected');
  }

  private setState(state: LaixiConnectionState): void {
    this.state = state;
    this.connectionListeners.forEach((l) => l(state));
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) return;
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.options.reconnectInterval);
  }

  async sendCommand(command: LaixiCommand): Promise<LaixiResponse> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return buildFailureResponse('Not connected to Laixi');
    }

    const requestId = createRequestId(++this.requestCounter);

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        resolve(buildFailureResponse('Command timed out'));
      }, this.options.commandTimeout);

      this.pendingRequests.set(requestId, { resolve, timer });

      const payload = JSON.stringify({ ...command, _requestId: requestId });
      try {
        this.ws!.send(payload);
      } catch (err) {
        clearTimeout(timer);
        this.pendingRequests.delete(requestId);
        resolve(buildFailureResponse(err instanceof Error ? err.message : 'Send failed'));
      }
    });
  }

  async sendCommands(commands: LaixiCommand[]): Promise<LaixiResponse[]> {
    const results: LaixiResponse[] = [];
    for (const command of commands) {
      results.push(await this.sendCommand(command));
    }
    return results;
  }

  async getAllInfo(): Promise<LaixiDeviceInfo[]> { return actions.getAllInfo(this); }

  async screenshot(deviceIds: string): Promise<LaixiScreenshotResponse> { return actions.screenshot(this, deviceIds); }

  async tap(deviceIds: string, x: number, y: number): Promise<void> { return actions.tap(this, deviceIds, x, y); }

  async swipe(deviceIds: string, fromX: number, fromY: number, toX: number, toY: number): Promise<void> {
    return actions.swipe(this, deviceIds, fromX, fromY, toX, toY);
  }

  async launchApp(deviceIds: string, appName: string): Promise<void> { return actions.launchApp(this, deviceIds, appName); }

  async inputText(deviceIds: string, text: string): Promise<void> { return actions.inputText(this, deviceIds, text); }

  async executeAdb(deviceIds: string, command: string): Promise<LaixiAdbResponse> {
    return actions.executeAdb(this, deviceIds, command);
  }

  async runAutoX(deviceIds: string, filePath: string): Promise<LaixiAutoJsResponse> {
    return actions.runAutoX(this, deviceIds, filePath);
  }

  async getCurrentApp(deviceIds: string): Promise<LaixiAppInfo> {
    return actions.getCurrentApp(this, deviceIds);
  }
}

let _defaultClient: LaixiClient | null = null;

export function getLaixiClient(): LaixiClient {
  if (!_defaultClient) {
    _defaultClient = new LaixiClient();
  }
  return _defaultClient;
}
