import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { encryptCredential, MIN_SERVER_KEY_LENGTH } from "./crypto-helper.ts";

/*
 * credential-vault Edge Function (Phase B - Encrypt Only)
 *
 * Purpose:
 *   Accept plaintext social credentials over HTTPS and return an encrypted
 *   `s3:` payload that the caller persists. The encryption key
 *   (`SERVER_CREDENTIAL_KEY`) never leaves the server.
 *
 * Phase B scope (intentionally limited):
 *   - Encrypt ONLY. There is NO decrypt endpoint.
 *   - No key migration or rotation.
 *   - No database writes. The caller is responsible for storing the returned
 *     encrypted payload; this function never touches the DB.
 *   - No plaintext logging. Plaintext, the request body, ciphertext, and keys
 *     are never logged or returned in errors.
 *
 * Auth:
 *   Requires a valid Supabase JWT in the Authorization header. The caller's
 *   `profiles.role` must be OPERATOR or ADMIN. Unauthenticated callers get 401;
 *   VIEWER / unknown roles get 403.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ALLOWED_ROLES = new Set(["OPERATOR", "ADMIN"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface VaultRequestBody {
  plaintext?: string;
  accountId?: string;
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

    if (
      !body.plaintext ||
      typeof body.plaintext !== "string" ||
      body.plaintext.length === 0
    ) {
      return json({ error: "plaintext is required and must be a non-empty string." }, 400);
    }

    // accountId is accepted for forward-compatibility but unused in Phase B
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
