import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { exportSocialMacroToAutoJs } from '../../../../src/contracts/autojs-social-exporter';
import {
  compileSocialMacroToMacroDefinition,
  createSocialDraftPostMacro,
  validateSocialMacroDefinition,
  type SocialMacroDefinition,
  type SocialMacroStep,
} from '../../../../src/contracts/social-macro-dsl';
import type { MacroStep } from '../../../../src/contracts/macro';
import type { Device } from '../../../../src/lib/database.types';
import { MobileMcpStepBackend } from '../mobile-mcp-step-backend';
import { parseArgs, printUsage, readRecorderArgs, type RecorderArgs } from './record-social-macro-config';

const argv = parseArgs(process.argv.slice(2));

if (argv.help) {
  printUsage();
  process.exit(0);
}

void main().catch((error) => {
  console.error('[record-social-macro] FAIL', error);
  process.exit(1);
});

async function main() {
  const args = readRecorderArgs(argv);
  const socialMacro = await buildSocialMacro(args);
  const validation = validateSocialMacroDefinition(socialMacro);
  if (!validation.valid) throw new Error(`Invalid Social Macro DSL: ${validation.errors.join('; ')}`);

  const platformMacro = compileSocialMacroToMacroDefinition(socialMacro);
  const autoJs = exportSocialMacroToAutoJs(socialMacro);
  const report = args.dryRun
    ? { dryRun: true, executedSteps: [] }
    : await executeRecording(args, socialMacro.steps);

  await mkdir(args.outputDir, { recursive: true });
  await writeJson(path.join(args.outputDir, `${socialMacro.meta.key}.social-macro.json`), socialMacro);
  await writeJson(path.join(args.outputDir, `${socialMacro.meta.key}.macro.json`), platformMacro);
  await writeFile(path.join(args.outputDir, `${socialMacro.meta.key}.autojs.js`), autoJs);
  await writeJson(path.join(args.outputDir, `${socialMacro.meta.key}.recording-report.json`), report);

  console.log(`[record-social-macro] PASS output=${args.outputDir}`);
}

async function buildSocialMacro(args: RecorderArgs): Promise<SocialMacroDefinition> {
  const macro = createSocialDraftPostMacro({
    appPackage: args.appPackage,
    key: args.key,
    name: args.name,
  });
  if (args.stepsFile) {
    const raw = await readFile(args.stepsFile, 'utf8');
    macro.steps = JSON.parse(raw) as SocialMacroStep[];
  }
  return macro;
}

async function executeRecording(args: RecorderArgs, steps: SocialMacroStep[]) {
  if (!args.serial) throw new Error('serial is required unless --dry-run is set');
  const backend = new MobileMcpStepBackend(args.bridgeUrl, args.timeoutMs);
  const device = makeDevice(args.serial);
  const executedSteps: Array<Record<string, unknown>> = [];
  await backend.connect();
  try {
    for (const step of steps) {
      const result = await executeSocialStep(backend, device, step, args);
      executedSteps.push(result);
    }
  } finally {
    await backend.disconnect();
  }
  return { dryRun: false, serial: args.serial, executedSteps };
}

async function executeSocialStep(
  backend: MobileMcpStepBackend,
  device: Device,
  socialStep: SocialMacroStep,
  args: RecorderArgs
) {
  if (socialStep.action === 'review_gate') {
    return { id: socialStep.id, action: socialStep.action, skipped: true, reason: 'review gate is recorded, not executed' };
  }
  if (socialStep.action === 'publish' && !args.allowPublish) {
    return { id: socialStep.id, action: socialStep.action, skipped: true, reason: 'publish blocked by default' };
  }

  const macroStep = toExecutableMacroStep(socialStep, args);
  const result = await backend.executeStep({
    step: macroStep,
    runId: `record-social-macro-${Date.now()}`,
    device,
    resolvedParams: macroStep.params,
    isCancelled: async () => false,
  });
  if (!result.success) throw new Error(`${socialStep.id} failed: ${result.error ?? JSON.stringify(result.output)}`);
  return { id: socialStep.id, action: socialStep.action, output: result.output };
}

function toExecutableMacroStep(step: SocialMacroStep, args: RecorderArgs): MacroStep {
  if (step.action === 'launch_app') return { id: step.id, type: 'launch_app', params: { appName: args.appPackage } };
  if (step.action === 'wait') return { id: step.id, type: 'wait', params: { ms: step.ms ?? 1_000 } };
  if (step.action === 'screenshot') return { id: step.id, type: 'screenshot', params: { description: step.id, saveToArtifact: true } };
  if (step.action === 'tap' || step.action === 'publish') return { id: step.id, type: 'tap', params: targetCoords(step) };
  if (step.action === 'input_text') return { id: step.id, type: 'input_text', params: { text: resolveValue(step.value ?? '', args), ...targetCoords(step) } };
  if (step.action === 'verify_foreground_app') return { id: step.id, type: 'get_current_app', params: {} };
  return {
    id: step.id,
    type: 'swipe',
    params: {
      fromX: step.from?.x ?? 0.5,
      fromY: step.from?.y ?? 0.75,
      toX: step.to?.x ?? 0.5,
      toY: step.to?.y ?? 0.35,
    },
  };
}

function targetCoords(step: SocialMacroStep) {
  const fallback = step.target?.fallback;
  return fallback ? { x: fallback.x, y: fallback.y } : { x: 0.5, y: 0.5 };
}

function resolveValue(value: string, args: RecorderArgs) {
  return value.replace(/\{\{caption\}\}/g, args.caption);
}

function makeDevice(serial: string): Device {
  return {
    id: `record-social-${serial}`,
    laixi_device_id: serial,
    name: `Record Social ${serial}`,
    model: 'Android',
    brand: 'Android',
    android_version: '',
    screen_width: Number(process.env.MOBILE_MCP_SCREEN_WIDTH ?? 720),
    screen_height: Number(process.env.MOBILE_MCP_SCREEN_HEIGHT ?? 1600),
    status: 'ONLINE',
    last_seen_at: new Date().toISOString(),
    heartbeat_freshness: 'fresh',
    last_error_message: null,
    last_error_at: null,
    metadata_json: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function writeJson(filePath: string, value: unknown) {
  return writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
