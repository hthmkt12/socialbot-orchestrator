/**
 * Credential migration runner: converts existing `v2:` client-encrypted
 * passwords to `s3:` server-encrypted payloads via the `credential-vault`
 * Edge Function.
 *
 * Usage:
 *   CREDENTIAL_MIGRATION_ADMIN_TOKEN=<JWT> node scripts/credential-migration-runner.mjs             # batch migrate
 *   CREDENTIAL_MIGRATION_ADMIN_TOKEN=<JWT> node scripts/credential-migration-runner.mjs --dry-run   # count v2: rows
 *   CREDENTIAL_MIGRATION_ADMIN_TOKEN=<JWT> node scripts/credential-migration-runner.mjs --account-id <uuid>  # single account
 *
 * Env vars:
 *   SUPABASE_URL              - Supabase project URL
 *
 * Security:
 *   Requires a short-lived ADMIN user access token (not the service-role key).
 *   Read only from the process environment so it is not exposed through CLI
 *   arguments, reports, or .env files.
 *   NEVER prints plaintext passwords, keys, or decrypted values.
 *   Only structural metadata (counts, account ids, statuses) is reported.
 */

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

  if (!supabaseUrl) {
    console.error(
      JSON.stringify({ error: 'SUPABASE_URL is missing' })
    );
    process.exit(1);
  }

  const args = parseArgs(process.argv);

  // Deliberately read from process.env only: loadDotEnv() above is for the
  // project URL, but an ADMIN token must never be stored in a .env file.
  const adminToken = process.env.CREDENTIAL_MIGRATION_ADMIN_TOKEN;
  if (!adminToken) {
    console.error(
      JSON.stringify({
        error: 'A short-lived ADMIN user access token is required in CREDENTIAL_MIGRATION_ADMIN_TOKEN. Do not use the service-role key or command-line arguments.',
      })
    );
    process.exit(1);
  }

  const action = args.dryRun ? 'dry-run' : 'migrate';
  const vaultUrl = `${supabaseUrl}/functions/v1/credential-vault`;

  const requestBody = { action };
  if (args.accountId) {
    requestBody.accountId = args.accountId;
  }

  // Call the Edge Function with the ADMIN user token as bearer.
  // The handler validates it via auth.getUser() and checks ADMIN role.
  const response = await fetch(vaultUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json().catch(() => null);

  const report = {
    action,
    accountId: args.accountId ?? null,
    invokedAt: new Date().toISOString(),
    httpStatus: response.status,
    result: data ?? null,
    error: response.ok ? null : (data?.error ?? `HTTP ${response.status}`),
  };

  // Output JSON report to stdout (never includes plaintext, keys, or tokens)
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

  if (!response.ok) {
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
