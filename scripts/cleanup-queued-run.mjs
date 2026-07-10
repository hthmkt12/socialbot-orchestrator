import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));

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

const dotEnv = loadDotEnv(join(rootDir, '.env'));
const env = { ...dotEnv, ...process.env };
const supabaseUrl = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const runId = process.argv[2] ?? env.CLEANUP_RUN_ID ?? 'cb7b7c01-3a61-4d7f-809f-2890668ff152';

async function main() {
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  console.log(`Checking run ID: ${runId}`);
  const { data: run, error: getError } = await supabase
    .from('workflow_runs')
    .select('id,status,execution_claim_token,summary_json')
    .eq('id', runId)
    .maybeSingle();

  if (getError) {
    console.error('Error fetching run:', getError.message);
    process.exit(1);
  }

  if (!run) {
    console.log(`Run ${runId} not found in database.`);
    return;
  }

  console.log(`Current status of run ${runId} is: ${run.status}`);

  const { data: steps, error: stepsError } = await supabase
    .from('run_steps')
    .select('id')
    .eq('workflow_run_id', runId)
    .limit(1);

  if (stepsError) {
    console.error('Error checking run steps:', stepsError.message);
    process.exit(1);
  }

  const hasWorkerClaim = Boolean(run.execution_claim_token);
  const hasSteps = Boolean(steps?.length);

  if (run.status === 'QUEUED' && !hasWorkerClaim && !hasSteps) {
    console.log(`Updating run ${runId} status to CANCELLED...`);
    const { data: updated, error: updateError } = await supabase
      .from('workflow_runs')
      .update({
        status: 'CANCELLED',
        updated_at: new Date().toISOString(),
        summary_json: {
          ...(run.summary_json ?? {}),
          cleanup: {
            reason: 'queued_without_worker_claim_or_steps',
            cleanedAt: new Date().toISOString(),
          },
        },
      })
      .eq('id', runId)
      .select('id,status')
      .maybeSingle();

    if (updateError) {
      console.error('Error updating run status:', updateError.message);
      process.exit(1);
    }

    console.log(`Successfully updated. New status: ${updated.status}`);
  } else {
    console.log(
      `Skipping update. status=${run.status}, hasWorkerClaim=${hasWorkerClaim}, hasSteps=${hasSteps}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
