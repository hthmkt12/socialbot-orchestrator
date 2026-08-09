import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  handleCancelControlAction,
  handleStartControlAction,
  type ControlRunRecord,
  type RunControlAction,
  type WorkflowRunControlStore,
} from "../../../packages/shared/src/workflow-run-control.ts";
import {
  assertRunControlAuthorized,
  assertRunControlRole,
  RunControlAuthorizationError,
} from "../../../packages/shared/src/run-control-authorization.ts";

function corsHeaders(origin: string | null) {
  const trustedOrigin = Deno.env.get("EXECUTE_RUN_ALLOWED_ORIGIN") ?? "http://localhost:5173";
  return {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
    Vary: "Origin",
    ...(origin === null || origin === trustedOrigin ? { "Access-Control-Allow-Origin": trustedOrigin } : {}),
  };
}

interface RunPayload {
  runId: string;
  action: RunControlAction;
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

function readRequiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function assertNoError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function readBearer(req: Request) {
  const value = req.headers.get("Authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

async function authenticate(req: Request, adminClient: ReturnType<typeof createClient>) {
  const token = readBearer(req);
  if (!token) throw new RunControlAuthorizationError(401, "Authentication required.");
  const userClient = createClient(readRequiredEnv("SUPABASE_URL"), readRequiredEnv("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new RunControlAuthorizationError(401, "Authentication required.");
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, role")
    .eq("user_id", data.user.id)
    .maybeSingle();
  assertNoError(profileError);
  if (!profile?.id) throw new RunControlAuthorizationError(403, "Run control is not allowed for this profile.");
  return { userId: profile.id as string, role: profile.role as string | undefined };
}

function createControlStore(supabase: ReturnType<typeof createClient>): WorkflowRunControlStore {
  return {
    async getRun(runId: string) {
      const { data, error } = await supabase
        .from("workflow_runs")
        .select("id, status, summary_json, triggered_by_user_id")
        .eq("id", runId)
        .maybeSingle();
      assertNoError(error);
      if (!data) return null;
      return {
        id: data.id,
        status: data.status,
        summaryJson: (data.summary_json as Record<string, unknown> | null) ?? null,
        triggeredByUserId: data.triggered_by_user_id,
      } satisfies ControlRunRecord;
    },
    async queuePendingRun(runId: string, summaryJson: Record<string, unknown>) {
      const { data, error } = await supabase
        .from("workflow_runs")
        .update({ status: "QUEUED", summary_json: summaryJson })
        .eq("id", runId)
        .eq("status", "PENDING")
        .select("id, status, summary_json, triggered_by_user_id")
        .maybeSingle();
      assertNoError(error);
      return data ? { id: data.id, status: data.status, summaryJson: (data.summary_json as Record<string, unknown> | null) ?? null, triggeredByUserId: data.triggered_by_user_id } : null;
    },
    async updateRunSummary(runId: string, summaryJson: Record<string, unknown>) {
      const { error } = await supabase.from("workflow_runs").update({ summary_json: summaryJson }).eq("id", runId);
      assertNoError(error);
    },
    async cancelActiveRun(runId: string, now: string, summaryJson: Record<string, unknown>) {
      const { data, error } = await supabase
        .from("workflow_runs")
        .update({
          status: "CANCELLED",
          cancelled_at: now,
          finished_at: now,
          execution_owner: null,
          execution_claim_token: null,
          execution_lease_expires_at: null,
          execution_heartbeat_at: null,
          summary_json: summaryJson,
        })
        .eq("id", runId)
        .in("status", ["PENDING", "QUEUED", "RUNNING", "WAITING_APPROVAL"])
        .select("id, status, summary_json, triggered_by_user_id")
        .maybeSingle();
      assertNoError(error);
      return data ? { id: data.id, status: data.status, summaryJson: (data.summary_json as Record<string, unknown> | null) ?? null, triggeredByUserId: data.triggered_by_user_id } : null;
    },
    async cleanupCancelledRun(runId: string, now: string) {
      const { data: pending, error: pendingError } = await supabase
        .from("run_steps")
        .select("id")
        .eq("workflow_run_id", runId)
        .in("status", ["PENDING", "RUNNING", "RETRYING", "WAITING_APPROVAL"]);
      assertNoError(pendingError);
      const ids = (pending ?? []).map((row: { id: string }) => row.id);
      if (ids.length > 0) {
        const { error } = await supabase.from("run_steps").update({ status: "CANCELLED", finished_at: now }).in("id", ids);
        assertNoError(error);
      }
      const { error: lockError } = await supabase.from("device_locks").delete().eq("workflow_run_id", runId);
      assertNoError(lockError);
      const { error: approvalError } = await supabase
        .from("approvals")
        .update({ status: "EXPIRED" })
        .eq("workflow_run_id", runId)
        .eq("status", "PENDING");
      assertNoError(approvalError);
    },
  };
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);

  try {
    const supabase = createClient(
      readRequiredEnv("SUPABASE_URL"),
      readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const actor = await authenticate(req, supabase);
    assertRunControlRole(actor.role);
    let payload: RunPayload;
    try {
      payload = await req.json() as RunPayload;
    } catch {
      return json({ error: "Invalid JSON body." }, 400, origin);
    }
    if (!payload.runId) return json({ error: "runId is required" }, 400, origin);
    if (payload.action !== "start" && payload.action !== "cancel") {
      return json({ error: "Invalid action. Supported: 'start' or 'cancel'" }, 400, origin);
    }

    const store = createControlStore(supabase);
    const run = await store.getRun(payload.runId);
    assertRunControlAuthorized({ userId: actor.userId, role: actor.role, runExists: !!run, runOwnerId: run?.triggeredByUserId });

    return payload.action === "start"
      ? json(await handleStartControlAction(store, run!), 200, origin)
      : json(await handleCancelControlAction(store, run!), 200, origin);
  } catch (err) {
    if (err instanceof RunControlAuthorizationError) return json({ error: err.message }, err.status, origin);
    return json({ error: "Run control failed." }, 500, origin);
  }
});
