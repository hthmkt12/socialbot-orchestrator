/**
 * Pure preflight validation logic for the credential boundary runtime proof.
 *
 * Extracted into its own module so the orchestrator and tests can share the
 * same validation path without spawning processes or touching the network.
 *
 * Security:
 *   No secret values are returned. Only booleans, safe labels, and
 *   category-level failure reasons are emitted.
 */

export const PREFLIGHT_CHECKS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'CREDENTIAL_VAULT_WORKER_TOKEN',
  'PROOF_OPERATOR_JWT',
  'CREDENTIAL_BOUNDARY_CANARY',
  'MOBILE_MCP_BRIDGE_URL',
  'MOBILE_MCP_BRIDGE_TOKEN',
  'WORKER_BASE_URL',
  'CREDENTIAL_BOUNDARY_EXISTING_WORKER_LOG_DIR',
  'CREDENTIAL_BOUNDARY_EXISTING_BRIDGE_LOG_DIR',
  'bridge_health',
  'worker_health',
  'online_device',
  'log_dirs_writable',
  'vault_endpoint_reachable',
];

/**
 * Check whether both opt-in gates are satisfied.
 * Returns { allowed: boolean, missing: string[] }.
 */
export function checkOptIn(args, env) {
  const hasFlag = Array.isArray(args) && args.includes('--run-real-proof');
  const hasEnv = env?.CREDENTIAL_BOUNDARY_ALLOW_REAL_PROOF === 'true';
  const missing = [];
  if (!hasFlag) missing.push('--run-real-proof CLI flag');
  if (!hasEnv) missing.push('CREDENTIAL_BOUNDARY_ALLOW_REAL_PROOF=true env var');
  return { allowed: hasFlag && hasEnv, missing };
}

/**
 * Validate all env-var prerequisites (non-network).
 * Returns { passed: boolean, missing: string[] }.
 *
 * Two tiers:
 * - core: required for any real proof attempt
 * - existingLogDirs: required when worker/bridge are already running
 *   (the orchestrator enforces these at service-lifecycle time)
 */
export function validateEnvPrerequisites(env) {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_ANON_KEY',
    'CREDENTIAL_VAULT_WORKER_TOKEN',
    'PROOF_OPERATOR_JWT',
    'CREDENTIAL_BOUNDARY_CANARY',
    'MOBILE_MCP_BRIDGE_URL',
    'MOBILE_MCP_BRIDGE_TOKEN',
    'WORKER_BASE_URL',
  ];
  const missing = required.filter((name) => !env?.[name]);
  return { passed: missing.length === 0, missing };
}

/**
 * Produce a readiness report listing every missing prerequisite as a safe
 * label (never a value). Includes both core env vars and optional existing-
 * log-dir vars that are needed when services are already running.
 *
 * Returns { ready: boolean, missing: string[], present: string[] }.
 */
export function readinessReport(env) {
  const coreRequired = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_ANON_KEY',
    'CREDENTIAL_VAULT_WORKER_TOKEN',
    'PROOF_OPERATOR_JWT',
    'CREDENTIAL_BOUNDARY_CANARY',
    'MOBILE_MCP_BRIDGE_URL',
    'MOBILE_MCP_BRIDGE_TOKEN',
    'WORKER_BASE_URL',
  ];
  const optionalForExistingServices = [
    'CREDENTIAL_BOUNDARY_EXISTING_WORKER_LOG_DIR',
    'CREDENTIAL_BOUNDARY_EXISTING_BRIDGE_LOG_DIR',
  ];
  const all = [...coreRequired, ...optionalForExistingServices];
  const missing = all.filter((name) => !env?.[name]);
  const present = all.filter((name) => Boolean(env?.[name]));
  return {
    ready: coreRequired.every((name) => Boolean(env?.[name])),
    missing,
    present,
  };
}

/**
 * Check bridge health via the provided fetch function.
 * Returns { passed: boolean, reason?: string, status?: number }.
 */
export async function checkBridgeHealth(bridgeUrl, fetchFn = fetch) {
  if (!bridgeUrl) return { passed: false, reason: 'MOBILE_MCP_BRIDGE_URL not set' };
  try {
    const response = await fetchFn(`${bridgeUrl}/health`, { signal: AbortSignal.timeout(5000) });
    if (response.ok) return { passed: true, status: response.status };
    return { passed: false, reason: `bridge health returned ${response.status}` };
  } catch (error) {
    return { passed: false, reason: 'bridge_unreachable' };
  }
}

/**
 * Check worker health via the provided fetch function.
 * Returns { passed: boolean, reason?: string, status?: number }.
 */
export async function checkWorkerHealth(workerUrl, fetchFn = fetch) {
  if (!workerUrl) return { passed: false, reason: 'WORKER_BASE_URL not set' };
  try {
    const response = await fetchFn(`${workerUrl}/health`, { signal: AbortSignal.timeout(5000) });
    if (response.ok) return { passed: true, status: response.status };
    return { passed: false, reason: `worker health returned ${response.status}` };
  } catch {
    return { passed: false, reason: 'worker_unreachable' };
  }
}

/**
 * Check that at least one device is ONLINE in the database.
 * Uses a provided supabase-like client (must have .from().select().eq().limit().maybeSingle()).
 * Returns { passed: boolean, count: number, reason?: string }.
 */
