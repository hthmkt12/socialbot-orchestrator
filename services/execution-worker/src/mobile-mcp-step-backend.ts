import type { Device } from '../../../src/lib/database.types';
import type { StepArtifactRef } from '../../../packages/shared/src';
import type { StepExecutionResult } from './execute-device-step';
import type { DeviceStepBackend, DeviceStepExecutionArgs } from './device-step-backend';

interface MobileMcpBridgeResponse {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
}

const SUPPORTED_MOBILE_MCP_STEPS = new Set([
  'launch_app',
  'input_text',
  'tap',
  'swipe',
  'screenshot',
  'get_current_app',
  'adb',
]);

export class MobileMcpStepBackend implements DeviceStepBackend {
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

  async executeStep(args: DeviceStepExecutionArgs): Promise<StepExecutionResult> {
    if (args.step.type === 'wait') return this.wait(args);
    if (args.step.type === 'stop') {
      const reason = String(args.resolvedParams.reason ?? 'Manual stop');
      return { success: false, output: { stopped: true, reason }, error: `STOP: ${reason}` };
    }

    if (!SUPPORTED_MOBILE_MCP_STEPS.has(args.step.type)) {
      return {
        success: false,
        output: { backend: 'mobile-mcp', stepType: args.step.type },
        error: `Mobile MCP backend does not support step type: ${args.step.type}`,
      };
    }

    const serial = getDeviceSerial(args.device);
    const bridge = await this.postExecuteStep(serial, args);
    const output = bridge.output ?? {};
    const artifacts = extractArtifacts(output.artifacts);

    return {
      success: bridge.success,
      output: this.normalizeOutput(args.step.type, output, args.resolvedParams, serial),
      error: bridge.error,
      screenshotBase64: artifacts?.find((artifact) => artifact.type === 'SCREENSHOT')?.base64,
      artifacts,
    };
  }

  private async wait(args: DeviceStepExecutionArgs): Promise<StepExecutionResult> {
    const ms = Number(args.resolvedParams.ms ?? 1000);
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      if (await args.isCancelled()) {
        return { success: false, output: { waited: ms, cancelled: true }, error: 'Cancelled during wait' };
      }
      await new Promise((resolve) => setTimeout(resolve, Math.min(500, deadline - Date.now())));
    }
    return { success: true, output: { waited: ms } };
  }

  private async postExecuteStep(serial: string, args: DeviceStepExecutionArgs): Promise<MobileMcpBridgeResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.commandTimeoutMs);
    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/devices/${encodeURIComponent(serial)}/execute-step`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          runId: args.runId,
          stepId: args.step.id,
          stepType: args.step.type,
          params: args.resolvedParams,
          device: {
            id: args.device.id,
            serial,
            screenWidth: args.device.screen_width,
            screenHeight: args.device.screen_height,
          },
        }),
      });
      return (await response.json()) as MobileMcpBridgeResponse;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Mobile MCP bridge request failed',
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private normalizeOutput(
    stepType: string,
    bridgeOutput: Record<string, unknown>,
    resolvedParams: Record<string, unknown>,
    serial: string
  ) {
    if (stepType === 'get_current_app') {
      return {
        appPackage: bridgeOutput.package ?? '',
        appActivity: bridgeOutput.activity ?? '',
        backend: 'mobile-mcp',
        serial,
      };
    }
    if (stepType === 'screenshot') {
      return { captured: true, backend: 'mobile-mcp', serial, bridge: stripArtifacts(bridgeOutput) };
    }
    if (stepType === 'adb') {
      return {
        command: String(resolvedParams.command ?? ''),
        result: bridgeOutput.output ?? '',
        stderr: bridgeOutput.stderr ?? '',
        code: bridgeOutput.code ?? null,
        backend: 'mobile-mcp',
        serial,
      };
    }
    return { ...resolvedParams, backend: 'mobile-mcp', serial, bridge: stripArtifacts(bridgeOutput) };
  }
}

export function getDeviceSerial(device: Device) {
  return device.laixi_device_id;
}

function extractArtifacts(value: unknown): StepArtifactRef[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const artifacts = value.filter((artifact): artifact is StepArtifactRef => (
    typeof artifact === 'object' &&
    artifact !== null &&
    'type' in artifact
  ));
  return artifacts.length > 0 ? artifacts : undefined;
}

function stripArtifacts(output: Record<string, unknown>) {
  const safeOutput = { ...output };
  delete safeOutput.artifacts;
  return safeOutput;
}
