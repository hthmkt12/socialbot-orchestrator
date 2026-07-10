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
 * credential-vault Edge Function (Phase D - Encrypt + Migrate, Phase E - Decrypt)
 *
 * Purpose:
 *   Accept plaintext social credentials over HTTPS and return an encrypted
 *   `s3:` payload that the caller persists. The encryption key
 *   (`SERVER_CREDENTIAL_KEY`) never leaves the server.
 *
 * Phase D additions:
 *   - `action: 'migrate'` (ADMIN only) decrypts legacy `v2:` payloads with the
 *     `LEGACY_PILOT_KEY` server secret, re-encrypts as `s3:`, and updates the
 *     `accounts` row. Service-role client is used for DB writes.
 *   - `action: 'dry-run'` (ADMIN only) counts `v2:` rows without writing.
 *   - `v2:` decrypt support is retained; original payloads are never
 *     overwritten until decrypt + re-encrypt both succeed.
 *   - No plaintext logging. Plaintext, keys, ciphertext are never logged or
 *     returned in errors.
 *
 * Phase E additions:
 *   - `action: 'decrypt'` (ADMIN only) decrypts an `s3:` or `v2:` payload and
 *     returns the plaintext to the caller (the execution worker). Plaintext is
 *     returned only over the authenticated service-role channel and is never
 *     logged or persisted by this function.
 *
 * Auth:
 *   Requires a valid Supabase JWT in the Authorization header.
 *   - `encrypt` action: OPERATOR or ADMIN.
 *   - `migrate` / `dry-run` / `decrypt` actions: ADMIN only.
 *   Unauthenticated callers get 401; unauthorized roles get 403.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ALLOWED_ROLES = new Set(["OPERATOR", "ADMIN"]);
const ADMIN_ONLY_ROLES = new Set(["ADMIN"]);
type VaultAction = "encrypt" | "migrate" | "dry-run" | "decrypt";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface VaultRequestBody {
  plaintext?: string;
  accountId?: string;
  action?: string;
  encryptedPayload?: string;
}

/**
 * Dry-run: count `v2:` rows without writing. Admin-only.
 * Returns `{ count, sample_ids }` where sample_ids are redacted account ids
 * (max 10). Never returns usernames or plaintext.
 */
