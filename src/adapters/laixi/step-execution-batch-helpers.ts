import type { Device } from '../../lib/database.types';
import type { LaixiClient } from './client';
import * as cmd from './commands';
import type { StepExecutionResult } from './step-execution-helpers';

function resolveAbsoluteCoords(relative: number, screenDimension: number): number {
  return Math.round(relative * screenDimension);
}

function getLastBatchResult(results: Awaited<ReturnType<LaixiClient['sendCommands']>>) {
  return results[results.length - 1];
}

export async function executeTapStep(
  client: LaixiClient,
  device: Device,
  resolvedParams: Record<string, unknown>
): Promise<StepExecutionResult> {
  const relX = Number(resolvedParams.x ?? 0.5);
  const relY = Number(resolvedParams.y ?? 0.5);
  const absX = resolveAbsoluteCoords(relX, device.screen_width);
  const absY = resolveAbsoluteCoords(relY, device.screen_height);
  const tapCmds = cmd.buildTap(device.laixi_device_id, absX, absY);
  const lastResult = getLastBatchResult(await client.sendCommands(tapCmds));

  return {
    success: lastResult?.success ?? false,
    output: { x: absX, y: absY, relX, relY },
    error: lastResult?.error,
  };
}

export async function executeSwipeStep(
  client: LaixiClient,
  device: Device,
  resolvedParams: Record<string, unknown>
): Promise<StepExecutionResult> {
  const fX = resolveAbsoluteCoords(Number(resolvedParams.fromX ?? 0.5), device.screen_width);
  const fY = resolveAbsoluteCoords(Number(resolvedParams.fromY ?? 0.7), device.screen_height);
  const tX = resolveAbsoluteCoords(Number(resolvedParams.toX ?? 0.5), device.screen_width);
  const tY = resolveAbsoluteCoords(Number(resolvedParams.toY ?? 0.2), device.screen_height);
  const swipeCmds = cmd.buildSwipe(device.laixi_device_id, fX, fY, tX, tY);
  const lastResult = getLastBatchResult(await client.sendCommands(swipeCmds));

  return {
    success: lastResult?.success ?? false,
    output: { fromX: fX, fromY: fY, toX: tX, toY: tY },
    error: lastResult?.error,
  };
}
