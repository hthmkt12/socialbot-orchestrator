import type {
  GatewayDispatchRequest,
  GatewayDispatchResponse,
  LaixiCommandRequest,
  LaixiCommandResponse,
} from '../../../packages/shared/src';
import type { DeviceCommandClient, DeviceDispatchContext } from './device-command-client';

export class LaixiGatewayClient implements DeviceCommandClient {
  constructor(
    private readonly baseUrl: string,
    private readonly commandTimeoutMs: number
  ) {}

  async connect() {
    return;
  }

  async disconnect() {
    return;
  }

  async sendCommand(
    command: LaixiCommandRequest,
    context: DeviceDispatchContext
  ): Promise<LaixiCommandResponse> {
    const deviceId = typeof command.deviceIds === 'string' ? command.deviceIds : context.deviceId;
    const payload: GatewayDispatchRequest = {
      runId: context.runId,
      stepId: context.stepId,
      deviceId,
      command,
      timeoutMs: this.commandTimeoutMs,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.commandTimeoutMs);

    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/dispatch-step`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status} ${response.statusText}`;
        if (response.status === 502) errorMessage = '502 Bad Gateway: Gateway server is down or unreachable';
        if (response.status === 504) errorMessage = '504 Gateway Timeout: Gateway server timed out';

        return {
          success: false,
          error: errorMessage,
          deviceId,
        };
      }

      const raw = (await response.json()) as GatewayDispatchResponse;
      if (!raw.success || !raw.result) {
        return {
          success: false,
          error: raw.error ?? `Gateway dispatch failed with outcome ${raw.outcome}`,
          deviceId,
          _requestId: raw.requestId,
        };
      }

      return raw.result;
    } catch (error) {
      const isAbort = error instanceof Error && error.name === 'AbortError';
      return {
        success: false,
        error: isAbort
          ? `Command timed out after ${this.commandTimeoutMs}ms`
          : (error instanceof Error ? error.message : 'Failed to dispatch via gateway'),
        deviceId,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async sendCommands(commands: LaixiCommandRequest[], context: DeviceDispatchContext) {
    const responses: LaixiCommandResponse[] = [];
    for (const command of commands) {
      responses.push(await this.sendCommand(command, context));
    }
    return responses;
  }
}
