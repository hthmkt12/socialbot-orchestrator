import { LaixiGatewayClient } from './laixi-gateway-client';
import { LaixiStepBackend } from './laixi-step-backend';
import { MobileMcpStepBackend } from './mobile-mcp-step-backend';
import { MobilerunStepBackend } from './mobilerun-step-backend';
import type { WorkerConfig } from './run-claim-coordinator';

export type DeviceBackendKind = 'laixi' | 'mobile-mcp' | 'mobilerun';

export function createDeviceStepBackend(config: WorkerConfig) {
  if (config.deviceBackend === 'mobilerun') {
    return new MobilerunStepBackend(config.mobileMcpBridgeUrl, config.commandTimeoutMs);
  }
  if (config.deviceBackend === 'mobile-mcp') {
    return new MobileMcpStepBackend(config.mobileMcpBridgeUrl, config.commandTimeoutMs);
  }

  return new LaixiStepBackend(new LaixiGatewayClient(config.gatewayBaseUrl, config.commandTimeoutMs));
}
