import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'events';
import type { LaixiCommandRequest } from '../../../packages/shared/src';
import type { DeviceDispatchContext } from './device-command-client.js';

class MockWebSocket extends EventEmitter {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  sentData: string[] = [];

  constructor(public url: string) {
    super();
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.emit('open');
    }, 10);
  }

  send(data: string) {
    this.sentData.push(data);
    const parsed = JSON.parse(data) as { _requestId?: string; action?: string };
    if (parsed._requestId) {
      setTimeout(() => {
        this.emit(
          'message',
          JSON.stringify({
            success: true,
            _requestId: parsed._requestId,
            data: { echoed: parsed.action },
          })
        );
      }, 10);
    }
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.emit('close');
  }
}

let mockWsClass: typeof MockWebSocket = MockWebSocket;

vi.mock('ws', () => {
  return {
    default: class DynamicWsProxy {
      static OPEN = 1;
      static CONNECTING = 0;
      static CLOSED = 3;

      constructor(url: string) {
        return new mockWsClass(url);
      }
    },
  };
});

describe('LaixiDirectClient backoff & retry', () => {
  beforeEach(() => {
    mockWsClass = MockWebSocket;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('successfully sends command over direct websocket', async () => {
    const { LaixiDirectClient } = await import('./laixi-direct-client.js');
    const client = new LaixiDirectClient('ws://127.0.0.1:23333', 2000);
    const command: LaixiCommandRequest = {
      action: 'All Info',
      deviceIds: 'device-serial-abc',
    };
    const context: DeviceDispatchContext = {
      runId: 'run-1',
      stepId: 'step-1',
      deviceId: 'device-serial-abc',
    };

    const response = await client.sendCommand(command, context);
    expect(response.success).toBe(true);
    expect(response.data).toEqual({ echoed: 'All Info' });

    await client.disconnect();
  });

  it('retries when direct connection is initially not open and succeeds', async () => {
    let connectAttempts = 0;

    class FlakyWebSocket extends EventEmitter {
      static OPEN = 1;
      static CONNECTING = 0;
      static CLOSED = 3;

      readyState = MockWebSocket.CLOSED;

      constructor(public url: string) {
        super();
        connectAttempts++;
        if (connectAttempts === 1) {
          setTimeout(() => {
            this.emit('error', new Error('ECONNREFUSED'));
          }, 10);
        } else {
          setTimeout(() => {
            this.readyState = MockWebSocket.OPEN;
            this.emit('open');
          }, 10);
        }
      }

      send(data: string) {
        const parsed = JSON.parse(data) as { _requestId?: string };
        setTimeout(() => {
          this.emit(
            'message',
            JSON.stringify({
              success: true,
              _requestId: parsed._requestId,
            })
          );
        }, 10);
      }

      close() {
        this.readyState = MockWebSocket.CLOSED;
        this.emit('close');
      }
    }

    mockWsClass = FlakyWebSocket as unknown as typeof MockWebSocket;

    const { LaixiDirectClient } = await import('./laixi-direct-client.js');
    const client = new LaixiDirectClient('ws://127.0.0.1:23333', 2000);
    const command: LaixiCommandRequest = {
      action: 'All Info',
      deviceIds: 'device-serial-abc',
    };
    const context: DeviceDispatchContext = {
      runId: 'run-1',
      stepId: 'step-1',
      deviceId: 'device-serial-abc',
    };

    const response = await client.sendCommand(command, context);
    expect(connectAttempts).toBe(2);
    expect(response.success).toBe(true);

    await client.disconnect();
  });
});
