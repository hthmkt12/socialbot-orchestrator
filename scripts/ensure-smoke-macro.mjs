import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));

function loadDotEnv(path) {
  if (!existsSync(path)) return {};
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
}

const env = { ...process.env, ...loadDotEnv(join(rootDir, '.env')) };
const supabaseUrl = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

const MACRO_KEY = 'mobile_mcp_db_multi_smoke';
const MACRO_NAME = 'Mobile MCP DB Multi Smoke';

const smokeDefinition = {
  version: 1,
  meta: {
    key: MACRO_KEY,
    name: MACRO_NAME,
    description: 'Chạy cùng một flow trên nhiều thiết bị',
    tags: ['multi-device', 'batch', 'monitoring'],
  },
  inputs: { appName: { type: 'string', required: true } },
  target: { mode: 'multi_device' },
  execution: { defaultTimeoutMs: 15000, maxRetries: 1, onError: 'continue' },
  steps: [
    { id: 'launch_1', type: 'launch_app', params: { appName: '{{appName}}' } },
    { id: 'wait_1', type: 'wait', params: { ms: 3000 } },
    { id: 'screen_1', type: 'screenshot', params: { saveToArtifact: true } },
    { id: 'current_1', type: 'get_current_app', params: {} },
  ],
};

async function main() {
  const { data: profile } = await supabase.from('profiles').select('id').limit(1).maybeSingle();
  if (!profile) {
    throw new Error('No profile found to associate macro with');
  }

  const existing = await supabase
    .from('macros')
    .select('id, key, name, latest_version_id')
    .or(`key.eq.${MACRO_KEY},name.eq.${MACRO_NAME}`)
    .maybeSingle();

  if (existing.data?.latest_version_id) {
    console.log(`Macro ${MACRO_NAME} already exists with version ${existing.data.latest_version_id}`);
    return;
  }

  let macroId = existing.data?.id;
  if (!macroId) {
    const { data: created, error } = await supabase
      .from('macros')
      .insert({
        key: MACRO_KEY,
        name: MACRO_NAME,
        description: smokeDefinition.meta.description,
        created_by_user_id: profile.id,
      })
      .select('id')
      .single();
    if (error) throw error;
    macroId = created.id;
  }

  const { data: version, error: versionError } = await supabase
    .from('macro_versions')
    .insert({
      macro_id: macroId,
      version_number: 1,
      status: 'ACTIVE',
      definition_json: smokeDefinition,
      input_schema_json: smokeDefinition.inputs,
      tags_json: smokeDefinition.meta.tags,
      created_by_user_id: profile.id,
    })
    .select('id')
    .single();
  if (versionError) throw versionError;

  await supabase.from('macros').update({ latest_version_id: version.id }).eq('id', macroId);
  console.log(`Successfully ensured macro ${MACRO_NAME} (id: ${macroId}, version: ${version.id})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
