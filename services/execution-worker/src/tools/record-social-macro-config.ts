import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

export interface RecorderArgs {
  serial?: string;
  bridgeUrl: string;
  appPackage: string;
  key?: string;
  name?: string;
  outputDir: string;
  stepsFile?: string;
  caption: string;
  timeoutMs: number;
  dryRun: boolean;
  allowPublish: boolean;
}

export function readRecorderArgs(argv: Record<string, string | boolean>): RecorderArgs {
  const appPackage = stringArg(argv, 'app-package', process.env.SOCIAL_APP_PACKAGE);
  if (!appPackage) throw new Error('--app-package or SOCIAL_APP_PACKAGE is required');
  const key = stringArg(argv, 'key');
  return {
    serial: stringArg(argv, 'serial', process.env.MOBILE_MCP_DEVICE_SERIAL),
    bridgeUrl: stringArg(argv, 'bridge-url', process.env.MOBILE_MCP_BRIDGE_URL) ?? 'http://127.0.0.1:4321',
    appPackage,
    key,
    name: stringArg(argv, 'name'),
    outputDir: resolveProjectPath(
      stringArg(argv, 'output-dir') ?? path.join('plans', 'social-macro-recordings', `${timestamp()}-${key ?? slug(appPackage)}`)
    ),
    stepsFile: stringArg(argv, 'steps-file'),
    caption: stringArg(argv, 'caption', process.env.SOCIAL_POST_CAPTION) ?? 'Draft from Laixi recorder',
    timeoutMs: Number(stringArg(argv, 'timeout-ms', process.env.DEVICE_COMMAND_TIMEOUT_MS) ?? 30_000),
    dryRun: Boolean(argv['dry-run']),
    allowPublish: process.env.SOCIAL_MACRO_ALLOW_PUBLISH === 'true' || Boolean(argv['allow-publish']),
  };
}

export function parseArgs(values: string[]) {
  const parsed: Record<string, string | boolean> = {};
  for (let index = 0; index < values.length; index++) {
    const value = values[index];
    if (!value.startsWith('--')) continue;
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index++;
    }
  }
  return parsed;
}

export function printUsage() {
  console.log(`Usage: npm run record:social-macro -- --app-package <package> [--serial <adb-serial>] [--dry-run]

Options:
  --app-package   Target Android social app package.
  --serial        Android serial for live Mobile MCP recording.
  --bridge-url    Mobile MCP bridge URL. Default: http://127.0.0.1:4321
  --caption       Caption used when executing input_text. Default is safe draft text.
  --output-dir    Directory for .social-macro.json, .macro.json, .autojs.js, and report.
  --steps-file    Optional JSON array of SocialMacroStep objects.
  --dry-run       Generate files without executing on a device.
  --allow-publish Execute publish tap. Default is blocked.
`);
}

function stringArg(argv: Record<string, string | boolean>, name: string, fallback?: string) {
  const value = argv[name];
  return typeof value === 'string' ? value : fallback;
}

function slug(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'social_macro';
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
}

function resolveProjectPath(value: string) {
  return path.isAbsolute(value) ? value : path.join(PROJECT_ROOT, value);
}