export async function checkOnlineDevice(supabaseClient) {
  if (!supabaseClient) return { passed: false, count: 0, reason: 'no_supabase_client' };
  try {
    const { data, error } = await supabaseClient
      .from('devices')
      .select('id, status')
      .eq('status', 'ONLINE')
      .limit(1)
      .maybeSingle();
    if (error) return { passed: false, count: 0, reason: 'db_query_error' };
    if (!data) return { passed: false, count: 0, reason: 'no_online_device' };
    return { passed: true, count: 1 };
  } catch {
    return { passed: false, count: 0, reason: 'db_query_error' };
  }
}

/**
 * Check that the credential-vault Edge Function endpoint is reachable.
 * Uses a HEAD or minimal POST with a non-existent action to check reachability.
 * Returns { passed: boolean, reason?: string, status?: number }.
 */
export async function checkVaultEndpoint(supabaseUrl, operatorJwt, fetchFn = fetch) {
  if (!supabaseUrl) return { passed: false, reason: 'supabase_url_missing' };
  if (!operatorJwt) return { passed: false, reason: 'operator_jwt_missing' };
  const vaultUrl = `${supabaseUrl}/functions/v1/credential-vault`;
  try {
    const response = await fetchFn(vaultUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${operatorJwt}`,
      },
      body: JSON.stringify({ action: 'health_check' }),
      signal: AbortSignal.timeout(10000),
    });
    // Any response (even 400) means the endpoint is reachable.
    // 404 or network errors mean it's not deployed.
    if (response.status === 404) return { passed: false, reason: 'vault_not_deployed', status: 404 };
    return { passed: true, status: response.status };
  } catch {
    return { passed: false, reason: 'vault_unreachable' };
  }
}

/**
 * Check that log directories are writable and git-ignored.
 * Returns { passed: boolean, dirs: object[] }.
 */
export function checkLogDirs(workerLogDir, bridgeLogDir, gitignoreContent = '', probeWritable = () => true) {
  const dirs = [];
  let passed = true;
  for (const [name, dir] of [['worker', workerLogDir], ['bridge', bridgeLogDir]]) {
    if (!dir) {
      dirs.push({ name, path: null, writable: false, ignored: false, reason: 'not_set' });
      passed = false;
      continue;
    }
    // Check if the directory or its parent pattern is covered by gitignore
    const isIgnored = gitignoreContent.includes(dir) ||
      gitignoreContent.includes('logs/') ||
      gitignoreContent.includes('.credential-boundary-proof/');
    const writable = isIgnored && Boolean(probeWritable(dir));
    const reason = !isIgnored ? 'not_gitignored' : writable ? undefined : 'not_writable';
    dirs.push({ name, path: dir, writable, ignored: isIgnored, reason });
    if (!writable) passed = false;
  }
  return { passed, dirs };
}

/**
 * Redact any sensitive values from a report object before output.
 * Removes/redacts keys matching sensitive patterns, keeping only safe metadata.
 */
export function redactReport(report) {
  const sensitiveKeyPatterns = [
    /password|secret|token|key|canary|plaintext|ciphertext|encrypted_payload/i,
  ];
  function redactValue(value) {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.map(redactValue);
    if (typeof value === 'object') {
      const result = {};
      for (const [key, val] of Object.entries(value)) {
        if (sensitiveKeyPatterns.some((pattern) => pattern.test(key))) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = redactValue(val);
        }
      }
      return result;
    }
    return value;
  }
  return redactValue(report);
}

/**
 * Run the full preflight. Returns a structured result.
 * Does NOT mutate any data.
 */
export async function runPreflight({ env, supabaseClient, fetchFn, gitignoreContent, probeWritable = () => true, checkRuntimeHealth = true }) {
  const checks = {};
  const failures = [];

  // Env var checks
  const envResult = validateEnvPrerequisites(env);
  checks.envPrerequisites = envResult;
  if (!envResult.passed) {
    for (const name of envResult.missing) failures.push(`${name} not set`);
  }

  // If env prerequisites fail, no point checking network
  if (envResult.passed && checkRuntimeHealth) {
    // Bridge health
    const bridgeResult = await checkBridgeHealth(env.MOBILE_MCP_BRIDGE_URL, fetchFn);
    checks.bridgeHealth = bridgeResult;
    if (!bridgeResult.passed) failures.push(`bridge_health: ${bridgeResult.reason}`);

    // Worker health
    const workerResult = await checkWorkerHealth(env.WORKER_BASE_URL, fetchFn);
    checks.workerHealth = workerResult;
    if (!workerResult.passed) failures.push(`worker_health: ${workerResult.reason}`);

    // Online device
    const deviceResult = await checkOnlineDevice(supabaseClient);
    checks.onlineDevice = deviceResult;
    if (!deviceResult.passed) failures.push(`online_device: ${deviceResult.reason}`);

    // Vault endpoint
    const vaultResult = await checkVaultEndpoint(env.SUPABASE_URL, env.PROOF_OPERATOR_JWT, fetchFn);
    checks.vaultEndpoint = vaultResult;
    if (!vaultResult.passed) failures.push(`vault_endpoint: ${vaultResult.reason}`);
  }

  // Log dirs
  const logDirResult = checkLogDirs(
    env.CREDENTIAL_BOUNDARY_WORKER_LOG_DIR,
    env.CREDENTIAL_BOUNDARY_BRIDGE_LOG_DIR,
    gitignoreContent,
    probeWritable,
  );
  checks.logDirs = logDirResult;
  if (!logDirResult.passed) {
    for (const dir of logDirResult.dirs) {
      if (!dir.ignored) failures.push(`log_dir_${dir.name}: ${dir.reason ?? 'not gitignored'}`);
    }
  }

  return {
    passed: failures.length === 0,
    failures,
    checks,
  };
}
