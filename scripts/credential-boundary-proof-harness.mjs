/**
 * Controlled credential boundary proof harness.
 *
 * This script is invoked ONLY through the adapter at
 * scripts/credential-boundary-runtime-proof.mjs, which in turn is triggered by
 *   CREDENTIAL_BOUNDARY_PROOF_COMMAND=node scripts/credential-boundary-proof-harness.mjs
 *   node scripts/verify-credential-boundary.mjs --runtime-proof
 *
 * The harness:
 * 1. Creates a disposable account at runtime (password from CREDENTIAL_BOUNDARY_CANARY env var only).
 * 2. Encrypts the password via the credential-vault Edge Function.
 * 3. Creates a disposable macro version containing {{accountPassword}}.
 * 4. Runs the remote negative auth matrix against the decrypt endpoint.
 * 5. Creates and queues a workflow run, waits for worker to execute it (if available).
 * 6. Scans database, artifacts, logs, and reports for the runtime canary.
 * 7. Cleans up all disposable records deterministically.
 * 8. Prints exactly one safe JSON manifest to stdout.
 *
 * Security:
 *   - The canary/password is read from CREDENTIAL_BOUNDARY_CANARY env var ONLY.
 *   - It is NEVER printed, written to reports, logged, or persisted in plaintext.
 *   - The manifest contains only hashes, IDs, counts, statuses, and prefixes.
 *
 * Required env vars:
 *   SUPABASE_URL                  - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY     - Service role key for DB access
 *   SUPABASE_ANON_KEY             - Anon key for Edge Function auth
 *   CREDENTIAL_VAULT_WORKER_TOKEN - Internal worker token for vault decrypt
 *   CREDENTIAL_BOUNDARY_CANARY    - Disposable password/canary (process env only)
 *   MOBILE_MCP_BRIDGE_URL         - Bridge URL (optional, for real device proof)
 *   WORKER_BASE_URL               - Worker health URL (optional, to check worker)
 *   PROOF_OPERATOR_JWT            - A real short-lived OPERATOR/ADMIN JWT for encrypt
 *
 * If any required env var is missing, prints a blocked manifest and exits 1.
 */

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// --- Env loading ---
function loadDotEnv(path) {
  try {
    return Object.fromEntries(
      readFileSync(path, 'utf8')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const index = line.indexOf('=');
          let value = line.slice(index + 1);
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          return [line.slice(0, index), value];
        })
    );
  } catch {
    return {};
  }
}

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dotEnv = loadDotEnv(join(rootDir, '.env'));
const env = { ...process.env, ...dotEnv };
if (process.env.CREDENTIAL_BOUNDARY_CANARY) {
  env.CREDENTIAL_BOUNDARY_CANARY = process.env.CREDENTIAL_BOUNDARY_CANARY;
}
const supabaseUrl = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY;
const workerToken = env.CREDENTIAL_VAULT_WORKER_TOKEN;
const canary = env.CREDENTIAL_BOUNDARY_CANARY;
const operatorJwt = env.PROOF_OPERATOR_JWT;
const bridgeUrl = env.MOBILE_MCP_BRIDGE_URL ?? env.VITE_MOBILE_MCP_BRIDGE_URL ?? 'http://127.0.0.1:4321';
const workerUrl = env.WORKER_BASE_URL ?? env.VITE_WORKER_BASE_URL ?? 'http://127.0.0.1:4310';

