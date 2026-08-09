import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  encryptCredential,
  decryptServerCredential,
  decryptLegacyCredential,
  MIN_SERVER_KEY_LENGTH,
  MIN_LEGACY_KEY_LENGTH,
  SERVER_PAYLOAD_PREFIX,
  LEGACY_PAYLOAD_PREFIX,
} from "./crypto-helper.ts";

/*
 * credential-vault Edge Function — Remediation Phase 1
 *
 * Handler-owned auth: gateway verify_jwt=false for this function only.
 * The handler parses the action, authenticates, and authorizes every
 * branch before any credential or DB operation.
 *
 * Actions:
 *   encrypt   — real user JWT via auth.getUser() + OPERATOR/ADMIN
 *   migrate   — real user JWT via auth.getUser() + ADMIN
 *   dry-run   — real user JWT via auth.getUser() + ADMIN
 *   decrypt   — exact service-role bearer + X-Credential-Vault-Worker-Token,
 *               then active run/claim/account binding, then DB-loaded ciphertext
 *
 * Unknown or missing action returns 400. No silent default to encrypt.
 * No branch logs headers, tokens, JWT payloads, plaintext, ciphertext, or keys.
 * Opaque sb_secret_... keys are never passed to auth.getUser().
 */

function allowedCorsOrigin() {
  return Deno.env.get("CREDENTIAL_VAULT_ALLOWED_ORIGIN") ?? "http://localhost:5173";
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": allowedCorsOrigin(),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Client-Info, Apikey, X-Credential-Vault-Worker-Token",
    "Vary": "Origin",
  };
}

const ALLOWED_ROLES = new Set(["OPERATOR", "ADMIN"]);
const ADMIN_ONLY_ROLES = new Set(["ADMIN"]);

const VALID_ACTIONS = new Set(["encrypt", "migrate", "dry-run", "decrypt"]);
type VaultAction = "encrypt" | "migrate" | "dry-run" | "decrypt";

const WORKER_TOKEN_HEADER = "x-credential-vault-worker-token";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

/** Constant-time string comparison to prevent timing leaks. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

interface VaultRequestBody {
  plaintext?: string;
  accountId?: string;
  action?: string;
  // decrypt-only fields
  runId?: string;
  claimToken?: string;
}

/** Authenticate a real user JWT via auth.getUser() and return the profile role. */
async function authenticateUser(
  supabaseUrl: string,
  anonKey: string,
  userJwt: string
): Promise<{ ok: true; role: string } | { ok: false; status: number }> {
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return { ok: false, status: 401 };
  }
  const userId = userData.user.id;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return { ok: false, status: 403 };
  }

  return { ok: true, role: profile.role };
}

/**
 * Authenticate the internal worker decrypt request.
 * Requires both:
 *   1. Authorization: Bearer exactly matching the dedicated boundary service key
 *      (CREDENTIAL_BOUNDARY_SERVICE_ROLE_KEY, falling back to SUPABASE_SERVICE_ROLE_KEY)
 *   2. X-Credential-Vault-Worker-Token exactly matching CREDENTIAL_VAULT_WORKER_TOKEN
 * Compared in constant time. Neither factor alone is sufficient.
 */
function authenticateWorker(
  authHeader: string,
  workerTokenHeader: string | null
): boolean {
  // Use a dedicated boundary secret when configured. Supabase-managed
  // service-role variables can lag during key rotation.
  const expectedServiceKey =
    Deno.env.get("CREDENTIAL_BOUNDARY_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const expectedWorkerToken = Deno.env.get("CREDENTIAL_VAULT_WORKER_TOKEN");

  if (!expectedServiceKey || !expectedWorkerToken) {
    return false;
  }

  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!bearer || !workerTokenHeader) {
    return false;
  }

  const serviceMatch = safeEqual(bearer, expectedServiceKey);
  const tokenMatch = safeEqual(workerTokenHeader, expectedWorkerToken);

  return serviceMatch && tokenMatch;
}

/**
 * Verify run binding for decrypt: run must be RUNNING, claim token must match,
 * and input_variables_json.accountId must match the requested accountId.
 * Returns the encrypted_password from the accounts row, or null on any mismatch.
 */
