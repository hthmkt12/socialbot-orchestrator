import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const reportDir = join(rootDir, 'plans', 'reports');
const reportPath = join(reportDir, `mobile-mcp-operator-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const updatePassword = args.has('--update-password');

function loadDotEnv(path) {
  if (!existsSync(path)) return {};
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
}

const dotEnv = loadDotEnv(join(rootDir, '.env'));
const env = { ...dotEnv, ...process.env };
const supabaseUrl = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const email = env.UI_SMOKE_EMAIL;
const password = env.UI_SMOKE_PASSWORD;

function required(name, value) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function canUpdateExistingPassword(value) {
  return updatePassword || value.endsWith('.invalid') || value.includes('+smoke');
}

async function findAuthUser(supabase, targetEmail) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const found = data.users.find((user) => user.email?.toLowerCase() === targetEmail.toLowerCase());
    if (found) return found;
    if (data.users.length < 1000) return null;
  }
  throw new Error('Auth user search reached page limit');
}

async function ensureAuthUser(supabase) {
  const existing = await findAuthUser(supabase, email);
  if (!existing) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw new Error(`Failed to create operator auth user: ${error.message}`);
    return { user: data.user, action: 'created', passwordUpdated: false };
  }

  if (canUpdateExistingPassword(email)) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, { password });
    if (error) throw new Error(`Failed to update operator password: ${error.message}`);
    return { user: data.user, action: 'existing', passwordUpdated: true };
  }

  return { user: existing, action: 'existing', passwordUpdated: false };
}

async function ensureProfile(supabase, user) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id,user_id,email,role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (!profile) {
    const { data, error: insertError } = await supabase
      .from('profiles')
      .insert({ user_id: user.id, email, role: 'OPERATOR' })
      .select('id,user_id,email,role')
      .single();
    if (insertError) throw new Error(insertError.message);
    return { profile: data, action: 'created' };
  }

  if (!['ADMIN', 'OPERATOR'].includes(profile.role)) {
    const { data, error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'OPERATOR', email })
      .eq('user_id', user.id)
      .select('id,user_id,email,role')
      .single();
    if (updateError) throw new Error(updateError.message);
    return { profile: data, action: 'promoted' };
  }

  return { profile, action: 'existing' };
}

async function verifyLogin() {
  if (!anonKey) return { checked: false, ok: false, reason: 'VITE_SUPABASE_ANON_KEY missing' };
  const supabase = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { checked: true, ok: !error, reason: error?.message };
}

async function main() {
  mkdirSync(reportDir, { recursive: true });
  const missing = [
    ['SUPABASE_URL or VITE_SUPABASE_URL', supabaseUrl],
    ['SUPABASE_SERVICE_ROLE_KEY', serviceRoleKey],
    ['UI_SMOKE_EMAIL', email],
    ['UI_SMOKE_PASSWORD', password],
  ].filter(([, value]) => !value).map(([name]) => name);

  if (dryRun) {
    const report = { checkedAt: new Date().toISOString(), dryRun, email: email ?? null, missing };
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ reportPath, dryRun, email: email ?? null, missing }, null, 2));
    return;
  }

  required('SUPABASE_URL or VITE_SUPABASE_URL', supabaseUrl);
  required('SUPABASE_SERVICE_ROLE_KEY', serviceRoleKey);
  required('UI_SMOKE_EMAIL', email);
  required('UI_SMOKE_PASSWORD', password);

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const auth = await ensureAuthUser(supabase);
  const profile = await ensureProfile(supabase, auth.user);
  const login = await verifyLogin();
  const report = {
    checkedAt: new Date().toISOString(),
    dryRun,
    email,
    userId: auth.user.id,
    authAction: auth.action,
    passwordUpdated: auth.passwordUpdated,
    profileAction: profile.action,
    profileRole: profile.profile.role,
    login,
  };
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ reportPath, email, authAction: auth.action, profileAction: profile.action, profileRole: profile.profile.role, loginOk: login.ok }, null, 2));
  if (login.checked && !login.ok) {
    throw new Error(`Operator login failed after ensure: ${login.reason}. For non-smoke emails, rerun with -- --update-password if password reset is intended.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
