import type { LaixiCommandRequest, LaixiCommandResponse } from '../../../packages/shared/src';

export interface DeviceDispatchContext {
  runId: string;
  stepId: string;
  deviceId: string;
}

export interface DeviceCommandClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendCommand(
    command: LaixiCommandRequest,
    context: DeviceDispatchContext
  ): Promise<LaixiCommandResponse>;
  sendCommands(
    commands: LaixiCommandRequest[],
    context: DeviceDispatchContext
  ): Promise<LaixiCommandResponse[]>;
}
