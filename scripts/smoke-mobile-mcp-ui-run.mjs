import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const reportDir = join(rootDir, 'plans', 'reports');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const resultPath = join(reportDir, `ui-mobile-mcp-smoke-${timestamp}.json`);
const evidencePath = join(reportDir, `ui-mobile-mcp-smoke-db-${timestamp}.json`);

function loadDotEnv(path) {
  try {
    return Object.fromEntries(
      readFileSync(path, 'utf8')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const index = line.indexOf('=');
          return [line.slice(0, index), line.slice(index + 1)];
        })
    );
  } catch {
    return {};
  }
}

const env = { ...loadDotEnv(join(rootDir, '.env')), ...process.env };
const baseUrl = env.UI_SMOKE_BASE_URL ?? 'http://127.0.0.1:5173';
const macroName = env.UI_SMOKE_MACRO_NAME ?? 'Mobile MCP DB Multi Smoke';
const appName = env.UI_SMOKE_APP_NAME ?? 'com.android.settings';
const deviceMatches = (env.UI_SMOKE_DEVICE_MATCHES ?? '23106RN0DA,SM-A515F')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

function required(name, fallbackName) {
  const value = env[name] ?? (fallbackName ? env[fallbackName] : undefined);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function clickVisible(locator, timeout = 15000) {
  await locator.waitFor({ state: 'visible', timeout });
  await locator.click();
}

async function runUiFlow(email, password) {
  const browser = await chromium.launch({ headless: env.UI_SMOKE_HEADLESS !== 'false' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const consoleMessages = [];
  const badResponses = [];

  page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => consoleMessages.push(`pageerror: ${error.message}`));
  page.on('response', async (response) => {
    if (response.status() < 400) return;
    let body = '';
    try {
      body = (await response.text()).slice(0, 1000);
    } catch (error) {
      body = `READ_ERROR:${error instanceof Error ? error.message : String(error)}`;
    }
    badResponses.push({ url: response.url(), status: response.status(), body });
  });

  await page.goto(`${baseUrl}/runs`, { waitUntil: 'domcontentloaded' });
  if (!await page.getByText('Workflow Runs').isVisible({ timeout: 12000 }).catch(() => false)) {
    await page.getByPlaceholder('you@company.com').fill(email);
    await page.getByPlaceholder('Enter password').fill(password);
    await page.locator('button[type=submit]').click({ force: true });
    await page.getByText('Workflow Runs').waitFor({ timeout: 20000 });
  }

  await clickVisible(page.getByRole('button', { name: /New Run/i }));
  await page.getByText('New Workflow Run').waitFor({ timeout: 10000 });
  await page.getByPlaceholder('Search macros...').fill(macroName);
  await clickVisible(page.locator('button', { hasText: macroName }).first());
  await clickVisible(page.getByRole('button', { name: /Next/i }));
  await page.getByText(/Macro target contract: Multi Device/i).waitFor({ timeout: 10000 });

  for (const match of deviceMatches) {
    await clickVisible(page.locator('button', { hasText: match }).first());
  }
  await clickVisible(page.getByRole('button', { name: /Next/i }));

  const appInput = page.getByPlaceholder('Enter appName...');
  if (await appInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await appInput.fill(appName);
    await clickVisible(page.getByRole('button', { name: /Next/i }));
  }

  await page.getByText('Preflight passed').waitFor({ timeout: 10000 });
  await page.screenshot({ path: join(reportDir, `ui-mobile-mcp-preflight-${timestamp}.png`), fullPage: true });
  await clickVisible(page.getByRole('button', { name: /Execute Run/i }));
  await page.waitForURL(/\/runs\/[0-9a-f-]+(\/monitor)?$/i, { timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: join(reportDir, `ui-mobile-mcp-monitor-${timestamp}.png`), fullPage: true });
  const url = page.url();
  const runId = url.match(/\/runs\/([0-9a-f-]+)/i)?.[1] ?? null;
  await browser.close();
  return { runId, url, badResponses, consoleMessages };
}

async function verifyDb(email, password, runId) {
  const supabase = createClient(
    required('VITE_SUPABASE_URL'),
    required('VITE_SUPABASE_ANON_KEY')
  );
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  let run;
  let steps = [];
  let artifacts = [];
  for (let index = 0; index < Number(env.UI_SMOKE_DB_POLLS ?? 60); index++) {
    const runResult = await supabase.from('workflow_runs').select('*').eq('id', runId).single();
    if (runResult.error) throw runResult.error;
    run = runResult.data;
    const stepResult = await supabase.from('run_steps').select('*').eq('workflow_run_id', runId);
    if (stepResult.error) throw stepResult.error;
    steps = stepResult.data ?? [];
    const artifactResult = await supabase.from('artifacts').select('*').eq('workflow_run_id', runId);
    if (artifactResult.error) throw artifactResult.error;
    artifacts = artifactResult.data ?? [];
    if (['COMPLETED', 'FAILED', 'PARTIAL_SUCCESS', 'CANCELLED'].includes(run.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  const deviceIds = [...new Set(steps.map((step) => step.device_id))];
  const devices = deviceIds.length
    ? (await supabase.from('devices').select('id,laixi_device_id,name,model,status').in('id', deviceIds)).data ?? []
    : [];
  const deviceById = new Map(devices.map((device) => [device.id, device]));
  const failedSteps = steps.filter((step) => step.status === 'FAILED');
  const currentAppSteps = steps
    .filter((step) => step.step_type === 'get_current_app')
    .map((step) => ({ deviceSerial: deviceById.get(step.device_id)?.laixi_device_id, status: step.status, output: step.output_json }));
  const evidence = {
    checkedAt: new Date().toISOString(),
    run: { id: run.id, status: run.status, target_type: run.target_type, summary_json: run.summary_json },
    devices,
    stepCount: steps.length,
    successStepCount: steps.filter((step) => step.status === 'SUCCESS').length,
    artifactCount: artifacts.length,
    screenshotCount: artifacts.filter((artifact) => artifact.type === 'SCREENSHOT').length,
    currentAppSteps,
    failedSteps,
  };
  if (run.status !== 'COMPLETED') throw new Error(`Run finished with ${run.status}`);
  if (failedSteps.length) throw new Error(`Run has ${failedSteps.length} failed steps`);
  if (evidence.screenshotCount < deviceMatches.length) throw new Error(`Expected screenshots for ${deviceMatches.length} devices`);
  return evidence;
}

async function main() {
  mkdirSync(reportDir, { recursive: true });
  const email = required('UI_SMOKE_EMAIL');
  const password = required('UI_SMOKE_PASSWORD');
  const uiResult = await runUiFlow(email, password);
  writeFileSync(resultPath, JSON.stringify(uiResult, null, 2));
  if (!uiResult.runId) throw new Error('Run id not found after UI submit');
  if (uiResult.badResponses.length) throw new Error(`Unexpected HTTP errors: ${JSON.stringify(uiResult.badResponses)}`);
  const evidence = await verifyDb(email, password, uiResult.runId);
  writeFileSync(evidencePath, JSON.stringify({ uiResult, ...evidence }, null, 2));
  console.log(JSON.stringify({ resultPath, evidencePath, runId: uiResult.runId, status: evidence.run.status, stepCount: evidence.stepCount }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
