import { executeDeviceStep } from './execute-device-step.js';
import type { DeviceCommandClient } from './device-command-client.js';
import type { DeviceStepBackend, DeviceStepExecutionArgs } from './device-step-backend.js';

export class LaixiStepBackend implements DeviceStepBackend {
  constructor(private readonly client: DeviceCommandClient) {}

  async connect() {
    await this.client.connect();
  }

  async disconnect() {
    await this.client.disconnect();
  }

  async executeStep(args: DeviceStepExecutionArgs) {
    return executeDeviceStep(
      this.client,
      args.step,
      args.runId,
      args.device,
      args.resolvedParams,
      args.isCancelled
    );
  }
}