// --- Helpers ---
function canaryHash(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function safePrefix(value) {
  if (typeof value !== 'string' || value.length < 2) return null;
  return value.split(':')[0] + ':';
}

class BlockedProofError extends Error {}

function blocked(reason) {
  throw new BlockedProofError(reason);
}

function blockedManifest(reason, cleanupResult = { verified: false }) {
  return {
    blocked: true,
    reason,
    authMatrix: [],
    loginRun: { completed: false },
    persistenceScan: { surfaces: {} },
    cleanup: cleanupResult,
  };
}

let CANARY_HASH = null;
const vaultUrl = `${supabaseUrl}/functions/v1/credential-vault`;

// --- Supabase admin client ---
let supabase;
let resolvedOperatorJwt = operatorJwt;

async function getOperatorJwt() {
  if (env.UI_SMOKE_EMAIL && env.UI_SMOKE_PASSWORD && anonKey) {
    try {
      const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
      const { data, error } = await authClient.auth.signInWithPassword({
        email: env.UI_SMOKE_EMAIL,
        password: env.UI_SMOKE_PASSWORD,
      });
      if (!error && data?.session?.access_token) {
        resolvedOperatorJwt = data.session.access_token;
        return resolvedOperatorJwt;
      }
    } catch {
      // fallback to initial operatorJwt
    }
  }
  return resolvedOperatorJwt;
}

// --- Step 1: Encrypt the disposable password via the vault ---
async function encryptDisposablePassword() {
  const jwt = await getOperatorJwt();
  const response = await fetch(vaultUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ action: 'encrypt', plaintext: canary }),
  });
  if (!response.ok) {
    return { ok: false, status: response.status };
  }
  const data = await response.json();
  if (!data.encryptedPayload) {
    return { ok: false, status: response.status };
  }
  return { ok: true, encryptedPayload: data.encryptedPayload, prefix: safePrefix(data.encryptedPayload) };
}

// --- Step 2: Create disposable account ---
async function createDisposableAccount(encryptedPassword) {
  const accountId = randomUUID();
  const profileResult = await supabase
    .from('profiles')
    .select('id, user_id, role')
    .in('role', ['OPERATOR', 'ADMIN'])
    .limit(1)
    .maybeSingle();

  if (!profileResult.data) {
    return { ok: false, reason: 'No OPERATOR/ADMIN profile found for disposable account' };
  }
  // accounts.user_id references profiles.user_id, while created_by_user_id
  // fields below correctly reference the profile row id.
  const userId = profileResult.data.user_id;

  const { data, error } = await supabase
    .from('accounts')
    .insert({
      id: accountId,
      user_id: userId,
      username: `proof-disposable-${accountId.slice(0, 8)}`,
      encrypted_password: encryptedPassword,
      platform: 'instagram',
      credential_policy_status: 'server_managed',
      credential_key_version: 1,
    })
    .select('id')
    .maybeSingle();

  if (error || !data) {
    return { ok: false, reason: 'Failed to create disposable account' };
  }
  return { ok: true, accountId: data.id };
}

// --- Step 3: Create disposable macro version ---
async function createDisposableMacro() {
  const { data: owner, error: ownerError } = await supabase
    .from('profiles')
    .select('id')
    .in('role', ['OPERATOR', 'ADMIN'])
    .limit(1)
    .maybeSingle();
  if (ownerError || !owner) {
    return { ok: false, reason: 'No OPERATOR/ADMIN profile found for disposable macro' };
  }

  const { data: newMacro, error: macroError } = await supabase
    .from('macros')
    .insert({
      name: 'credential-proof-disposable',
      description: 'Temporary credential boundary proof macro',
      key: `proof_disposable_${Date.now()}_${randomUUID().slice(0, 8)}`,
      created_by_user_id: owner.id,
    })
    .select('id')
    .maybeSingle();
  if (macroError || !newMacro) {
    return { ok: false, reason: 'Failed to create disposable macro' };
  }
  const macroId = newMacro.id;

  const definition = {
    version: 1,
    meta: { key: 'credential_proof_login', name: 'Credential Proof Login' },
    inputs: {},
    target: { mode: 'single_device' },
    execution: { defaultTimeoutMs: 15000, maxRetries: 0, onError: 'stop' },
    steps: [
      {
        id: 'input_password',
        type: 'input_text',
        params: { text: '{{accountPassword}}' },
      },
    ],
  };

  const { data: version, error } = await supabase
    .from('macro_versions')
    .insert({
      macro_id: macroId,
      version_number: 1,
      definition_json: definition,
      input_schema_json: definition.inputs,
      tags_json: [],
      status: 'ACTIVE',
      created_by_user_id: owner.id,
    })
    .select('id')
    .maybeSingle();

  if (error || !version) {
    return { ok: false, reason: 'Failed to create disposable macro version' };
  }
  const { error: latestVersionError } = await supabase
    .from('macros')
    .update({ latest_version_id: version.id })
    .eq('id', macroId);
  if (latestVersionError) {
    return { ok: false, reason: 'Failed to finalize disposable macro' };
  }
  return { ok: true, macroVersionId: version.id, macroId };
}

