# Feature Specification: Pilot Success Criteria

Date: 2026-07-07
Status: draft

## Purpose

Define the smallest truthful pilot that the project can claim as "ready".

This spec does not add new runtime features. It defines the acceptance gate for the next verification and implementation cycles.

## Product Claim

SocialBot Orchestrator is pilot-ready when an authenticated operator can run a verified social-device workflow through Mobile MCP on real Android hardware, with auditable evidence, clear failure handling, and no unsupported production claims.

## In Scope

- Mobile MCP Android local runtime.
- One authenticated operator.
- One admin reviewer.
- One viewer/read-only reviewer.
- One or more real Android devices visible to ADB.
- Supabase-backed workflow run creation, execution, monitoring, artifacts, audit evidence, and readiness review.
- Social workflow proof limited to approved pilot macros and explicit operator inputs.
- Evidence that secrets are scrubbed from reports and artifacts.

## Out Of Scope

- Billing, marketplace, public social graph, native mobile app, and AI workflow builder.
- Laixi live readiness without VIP/API/live session proof.
- iOS readiness without Portal and iproxy proof.
- Anti-bot or anti-detection guarantee.
- Production-grade credential vault unless separately specified.
- Large fleet SLA beyond the selected pilot device count.
- External customer audit/export package.

## Pilot Levels

### Level 1: Single-Device Technical Pilot

This is the first target and the default next milestone.

Acceptance criteria:

- `npm.cmd run lint` passes.
- `npm.cmd run build` passes.
- `npm.cmd run test` passes.
- `npm.cmd run typecheck` passes.
- Mobile MCP bridge health is reachable.
- Expected Android serial is visible to ADB.
- Operator can launch one workflow run against the expected Android device.
- Worker claims and executes the run.
- Run reaches a terminal state: `COMPLETED`, `FAILED`, `PARTIAL_SUCCESS`, or `CANCELLED`.
- At least one device artifact or structured execution output is persisted.
- Run detail or monitor shows step status, retry/failure metadata when applicable, and artifact preview/fallback.
- Admin can review a readiness report that includes runtime health, device serial, backend mode, run id, artifact evidence, and timestamp.
- Viewer can inspect the readiness/report surfaces read-only.

### Level 2: Small Social Workflow Pilot

This is eligible only after Level 1 passes.

Acceptance criteria:

- Uses one explicitly selected social platform: Instagram, TikTok, or Facebook.
- Uses one explicitly selected social action type.
- Uses only accounts the operator created or imported for pilot use.
- Blocks selected accounts that are flagged blocked, over daily budget, or missing required credential policy.
- Records account action history for successful actions.
- Shows analytics source as `real persisted data`, `seed data`, or `insufficient data`.
- Does not claim platform safety or anti-detection guarantee.

### Level 3: Small Fleet Pilot

This is eligible only after Level 2 passes.

Acceptance criteria:

- Device count is explicitly selected before verification.
- Default target is 5 Android devices unless the project owner specifies another count.
- All target devices must be online, not stale, not locked, and capability-compatible.
- Multi-target behavior must declare one policy before dispatch: `fail_fast` or `skip_failed_target`.
- Run summary must show per-target outcome and skipped/failed target decisions.
- No speed or parallel SLA is claimed unless separately specified and measured.

## Roles

### Operator

Can:

- Run the Level 1 pilot checklist.
- Launch the selected pilot workflow.
- Submit readiness evidence for admin review.
- See go/no-go status and failed checks.

Cannot:

- Mark pilot readiness as verified.
- Bypass device preflight, account safety checks, approval gates, or retry limits.
- Treat seed/demo analytics as real pilot metrics.

Error handling:

- Missing expected serial shows a blocking readiness failure and recovery hint.
- Bridge, worker, Supabase, or UI health failure marks readiness as not verified.
- Missing artifact evidence prevents pilot verification.

### Admin

Can:

- Review pilot readiness evidence.
- Mark readiness as `pilot_verified`, `not_verified`, or `needs_rerun`.
- Reject reports missing device, backend, run, artifact, or timestamp evidence.

Cannot:

- Verify Laixi or iOS readiness without their specific proof.
- Verify a report containing unsanitized secret/token/password fields.
- Convert Level 1 success into Level 2 or Level 3 claims without separate evidence.

Error handling:

- Incomplete evidence returns a concrete list of missing fields.
- Unsupported backend claims are rejected with a proof-gated reason.

### Viewer

Can:

- View pilot status, report metadata, and run evidence read-only.

Cannot:

- Submit reports, verify reports, change policy, or view secrets.

Error handling:

- RLS/access denial shows an access-safe empty state.

## Required Evidence Fields

- `verified_at`
- `submitted_by`
- `reviewed_by`
- `backend_mode`
- `bridge_health`
- `worker_health`
- `supabase_health`
- `expected_serials`
- `observed_serials`
- `run_id`
- `run_status`
- `artifact_refs`
- `secret_scrub_status`
- `pilot_level`
- `claim_summary`
- `review_status`
- `review_notes`

## Anti-Claims

The system must not claim:

- Production social credential safety.
- Anti-bot guarantee.
- Laixi live readiness without live proof.
- iOS readiness without Portal proof.
- Fleet speed SLA without measured data.
- Customer-ready external audit package.

## Recommended Next Specification

The next specs should be read in this order:

1. First real social workflow: platform, action, account inputs, macro steps, success output.
2. Credential boundary: what secrets are stored, where encryption happens, who can decrypt.
3. Readiness gates: whether unverified backend/device state blocks run launch.
4. Fleet target: exact device count and failure policy for Level 3.
5. Artifact retention/object storage: what stays inline, what moves to storage, and how long evidence is kept.
