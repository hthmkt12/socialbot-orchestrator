import type { SupabaseClient } from '@supabase/supabase-js';
import { createLogArtifact, createScreenshotArtifact } from './worker-run-store.js';

export function extractInlineLogText(output: Record<string, unknown>): string | null {
  const candidates = [output.result, output.output, output.message];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return null;
}

export async function persistStepArtifacts(
  supabase: SupabaseClient,
  runId: string,
  deviceId: string,
  stepId: string,
  stepType: string,
  result: { screenshotBase64?: string | null; output: Record<string, unknown> },
  sensitiveValues: string[] = []
): Promise<string | null> {
  const screenshotArtifactId = result.screenshotBase64
    ? await createScreenshotArtifact(supabase, runId, deviceId, stepId, result.screenshotBase64)
    : null;

  const inlineLog = extractInlineLogText(result.output);
  if (inlineLog && (stepType === 'adb' || stepType === 'run_autox')) {
    await createLogArtifact(supabase, runId, deviceId, stepId, inlineLog, {
      stepType,
      source: 'step-output',
    }, sensitiveValues);
  }

  return screenshotArtifactId;
}