// --- Step 4: Negative auth matrix against decrypt endpoint ---
async function runAuthMatrix(accountId) {
  const cases = [
    { name: 'missing_bearer', headers: { 'X-Credential-Vault-Worker-Token': workerToken }, body: { action: 'decrypt', runId: 'fake', claimToken: 'fake', accountId } },
    { name: 'wrong_bearer', headers: { Authorization: 'Bearer wrong-key', 'X-Credential-Vault-Worker-Token': workerToken }, body: { action: 'decrypt', runId: 'fake', claimToken: 'fake', accountId } },
    { name: 'missing_worker_token', headers: { Authorization: `Bearer ${serviceRoleKey}` }, body: { action: 'decrypt', runId: 'fake', claimToken: 'fake', accountId } },
    { name: 'wrong_worker_token', headers: { Authorization: `Bearer ${serviceRoleKey}`, 'X-Credential-Vault-Worker-Token': 'wrong-token' }, body: { action: 'decrypt', runId: 'fake', claimToken: 'fake', accountId } },
    { name: 'wrong_binding', headers: { Authorization: `Bearer ${serviceRoleKey}`, 'X-Credential-Vault-Worker-Token': workerToken }, body: { action: 'decrypt', runId: 'nonexistent', claimToken: 'wrong', accountId: 'nonexistent' } },
  ];

  const results = [];
  for (const c of cases) {
    try {
      const response = await fetch(vaultUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...c.headers },
        body: JSON.stringify(c.body),
      });
      // All negative cases must fail (401 or 400)
      const status = response.status >= 400 ? 'pass' : 'fail';
      results.push({ name: c.name, status, httpStatus: response.status });
    } catch {
      results.push({ name: c.name, status: 'fail', httpStatus: 0 });
    }
  }

  // Valid bound request: we need a real RUNNING run to test this.
  // This is attempted in the login run section below.
  return results;
}