async function handleDryRun(
  supabaseUrl: string,
  body: VaultRequestBody
): Promise<Response> {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
    return json({ error: "Service role key is not configured." }, 500);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Count rows with legacy v2: prefix (no plaintext returned), optionally
  // filtered by accountId for a single-account dry-run check.
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
 * Migrate: decrypt `v2:` payloads with the legacy pilot key, re-encrypt as
 * `s3:`, and update the `accounts` row. Admin-only. Never overwrites the
 * original payload until decrypt + re-encrypt both succeed.
 */
async function handleMigrate(
  supabaseUrl: string,
  body: VaultRequestBody,
  serverKey: string
): Promise<Response> {
  const legacyKey = Deno.env.get("LEGACY_PILOT_KEY");
  if (!legacyKey || legacyKey.length < MIN_LEGACY_KEY_LENGTH) {
    return json({ error: "Legacy pilot key is not configured or is too weak." }, 500);
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
    return json({ error: "Service role key is not configured." }, 500);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Fetch rows with legacy v2: prefix (optionally filtered by accountId)
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
    // Step 1: Decrypt the legacy v2: payload (never overwrite until this succeeds)
    let plaintext: string;
    try {
      plaintext = await decryptLegacyCredential(row.encrypted_password, legacyKey);
    } catch {
      // Decrypt failed - mark row as migration_pending, keep original payload
      await adminClient
        .from("accounts")
        .update({ credential_policy_status: "migration_pending" })
        .eq("id", row.id);
      failed += 1;
      details.push({ accountId: row.id, status: "failed" });
      continue;
    }

    // Step 2: Re-encrypt with server key (s3: payload)
    let encryptedPayload: string;
    try {
      const result = await encryptCredential(plaintext, serverKey);
      encryptedPayload = result.encryptedPayload;
    } catch {
      // Re-encrypt failed - mark row as migration_pending, keep original payload
      await adminClient
        .from("accounts")
        .update({ credential_policy_status: "migration_pending" })
        .eq("id", row.id);
      failed += 1;
      details.push({ accountId: row.id, status: "failed" });
      continue;
    }

    // Step 3: Both succeeded - safe to overwrite original payload now
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
      // DB update failed - mark row as migration_pending, keep original payload
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

  // If batch mode and no accountId filter, count any rows we did not process
  // (e.g. rows that matched but were not v2: - should not happen with LIKE filter)
  skipped += 0;

  return json({ migrated, failed, skipped, details }, 200);
}

/**
 * Decrypt: decrypt an `s3:` or `v2:` payload and return the plaintext to the
 * caller (the execution worker). Admin-only. Never logs plaintext, ciphertext,
 * or keys. On any failure returns a generic 400 error with no sensitive detail.
 */
async function handleDecrypt(
  body: VaultRequestBody,
  serverKey: string
): Promise<Response> {
  if (!body.encryptedPayload || typeof body.encryptedPayload !== "string" || body.encryptedPayload.length === 0) {
    return json({ error: "encryptedPayload is required." }, 400);
  }

  const payload = body.encryptedPayload;
  let plaintext: string;
  try {
    if (payload.startsWith(`${SERVER_PAYLOAD_PREFIX}:`)) {
      // s3: payload - decrypt with server credential key
      plaintext = await decryptServerCredential(payload, serverKey);
    } else if (payload.startsWith(`${LEGACY_PAYLOAD_PREFIX}:`)) {
      // v2: payload - decrypt with legacy pilot key
      const legacyKey = Deno.env.get("LEGACY_PILOT_KEY");
      if (!legacyKey || legacyKey.length < MIN_LEGACY_KEY_LENGTH) {
        return json({ error: "Decrypt failed." }, 400);
      }
      plaintext = await decryptLegacyCredential(payload, legacyKey);
    } else {
      return json({ error: "Decrypt failed." }, 400);
    }
  } catch {
    // Never leak decrypt error details that could expose key material state.
    return json({ error: "Decrypt failed." }, 400);
  }

  return json({ plaintext }, 200);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
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

    // --- Authenticate caller via JWT ---
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) {
      return json({ error: "Missing Authorization header." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) {
      return json({ error: "Supabase configuration is missing." }, 500);
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return json({ error: "Unauthorized." }, 401);
    }
    const userId = userData.user.id;

    // --- Authorize role against profiles table ---
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError || !profile) {
      return json({ error: "Forbidden." }, 403);
    }
    if (!ALLOWED_ROLES.has(profile.role)) {
      return json({ error: "Forbidden." }, 403);
    }

    // --- Parse and validate request body ---
    let body: VaultRequestBody;
    try {
      body = (await req.json()) as VaultRequestBody;
    } catch {
      return json({ error: "Invalid JSON body." }, 400);
    }

    // Determine action (default to encrypt for backward compatibility)
    const action: VaultAction =
      body.action === "migrate" || body.action === "dry-run" || body.action === "decrypt"
        ? body.action
        : "encrypt";

    // --- Admin-only action authorization ---
    if (action !== "encrypt" && !ADMIN_ONLY_ROLES.has(profile.role)) {
      return json({ error: "Forbidden. Admin role required for this action." }, 403);
    }

    // --- Route by action ---
    if (action === "dry-run") {
      return await handleDryRun(supabaseUrl, body);
    }

    if (action === "migrate") {
      return await handleMigrate(supabaseUrl, body, serverKey);
    }

    if (action === "decrypt") {
      return await handleDecrypt(body, serverKey);
    }

    // --- Encrypt action (existing behavior) ---
    if (
      !body.plaintext ||
      typeof body.plaintext !== "string" ||
      body.plaintext.length === 0
    ) {
      return json({ error: "plaintext is required and must be a non-empty string." }, 400);
    }

    // accountId is accepted for forward-compatibility but unused in encrypt
    // (no DB writes are performed here).

    // --- Encrypt (no DB writes, no plaintext logging) ---
    const { encryptedPayload, keyVersion } = await encryptCredential(
      body.plaintext,
      serverKey
    );

    return json({ encryptedPayload, keyVersion }, 200);
  } catch {
    // Never echo error details that may contain sensitive material.
    return json({ error: "Internal server error." }, 500);
  }
});
