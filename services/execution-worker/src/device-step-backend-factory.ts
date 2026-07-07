import { LaixiGatewayClient } from './laixi-gateway-client.js';
import { LaixiStepBackend } from './laixi-step-backend.js';
import { MobileMcpStepBackend } from './mobile-mcp-step-backend.js';
import { MobilerunStepBackend } from './mobilerun-step-backend.js';
import type { WorkerConfig } from './run-claim-coordinator.js';

export type DeviceBackendKind = 'laixi' | 'mobile-mcp' | 'mobilerun';

export function createDeviceStepBackend(config: WorkerConfig) {
  if (config.deviceBackend === 'mobilerun') {
    return new MobilerunStepBackend(config.mobileMcpBridgeUrl, config.commandTimeoutMs, config.bridgeToken);
  }
  if (config.deviceBackend === 'mobile-mcp') {
    return new MobileMcpStepBackend(config.mobileMcpBridgeUrl, config.commandTimeoutMs, config.bridgeToken);
  }

  return new LaixiStepBackend(new LaixiGatewayClient(config.gatewayBaseUrl, config.commandTimeoutMs));
}
