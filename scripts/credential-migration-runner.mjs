/**
 * Credential migration runner: converts existing `v2:` client-encrypted
 * passwords to `s3:` server-encrypted payloads via the `credential-vault`
 * Edge Function.
 *
 * Usage:
 *   node scripts/credential-migration-runner.mjs              # batch migrate
 *   node scripts/credential-migration-runner.mjs --dry-run    # count v2: rows
 *   node scripts/credential-migration-runner.mjs --account-id <uuid>  # single account
 *
 * Env vars:
 *   SUPABASE_URL              - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key for admin auth
 *
 * Output:
 *   JSON report to stdout and saved to
 *   plans/260710-credential-boundary-implementation-plan/reports/credential-migration-<timestamp>.json
 *
 * Security:
 *   NEVER prints plaintext passwords, keys, or decrypted values.
 *   Only structural metadata (counts, account ids, statuses) is reported.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));

// --- Minimal .env loader (no external deps) ---
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
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1);
          }
          return [line.slice(0, index), value];
        })
    );
  } catch {
    return {};
  }
}

function parseArgs(argv) {
  const args = { dryRun: false, accountId: null };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--account-id') {
      args.accountId = argv[++i] ?? null;
    }
  }
  return args;
}

function timestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-');
}

async function main() {
  const dotEnv = loadDotEnv(join(rootDir, '.env'));
  const env = { ...dotEnv, ...process.env };

  const supabaseUrl = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      JSON.stringify({
        error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing',
      })
    );
    process.exit(1);
  }

  const args = parseArgs(process.argv);
  const action = args.dryRun ? 'dry-run' : 'migrate';

  // Use service-role client to invoke the Edge Function with admin privileges.
  // The Edge Function still checks the JWT role, so we pass the service role
  // key as the bearer token (service role bypasses RLS and carries admin
  // privileges in Supabase).
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const requestBody = { action };
  if (args.accountId) {
    requestBody.accountId = args.accountId;
  }

  const { data, error } = await supabase.functions.invoke('credential-vault', {
    body: requestBody,
  });

  const report = {
    action,
    accountId: args.accountId ?? null,
    invokedAt: new Date().toISOString(),
    result: data ?? null,
    error: error ? { message: error.message } : null,
  };

  // Output JSON report to stdout (never includes plaintext or keys)
  const reportJson = JSON.stringify(report, null, 2);
  console.log(reportJson);

  // Save report to plans directory
  const reportsDir = join(
    rootDir,
    'plans',
    '260710-credential-boundary-implementation-plan',
    'reports'
  );
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }
  const reportPath = join(
    reportsDir,
    `credential-migration-${timestamp()}.json`
  );
  writeFileSync(reportPath, reportJson, 'utf8');
  console.error(`Report saved to ${reportPath}`);

  if (error) {
    process.exit(1);
  }
}

main().catch((err) => {
  // Never print err.message if it might contain sensitive data - just the name
  console.error(
    JSON.stringify({ error: 'Migration runner failed', name: err?.name ?? 'Unknown' })
  );
  process.exit(1);
});