async function verifyRunAndLoadEncryptedPassword(
  supabaseUrl: string,
  serviceRoleKey: string,
  runId: string,
  claimToken: string,
  accountId: string
): Promise<{ ok: true; encryptedPassword: string } | { ok: false }> {
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Load the run and verify it is RUNNING, owned by this claim token
  const { data: run, error: runError } = await adminClient
    .from("workflow_runs")
    .select("status, execution_claim_token, input_variables_json")
    .eq("id", runId)
    .maybeSingle();

  if (runError || !run) {
    return { ok: false };
  }

  if (run.status !== "RUNNING") {
    return { ok: false };
  }

  if (run.execution_claim_token !== claimToken) {
    return { ok: false };
  }

  // Verify accountId matches the run's input_variables_json.accountId
  const inputVars = run.input_variables_json as Record<string, unknown> | null;
  const runAccountId = inputVars?.accountId;
  if (typeof runAccountId !== "string" || runAccountId !== accountId) {
    return { ok: false };
  }

  // Load the account's encrypted password from the DB
  const { data: account, error: accountError } = await adminClient
    .from("accounts")
    .select("encrypted_password")
    .eq("id", accountId)
    .maybeSingle();

  if (accountError || !account || !account.encrypted_password) {
    return { ok: false };
  }

  return { ok: true, encryptedPassword: account.encrypted_password };
}

/**
 * Decrypt: requires internal worker auth, run binding, and DB-loaded ciphertext.
 * Never accepts caller-supplied ciphertext. Returns plaintext only in the HTTPS
 * response body.
 */
async function handleDecrypt(
  supabaseUrl: string,
  serviceRoleKey: string,
  body: VaultRequestBody,
  serverKey: string
): Promise<Response> {
  if (!body.runId || typeof body.runId !== "string") {
    return json({ error: "Invalid request." }, 400);
  }
  if (!body.claimToken || typeof body.claimToken !== "string") {
    return json({ error: "Invalid request." }, 400);
  }
  if (!body.accountId || typeof body.accountId !== "string") {
    return json({ error: "Invalid request." }, 400);
  }

  const binding = await verifyRunAndLoadEncryptedPassword(
    supabaseUrl,
    serviceRoleKey,
    body.runId,
    body.claimToken,
    body.accountId
  );

  if (!binding.ok) {
    return json({ error: "Invalid request." }, 400);
  }

  const payload = binding.encryptedPassword;
  let plaintext: string;
  try {
    if (payload.startsWith(`${SERVER_PAYLOAD_PREFIX}:`)) {
      plaintext = await decryptServerCredential(payload, serverKey);
    } else if (payload.startsWith(`${LEGACY_PAYLOAD_PREFIX}:`)) {
      const legacyKey = Deno.env.get("LEGACY_PILOT_KEY");
      if (!legacyKey || legacyKey.length < MIN_LEGACY_KEY_LENGTH) {
        return json({ error: "Decrypt failed." }, 400);
      }
      plaintext = await decryptLegacyCredential(payload, legacyKey);
    } else {
      return json({ error: "Decrypt failed." }, 400);
    }
  } catch {
    return json({ error: "Decrypt failed." }, 400);
  }

  return json({ plaintext }, 200);
}

/**
 * Dry-run: count v2: rows without writing. ADMIN-only (already authenticated).
 */
async function handleDryRun(
  supabaseUrl: string,
  serviceRoleKey: string,
  body: VaultRequestBody
): Promise<Response> {
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  let query = adminClient
    .from("accounts")
    .select("id")
    .like("encrypted_password", `${LEGACY_PAYLOAD_PREFIX}:%`);

  if (body.accountId) {
    query = query.eq("id", body.accountId);
  }

  const { data, error } = await query;

  if (error) {
    return json({ error: "Failed to query accounts." }, 500);
  }

  const ids = (data ?? []) as Array<{ id: string }>;
  const sampleIds = ids.slice(0, 10).map((r) => r.id);

  return json({ count: ids.length, sample_ids: sampleIds }, 200);
}

/**
 * Migrate: decrypt v2: payloads with legacy key, re-encrypt as s3:, update row.
 * ADMIN-only (already authenticated). Never overwrites original until both
 * decrypt + re-encrypt succeed.
 */