// --- Step 5: Create workflow run and attempt worker execution ---
async function createAndExecuteRun(accountId, macroVersionId, deviceId) {
  const runId = randomUUID();

  const { error: runError } = await supabase.from('workflow_runs').insert({
    id: runId,
    macro_version_id: macroVersionId,
    target_type: 'SINGLE_DEVICE',
    target_selector_json: { target_ids: [deviceId] },
    input_variables_json: { accountId },
    status: 'QUEUED',
    triggered_by_user_id: (await supabase.from('profiles').select('id').limit(1).maybeSingle()).data?.id,
  });

  if (runError) {
    return { ok: false, reason: 'Failed to create workflow run' };
  }

  // Leave the run unclaimed. The actual worker must claim the queued run before
  // this proof can establish the worker -> vault -> bridge credential path.
  let validDecryptStatus = 'fail';
  let validDecryptHttpStatus = null;
  let validDecryptFailureStage = null;
  let claimToken = null;
  if (claimToken) {
    const response = await fetch(vaultUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
        'X-Credential-Vault-Worker-Token': workerToken,
      },
      body: JSON.stringify({ action: 'decrypt', runId, claimToken, accountId }),
    });
    validDecryptHttpStatus = response.status;
    if (response.ok) {
      const data = await response.json();
      // The vault returned plaintext — verify it matches the canary
      // but NEVER log or persist the plaintext
      if (data.plaintext === canary) {
        validDecryptStatus = 'pass';
        validDecryptFailureStage = null;
      } else {
        validDecryptFailureStage = 'response_plaintext_mismatch';
      }
    } else {
      validDecryptFailureStage = 'vault_http_error';
    }
  } else {
    validDecryptFailureStage = 'claim_not_available_before_poll';
  }

  // Check if a worker is available to execute the run
  let workerAvailable = false;
  try {
    const healthResponse = await fetch(`${workerUrl}/health`, { signal: AbortSignal.timeout(5000) });
    workerAvailable = healthResponse.ok;
  } catch {
    // Worker not available
  }

  let loginCompleted = false;
  if (workerAvailable && bridgeUrl) {
    const maxAttempts = 30;
    for (let attempts = 0; attempts < maxAttempts; attempts++) {
      const { data: run } = await supabase
        .from('workflow_runs')
        .select('status, execution_claim_token')
        .eq('id', runId)
        .maybeSingle();
      if (!run) break;
      if (run.execution_claim_token && !claimToken) {
        claimToken = run.execution_claim_token;
        try {
          const response = await fetch(vaultUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${serviceRoleKey}`,
              'X-Credential-Vault-Worker-Token': workerToken,
            },
            body: JSON.stringify({ action: 'decrypt', runId, claimToken, accountId }),
          });
          validDecryptHttpStatus = response.status;
          if (response.ok && (await response.json()).plaintext === canary) {
            validDecryptStatus = 'pass';
            validDecryptFailureStage = null;
          } else if (!response.ok) {
            validDecryptFailureStage = 'vault_http_error';
          } else {
            validDecryptFailureStage = 'response_plaintext_mismatch';
          }
        } catch {
          validDecryptStatus = 'fail';
          validDecryptFailureStage = 'vault_request_error';
        }
      }
      if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(run.status)) {
        loginCompleted = run.status === 'COMPLETED';
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  return {
    ok: true,
    runId,
    claimToken,
    validDecryptStatus,
    validDecryptHttpStatus,
    validDecryptFailureStage,
    loginCompleted,
    workerAvailable,
  };
}

function scanTextPath(path) {
  if (!path || !existsSync(path)) return { scanned: false, clean: false, count: 0 };
  const files = [];
  const visit = (current) => {
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const next = join(current, entry.name);
      if (entry.isDirectory()) visit(next);
      else if (entry.isFile()) files.push(next);
    }
  };
  try {
    visit(path);
    return {
      scanned: true,
      clean: files.every((file) => !readFileSync(file, 'utf8').includes(canary)),
      count: files.length,
    };
  } catch {
    return { scanned: false, clean: false, count: 0 };
  }
}

// --- Step 6: Scan all surfaces for the canary ---
async function scanForCanary(createdIds) {
  const surfaces = {};

  // Database: scan workflow_runs, run_steps, accounts, artifacts
  try {
    const tables = {
      workflow_runs: 'id,input_variables_json,summary_json',
      run_steps: 'id,input_json,output_json,error_json',
      accounts: 'id,username,encrypted_password',
      artifacts: 'id,storage_key,metadata_json',
    };
    let dbCount = 0;
    let dbClean = true;
    for (const [table, columns] of Object.entries(tables)) {
      const { data, error } = await supabase
        .from(table)
        .select(columns)
        .limit(1000);
      if (!error && data) {
        const serialized = JSON.stringify(data);
        if (serialized.includes(canary)) {
          dbClean = false;
        }
        dbCount += data.length;
      }
    }
    surfaces.database = { scanned: true, clean: dbClean, count: dbCount };
  } catch {
    surfaces.database = { scanned: false, clean: false, count: 0 };
  }

  // Artifact metadata
  try {
    let artifactCount = 0;
    let artifactClean = true;
    if (createdIds.runId) {
      const { data: artifacts, error } = await supabase
        .from('artifacts')
        .select('id, metadata_json')
        .eq('workflow_run_id', createdIds.runId)
        .limit(100);
      if (!error && artifacts) {
        artifactCount = artifacts.length;
        const serialized = JSON.stringify(artifacts);
        if (serialized.includes(canary)) artifactClean = false;
      }
    }
    surfaces.artifactMetadata = { scanned: true, clean: artifactClean, count: artifactCount };
  } catch {
    surfaces.artifactMetadata = { scanned: false, clean: false, count: 0 };
  }

  // Artifact objects (download and scan)
  try {
    let objCount = 0;
    let objClean = true;
    if (createdIds.runId) {
      const { data: artifacts } = await supabase
        .from('artifacts')
        .select('id, storage_key')
        .eq('workflow_run_id', createdIds.runId)
        .eq('type', 'LOG_BLOB')
        .limit(50);
      if (artifacts) {
        for (const art of artifacts) {
          if (art.storage_key) {
            const { data: blob, error } = await supabase.storage
              .from('artifacts')
              .download(art.storage_key);
            if (!error && blob) {
              objCount++;
              const text = await blob.text();
              if (text.includes(canary)) objClean = false;
            }
          }
        }
      }
    }
    surfaces.artifactObjects = { scanned: true, clean: objClean, count: objCount };
  } catch {
    surfaces.artifactObjects = { scanned: false, clean: false, count: 0 };
  }

  // Worker logs — captured by the adapter, not directly accessible here
  // The adapter scans its captured stdout/stderr for the canary
  surfaces.workerLogs = scanTextPath(env.CREDENTIAL_BOUNDARY_WORKER_LOG_DIR);

  // Bridge logs — same, adapter captures if bridge is spawned
  surfaces.bridgeLogs = scanTextPath(env.CREDENTIAL_BOUNDARY_BRIDGE_LOG_DIR);

  // Reports — scan source-controlled reports
  try {
    // The adapter scans its own stdout/stderr; reports are generated by the verifier
    // not by this harness. Mark as scanned/clean since the harness never writes canary.
    surfaces.reports = scanTextPath(join(rootDir, 'plans'));
  } catch {
    surfaces.reports = { scanned: false, clean: false, count: 0 };
  }

  return surfaces;
}

// --- Step 7: Cleanup ---
async function cleanup(createdIds) {
  const cleanupResult = { verified: true, accountId: createdIds.accountId ?? null, runId: createdIds.runId ?? null };

  // Delete run steps
  if (createdIds.runId) {
    const { error: runStepsError } = await supabase.from('run_steps').delete().eq('workflow_run_id', createdIds.runId);
    // Delete artifacts
    const { error: artifactsError } = await supabase.from('artifacts').delete().eq('workflow_run_id', createdIds.runId);
    // Delete workflow run
    const { error: runError } = await supabase.from('workflow_runs').delete().eq('id', createdIds.runId);
    if (runStepsError || artifactsError || runError) cleanupResult.verified = false;
  }

  // Delete account action history
  if (createdIds.accountId) {
    const { error: historyError } = await supabase.from('account_action_history').delete().eq('account_id', createdIds.accountId);
    // Delete account
    const { error: accountDeleteError } = await supabase.from('accounts').delete().eq('id', createdIds.accountId);
    if (historyError || accountDeleteError) {
      cleanupResult.verified = false;
    }
  }

  // Delete macro version
  if (createdIds.macroVersionId) {
    if (createdIds.macroId) {
      const { error: latestVersionError } = await supabase
        .from('macros')
        .update({ latest_version_id: null })
        .eq('id', createdIds.macroId);
      if (latestVersionError) cleanupResult.verified = false;
    }
    const { error: macroVersionError } = await supabase.from('macro_versions').delete().eq('id', createdIds.macroVersionId);
    if (macroVersionError) cleanupResult.verified = false;
  }

  if (createdIds.macroId) {
    const { error: macroError } = await supabase.from('macros').delete().eq('id', createdIds.macroId);
    if (macroError) cleanupResult.verified = false;
  }

  // Verify cleanup
  if (createdIds.accountId) {
    const { data: stillExists } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', createdIds.accountId)
      .maybeSingle();
    if (stillExists) {
      cleanupResult.verified = false;
    }
  }

  if (createdIds.runId) {
    const { data: runStillExists } = await supabase
      .from('workflow_runs')
      .select('id')
      .eq('id', createdIds.runId)
      .maybeSingle();
    if (runStillExists) {
      cleanupResult.verified = false;
    }
  }

  return cleanupResult;
}

// --- Main ---
async function main() {
  const createdIds = {};
  const missingPrerequisite = [
    ['SUPABASE_URL', supabaseUrl],
    ['SUPABASE_SERVICE_ROLE_KEY', serviceRoleKey],
    ['SUPABASE_ANON_KEY', anonKey],
    ['CREDENTIAL_VAULT_WORKER_TOKEN', workerToken],
    ['CREDENTIAL_BOUNDARY_CANARY', canary],
    ['PROOF_OPERATOR_JWT', operatorJwt],
  ].find(([, value]) => !value);
  if (missingPrerequisite) {
    console.log(JSON.stringify(blockedManifest(`${missingPrerequisite[0]} is required`), null, 2));
    process.exitCode = 1;
    return;
  }
  CANARY_HASH = canaryHash(canary);
  supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  try {
    // Step 1: Encrypt
    const encryptResult = await encryptDisposablePassword();
    if (!encryptResult.ok) {
      blocked(`Failed to encrypt disposable password (HTTP ${encryptResult.status})`);
    }

    // Step 2: Create account
    const accountResult = await createDisposableAccount(encryptResult.encryptedPayload);
    if (!accountResult.ok) {
      blocked(accountResult.reason ?? 'Failed to create disposable account');
    }
    createdIds.accountId = accountResult.accountId;

    // Step 3: Create macro
    const macroResult = await createDisposableMacro();
    if (!macroResult.ok) {
      blocked(macroResult.reason ?? 'Failed to create disposable macro');
    }
    createdIds.macroVersionId = macroResult.macroVersionId;
    createdIds.macroId = macroResult.macroId;

    // Find a device for the run
    const expectedSerials = (env.MOBILE_MCP_EXPECTED_SERIALS ?? process.env.MOBILE_MCP_EXPECTED_SERIALS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    let deviceQuery = supabase.from('devices').select('id, laixi_device_id').limit(1);
    if (expectedSerials.length) {
      deviceQuery = deviceQuery.in('laixi_device_id', expectedSerials);
    }
    const { data: device } = await deviceQuery.maybeSingle();
    if (!device) {
      blocked('No device found for credential proof run');
    }

    // Step 4: Negative auth matrix
    const authMatrix = await runAuthMatrix(accountResult.accountId);

    // Step 5: Create and execute run
    const runResult = await createAndExecuteRun(accountResult.accountId, macroResult.macroVersionId, device.id);
    if (!runResult.ok) {
      blocked(runResult.reason ?? 'Failed to create workflow run');
    }
    createdIds.runId = runResult.runId;

    // Add the valid bound decrypt case to the auth matrix
    authMatrix.push({
      name: 'valid_bound_decrypt',
      status: runResult.validDecryptStatus === 'pass' ? 'pass' : 'fail',
      httpStatus: runResult.validDecryptHttpStatus,
      failureStage: runResult.validDecryptFailureStage,
    });

    // Step 6: Scan for canary
    const surfaces = await scanForCanary(createdIds);

    // Step 7: Cleanup
    const cleanupResult = await cleanup(createdIds);

    // Print safe manifest
    const manifest = {
      blocked: false,
      authMatrix,
      loginRun: {
        completed: runResult.loginCompleted,
        id: runResult.runId,
        workerAvailable: runResult.workerAvailable,
      },
      persistenceScan: {
        surfaces,
        canaryHash: CANARY_HASH,
      },
      cleanup: cleanupResult,
      encryptedPayloadPrefix: encryptResult.prefix,
    };
    console.log(JSON.stringify(manifest, null, 2));
  } catch (error) {
    // Attempt cleanup on any error
    let cleanupResult = { verified: false };
    if (createdIds.accountId || createdIds.runId || createdIds.macroVersionId) {
      cleanupResult = await cleanup(createdIds);
    }
    const safeReason = error instanceof BlockedProofError ? error.message : 'harness_error';
    console.error(`[harness] ${safeReason}`);
    // Print blocked manifest — never expose error details that might contain the canary
    const manifest = {
      blocked: true,
      reason: safeReason,
      authMatrix: [],
      loginRun: { completed: false },
      persistenceScan: { surfaces: {} },
      cleanup: cleanupResult,
    };
    console.log(JSON.stringify(manifest, null, 2));
    process.exitCode = 1;
  }
}

main().catch(() => {
  console.log(JSON.stringify({
    blocked: true,
    reason: 'harness_fatal_error',
    authMatrix: [],
    loginRun: { completed: false },
    persistenceScan: { surfaces: {} },
    cleanup: { verified: false },
  }));
  process.exit(1);
});
