import { MobileMcpStepBackend, getDeviceSerial } from './mobile-mcp-step-backend';
import type { StepExecutionResult } from './execute-device-step';
import type { DeviceStepExecutionArgs } from './device-step-backend';

const AI_TASK_TIMEOUT_MS = 300_000; // 5 min default for LLM-driven tasks

/**
 * MobilerunStepBackend — extends MobileMcpStepBackend with ai_task support.
 *
 * All individual steps (tap, swipe, launch_app, etc.) delegate to the
 * parent class which POSTs them to the mobile-mcp-bridge.  The `ai_task`
 * step instead sends a natural-language *goal* that the bridge's Python
 * MobileAgent executes autonomously on the device.
 */
export class MobilerunStepBackend extends MobileMcpStepBackend {
  constructor(baseUrl: string, commandTimeoutMs: number) {
    super(baseUrl, commandTimeoutMs);
  }

  override async executeStep(args: DeviceStepExecutionArgs): Promise<StepExecutionResult> {
    if (args.step.type === 'ai_task') {
      return this.executeAiTask(args);
    }
    return super.executeStep(args);
  }

  private async executeAiTask(args: DeviceStepExecutionArgs): Promise<StepExecutionResult> {
    const serial = getDeviceSerial(args.device);
    const goal = String(args.resolvedParams.goal ?? '');
    if (!goal) {
      return { success: false, output: {}, error: 'ai_task requires a non-empty "goal" param' };
    }

    const timeoutMs = Number(args.resolvedParams.timeout ?? AI_TASK_TIMEOUT_MS);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const platform = typeof args.device.metadata_json?.platform === 'string'
      ? args.device.metadata_json.platform
      : 'android';

    try {
      const response = await fetch(
        `${this.baseUrl.replace(/\/$/, '')}/devices/${encodeURIComponent(serial)}/execute-step`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            runId: args.runId,
            stepId: args.step.id,
            stepType: 'ai_task',
            params: { goal, timeout: timeoutMs },
            device: {
              id: args.device.id,
              serial,
              platform,
              screenWidth: args.device.screen_width,
              screenHeight: args.device.screen_height,
            },
          }),
        },
      );

      const bridge = (await response.json()) as Record<string, unknown>;
      const output = (bridge.output ?? {}) as Record<string, unknown>;

      return {
        success: bridge.success === true,
        output: {
          goal,
          reason: output.reason ?? '',
          steps: output.steps ?? 0,
          structuredOutput: output.structured_output ?? null,
          backend: 'mobilerun',
          serial,
        },
        error: bridge.success ? undefined : String(bridge.error ?? 'ai_task failed'),
      };
    } catch (error) {
      return {
        success: false,
        output: { goal, backend: 'mobilerun', serial },
        error: error instanceof Error ? error.message : 'ai_task request failed',
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