async function handleMigrate(
  supabaseUrl: string,
  serviceRoleKey: string,
  body: VaultRequestBody,
  serverKey: string
): Promise<Response> {
  const legacyKey = Deno.env.get("LEGACY_PILOT_KEY");
  if (!legacyKey || legacyKey.length < MIN_LEGACY_KEY_LENGTH) {
    return json({ error: "Legacy pilot key is not configured or is too weak." }, 500);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  let query = adminClient
    .from("accounts")
    .select("id,encrypted_password")
    .like("encrypted_password", `${LEGACY_PAYLOAD_PREFIX}:%`);

  if (body.accountId) {
    query = query.eq("id", body.accountId);
  }

  const { data: rows, error: fetchError } = await query;

  if (fetchError) {
    return json({ error: "Failed to query accounts for migration." }, 500);
  }

  const accountRows = (rows ?? []) as Array<{ id: string; encrypted_password: string }>;
  const details: Array<{ accountId: string; status: "migrated" | "failed" | "skipped" }> = [];
  let migrated = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of accountRows) {
    let plaintext: string;
    try {
      plaintext = await decryptLegacyCredential(row.encrypted_password, legacyKey);
    } catch {
      await adminClient
        .from("accounts")
        .update({ credential_policy_status: "migration_pending" })
        .eq("id", row.id);
      failed += 1;
      details.push({ accountId: row.id, status: "failed" });
      continue;
    }

    let encryptedPayload: string;
    try {
      const result = await encryptCredential(plaintext, serverKey);
      encryptedPayload = result.encryptedPayload;
    } catch {
      await adminClient
        .from("accounts")
        .update({ credential_policy_status: "migration_pending" })
        .eq("id", row.id);
      failed += 1;
      details.push({ accountId: row.id, status: "failed" });
      continue;
    }

    const { error: updateError } = await adminClient
      .from("accounts")
      .update({
        encrypted_password: encryptedPayload,
        credential_policy_status: "server_managed",
        credential_key_version: 1,
        credential_rotated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (updateError) {
      await adminClient
        .from("accounts")
        .update({ credential_policy_status: "migration_pending" })
        .eq("id", row.id);
      failed += 1;
      details.push({ accountId: row.id, status: "failed" });
      continue;
    }

    migrated += 1;
    details.push({ accountId: row.id, status: "migrated" });
  }

  skipped += 0;
  return json({ migrated, failed, skipped, details }, 200);
}

Deno.serve(async (req: Request) => {
  const requestOrigin = req.headers.get("Origin");
  if (requestOrigin && requestOrigin !== allowedCorsOrigin()) {
    return json({ error: "Origin not allowed." }, 403);
  }
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed. Use POST." }, 405);
  }

  try {
    // --- Validate server credential key (never echoed back) ---
    const serverKey = Deno.env.get("SERVER_CREDENTIAL_KEY");
    if (!serverKey || serverKey.length < MIN_SERVER_KEY_LENGTH) {
      return json({ error: "Server credential key is not configured or is too weak." }, 500);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) {
      return json({ error: "Supabase configuration is missing." }, 500);
    }

    // --- Parse request body first to determine action ---
    let body: VaultRequestBody;
    try {
      const parsedBody: unknown = await req.json();
      if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
        return json({ error: "Invalid JSON body." }, 400);
      }
      body = parsedBody as VaultRequestBody;
    } catch {
      return json({ error: "Invalid JSON body." }, 400);
    }

    // --- Strict action parsing: unknown/missing action returns 400 ---
    const rawAction = body.action;
    if (!rawAction || typeof rawAction !== "string" || !VALID_ACTIONS.has(rawAction)) {
      return json({ error: "Unknown or missing action." }, 400);
    }
    const action = rawAction as VaultAction;

    // --- Route by action with per-action authentication ---

    if (action === "decrypt") {
      // Internal worker auth: exact service-role bearer + worker token
      const authHeader = req.headers.get("Authorization") ?? "";
      const workerTokenHeader = req.headers.get(WORKER_TOKEN_HEADER);

      if (!authenticateWorker(authHeader, workerTokenHeader)) {
        return json({ error: "Unauthorized." }, 401);
      }

      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!serviceRoleKey) {
        return json({ error: "Service role key is not configured." }, 500);
      }

      return await handleDecrypt(supabaseUrl, serviceRoleKey, body, serverKey);
    }

    // --- User actions: encrypt, migrate, dry-run ---
    // These require a real user JWT validated with auth.getUser()
    const authHeader = req.headers.get("Authorization") ?? "";
    const userJwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!userJwt) {
      return json({ error: "Missing Authorization header." }, 401);
    }

    const authResult = await authenticateUser(supabaseUrl, anonKey, userJwt);
    if (!authResult.ok) {
      return json({ error: authResult.status === 401 ? "Unauthorized." : "Forbidden." }, authResult.status);
    }

    const role = authResult.role;

    // --- Role-based authorization ---
    if (action === "encrypt") {
      if (!ALLOWED_ROLES.has(role)) {
        return json({ error: "Forbidden." }, 403);
      }

      if (!body.plaintext || typeof body.plaintext !== "string" || body.plaintext.length === 0) {
        return json({ error: "plaintext is required and must be a non-empty string." }, 400);
      }

      const { encryptedPayload, keyVersion } = await encryptCredential(body.plaintext, serverKey);
      return json({ encryptedPayload, keyVersion }, 200);
    }

    // migrate and dry-run require ADMIN
    if (!ADMIN_ONLY_ROLES.has(role)) {
      return json({ error: "Forbidden. Admin role required for this action." }, 403);
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      return json({ error: "Service role key is not configured." }, 500);
    }

    if (action === "dry-run") {
      return await handleDryRun(supabaseUrl, serviceRoleKey, body);
    }

    // action === "migrate"
    return await handleMigrate(supabaseUrl, serviceRoleKey, body, serverKey);
  } catch {
    return json({ error: "Internal server error." }, 500);
  }
});
