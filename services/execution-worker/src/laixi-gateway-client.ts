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

    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/dispatch-step`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

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
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to dispatch via gateway',
        deviceId,
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
}
