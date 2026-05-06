import { GATEWAY_PROTOCOL_VERSION } from '../../packages/shared/src';

export const GATEWAY_PROTOCOL_EXAMPLE = `// Device -> Gateway
{
  "type": "register",
  "deviceId": "ABC123",
  "deviceName": "Xiaomi Redmi Note 12"
}

// Device -> Gateway
{ "type": "heartbeat", "deviceId": "ABC123" }

// Gateway -> Device
{
  "type": "dispatch_step",
  "protocolVersion": "${GATEWAY_PROTOCOL_VERSION}",
  "requestId": "gw_12_1714825110000",
  "runId": "run-uuid",
  "stepId": "step-uuid",
  "deviceId": "ABC123",
  "command": {
    "action": "CurrentAppInfo",
    "deviceIds": "ABC123",
    "params": {},
    "protocolVersion": "${GATEWAY_PROTOCOL_VERSION}"
  }
}

// Device -> Gateway
{
  "type": "step_result",
  "protocolVersion": "${GATEWAY_PROTOCOL_VERSION}",
  "requestId": "gw_12_1714825110000",
  "runId": "run-uuid",
  "stepId": "step-uuid",
  "deviceId": "ABC123",
  "result": {
    "success": true,
    "output": { "packageName": "com.android.settings" }
  }
}`;
