import type { LaixiClientOptions, LaixiConnectionState, LaixiResponse } from './types';

export type ConnectionListener = (state: LaixiConnectionState) => void;
export type MessageListener = (data: unknown) => void;
export type PendingRequest = {
  resolve: (value: LaixiResponse) => void;
  timer: ReturnType<typeof setTimeout>;
};

export const DEFAULT_OPTIONS: Required<LaixiClientOptions> = {
  url: 'ws://127.0.0.1:22221/',
  reconnectInterval: 3000,
  maxReconnectAttempts: 10,
  commandTimeout: 15000,
};

export function isSocketOpenOrConnecting(ws: WebSocket | null) {
  return ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING);
}

export function createRequestId(requestCounter: number) {
  return `req_${requestCounter}_${Date.now()}`;
}

export function buildResponseFromData(data: Record<string, unknown>): LaixiResponse {
  return {
    success: data.success !== false,
    data: data.data ?? data,
    deviceId: data.deviceId as string | undefined,
  };
}

export function buildFailureResponse(error: string): LaixiResponse {
  return { success: false, error };
}

export function parseSocketMessage(message: unknown): Record<string, unknown> | null {
  if (typeof message !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(message);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export function bindSocketLifecycle(
  ws: WebSocket,
  {
    onClose,
    onError,
    onMessage,
    onOpen,
  }: {
    onClose: () => void;
    onError: () => void;
    onMessage: (data: Record<string, unknown>) => void;
    onOpen: () => void;
  }
) {
  ws.onopen = onOpen;
  ws.onclose = onClose;
  ws.onerror = onError;
  ws.onmessage = (event) => {
    const data = parseSocketMessage(event.data);
    if (data) {
      onMessage(data);
    }
  };
}

export function resolvePendingRequest(
  pendingRequests: Map<string, PendingRequest>,
  data: Record<string, unknown>
) {
  const requestId = data._requestId as string | undefined;
  if (!requestId) {
    return false;
  }

  const pending = pendingRequests.get(requestId);
  if (!pending) {
    return false;
  }

  clearTimeout(pending.timer);
  pendingRequests.delete(requestId);
  pending.resolve(buildResponseFromData(data));
  return true;
}
