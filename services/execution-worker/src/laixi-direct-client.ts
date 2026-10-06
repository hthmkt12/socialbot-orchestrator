import WebSocket from 'ws';
import type { LaixiCommandRequest, LaixiCommandResponse } from '../../../packages/shared/src';
import type { DeviceCommandClient, DeviceDispatchContext } from './device-command-client.js';
import { withExponentialBackoff } from './retry-backoff.js';

interface PendingRequest {
  resolve: (response: LaixiCommandResponse) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class LaixiDirectClient implements DeviceCommandClient {
  private socket: WebSocket | null = null;
  private readonly pendingRequests = new Map<string, PendingRequest>();
  private requestCounter = 0;

  constructor(
    private readonly url: string,
    private readonly commandTimeoutMs: number
  ) {}

  async connect() {
    if (this.socket?.readyState === WebSocket.OPEN) return;
    if (this.socket?.readyState === WebSocket.CONNECTING) {
      await new Promise<void>((resolve, reject) => {
        this.socket?.once('open', () => resolve());
        this.socket?.once('error', (error) => reject(error));
      });
      return;
    }

    this.socket = new WebSocket(this.url);
    this.socket.on('message', (raw) => this.handleMessage(raw.toString()));
    this.socket.on('close', () => this.rejectAllPending('Laixi connection closed'));
    this.socket.on('error', () => this.rejectAllPending('Laixi connection error'));

    await new Promise<void>((resolve, reject) => {
      const socket = this.socket;
      if (!socket) {
        reject(new Error('Failed to create Laixi websocket'));
        return;
      }

      const onOpen = () => {
        socket.off('error', onError);
        resolve();
      };

      const onError = (error: Error) => {
        socket.off('open', onOpen);
        reject(error);
      };

      socket.once('open', onOpen);
      socket.once('error', onError);
    });
  }

  async disconnect() {
    if (!this.socket) return;
    const socket = this.socket;
    this.socket = null;
    this.rejectAllPending('Laixi connection closed');

    await new Promise<void>((resolve) => {
      socket.once('close', () => resolve());
      socket.close();
    }).catch(() => undefined);
  }

  async sendCommand(
    command: LaixiCommandRequest,
    context: DeviceDispatchContext
  ): Promise<LaixiCommandResponse> {
    const targetLabel = typeof command.deviceIds === 'string' ? command.deviceIds : (context.deviceId ?? 'device');

    try {
      return await withExponentialBackoff(
        async () => {
          await this.connect();
          const socket = this.socket;
          if (!socket || socket.readyState !== WebSocket.OPEN) {
            throw new Error('Not connected to Laixi (socket not open)');
          }

          const requestId = `worker_${++this.requestCounter}_${Date.now()}`;
          const payload = { ...command, _requestId: requestId };

          return await new Promise<LaixiCommandResponse>((resolve, reject) => {
            const timer = setTimeout(() => {
              this.pendingRequests.delete(requestId);
              reject(new Error(`Command timed out after ${this.commandTimeoutMs}ms`));
            }, this.commandTimeoutMs);

            this.pendingRequests.set(requestId, { resolve, timer });

            try {
              socket.send(JSON.stringify(payload));
            } catch (error) {
              clearTimeout(timer);
              this.pendingRequests.delete(requestId);
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          });
        },
        {
          operation: `laixi-direct-command:${targetLabel}`,
          maxRetries: 2,
          initialDelayMs: 300,
          shouldRetry: (err) => {
            if (err instanceof Error) {
              const msg = err.message.toLowerCase();
              return (
                msg.includes('not connected') ||
                msg.includes('socket not open') ||
                msg.includes('closed') ||
                msg.includes('connection error') ||
                msg.includes('econnrefused') ||
                msg.includes('socket hang up')
              );
            }
            return false;
          },
        }
      );
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send command to Laixi',
      };
    }
  }

  async sendCommands(commands: LaixiCommandRequest[], context: DeviceDispatchContext) {
    const responses: LaixiCommandResponse[] = [];
    for (const command of commands) {
      responses.push(await this.sendCommand(command, context));
    }
    return responses;
  }

  private handleMessage(raw: string) {
    try {
      const payload = JSON.parse(raw) as LaixiCommandResponse & { _requestId?: string };
      if (!payload._requestId) return;

      const pending = this.pendingRequests.get(payload._requestId);
      if (!pending) return;

      clearTimeout(pending.timer);
      this.pendingRequests.delete(payload._requestId);
      pending.resolve(payload);
    } catch {
      // Ignore malformed messages from the underlying socket.
    }
  }

  private rejectAllPending(message: string) {
    for (const [requestId, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timer);
      pending.resolve({ success: false, error: message, _requestId: requestId });
    }
    this.pendingRequests.clear();
  }
}
