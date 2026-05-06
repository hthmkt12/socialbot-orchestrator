import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  handleCancelControlAction,
  handleStartControlAction,
  type ControlRunRecord,
  type RunControlAction,
  type WorkflowRunControlStore,
} from "../../../packages/shared/src/workflow-run-control.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RunPayload {
  runId: string;
  action: RunControlAction;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
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

function createControlStore(supabase: ReturnType<typeof createClient>): WorkflowRunControlStore {
  return {
    async getRun(runId: string) {
      const { data, error } = await supabase
        .from("workflow_runs")
        .select("id, status, summary_json")
        .eq("id", runId)
        .maybeSingle();
      assertNoError(error);
      if (!data) return null;
      return {
        id: data.id,
        status: data.status,
        summaryJson: (data.summary_json as Record<string, unknown> | null) ?? null,
      } satisfies ControlRunRecord;
    },
    async queuePendingRun(runId: string, summaryJson: Record<string, unknown>) {
      const { data, error } = await supabase
        .from("workflow_runs")
        .update({ status: "QUEUED", summary_json: summaryJson })
        .eq("id", runId)
        .eq("status", "PENDING")
        .select("id, status, summary_json")
        .maybeSingle();
      assertNoError(error);
      return data ? { id: data.id, status: data.status, summaryJson: (data.summary_json as Record<string, unknown> | null) ?? null } : null;
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
        .select("id, status, summary_json")
        .maybeSingle();
      assertNoError(error);
      return data ? { id: data.id, status: data.status, summaryJson: (data.summary_json as Record<string, unknown> | null) ?? null } : null;
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
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const supabase = createClient(
      readRequiredEnv("SUPABASE_URL"),
      readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const payload = await req.json() as RunPayload;
    if (!payload.runId) return json({ error: "runId is required" }, 400);
    if (payload.action !== "start" && payload.action !== "cancel") {
      return json({ error: "Invalid action. Supported: 'start' or 'cancel'" }, 400);
    }

    const store = createControlStore(supabase);
    const run = await store.getRun(payload.runId);
    if (!run) return json({ error: "Run not found" }, 404);

    return payload.action === "start"
      ? json(await handleStartControlAction(store, run))
      : json(await handleCancelControlAction(store, run));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
