import { executeStepOnDevice } from '../adapters/laixi/mapper';
import type { LaixiClient } from '../adapters/laixi/client';
import type { MacroStep } from '../contracts/macro';
import { withTimeout } from './step-timeout';
import type { ExecutionContext } from './types';

export async function captureRunnerFailureScreenshot(
  client: LaixiClient,
  step: MacroStep,
  ctx: ExecutionContext
): Promise<string | null> {
  if (!ctx.onScreenshot) return null;

  try {
    const screenshotResult = await withTimeout(
      executeStepOnDevice(
        client,
        { id: `${step.id}_fail_ss`, type: 'screenshot', params: {} },
        ctx.device,
        {}
      ),
      step.id,
      5000
    );

    if (screenshotResult.screenshotBase64) {
      return await ctx.onScreenshot(`${step.id}_failure`, screenshotResult.screenshotBase64);
    }
  } catch {
    // best-effort
  }

  return null;
}
