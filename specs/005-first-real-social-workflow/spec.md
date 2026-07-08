# Feature Specification: First Real Social Workflow

Date: 2026-07-07
Status: draft

## Purpose

Define the first real social workflow the pilot is allowed to prove after the single-device technical pilot passes.

This spec keeps the first social proof narrow so the product can verify real behavior without implying broad social-platform safety.

## Selected Workflow

- Platform: Instagram.
- Action: open app, navigate through a pilot-safe target screen, capture screenshot evidence, and record a single account action history event.
- Execution backend: Mobile MCP Android.
- Target count: one Android device for the first proof.
- Account source: operator-created or CSV-imported pilot account.

The first proof does not require following, liking, commenting, messaging, posting, or publishing content. Those actions require a later workflow-specific spec.

## In Scope

- Operator selects one Instagram pilot account.
- Operator selects one dispatchable Android device.
- Operator launches one approved pilot macro.
- Worker executes only supported Mobile MCP V1 actions.
- System records run, step outcomes, artifact evidence, and account action history.
- Analytics source labels must not represent this as production platform success.

## Out Of Scope

- Anti-bot guarantee.
- Bulk engagement.
- Posting, commenting, messaging, following, liking, or scraping.
- Account creation or purchase.
- Circumventing platform restrictions.
- Laixi or iOS execution.
- Parallel/fleet execution.

## Data Model

Existing tables remain the preferred source:

- `accounts`: pilot account identity, platform, blocked state, warm-up stage, daily limits.
- `account_action_history`: one row per completed pilot action event.
- `workflow_runs`: selected macro, target device, selected account/input variables.
- `run_steps`: execution status and metadata.
- `run_artifacts`: screenshot or structured output references if available.
- `audit_logs`: launch and completion events when existing hooks support them.

New fields are not required unless implementation discovers no reliable place to store:

- `account_action_history.action_type = instagram_pilot_open`
- `account_action_history.source_run_id`
- `account_action_history.source_step_id`

## Permissions

| Role | Permissions |
| --- | --- |
| Visitor | No access. |
| Viewer | Can view runs, artifacts, account history, and analytics labels read-only if RLS allows. |
| Operator | Can launch the first social workflow, select owned/allowed accounts, and view results. |
| Admin | Can do everything operator can, plus review audit/readiness context. |
| System Worker | Can record action history only for the selected account and completed workflow step. |

## Routes And Endpoints

Use existing routes where possible:

- `/runs/new`: select macro, account, device, and inputs.
- `/runs/:id`: inspect step status, artifacts, retry/failure metadata.
- `/accounts`: inspect account status and history.
- `/analytics`: inspect data-source label.

No new public route is required for the first workflow.

## Use Cases

### Operator Can

- La operator, toi co the chon mot Instagram pilot account de chay first social workflow.
- La operator, toi co the chon mot Android device dispatchable de chay workflow.
- La operator, toi co the launch approved Instagram pilot macro qua Mobile MCP.
- La operator, toi co the xem run result, artifact evidence, va account action history sau khi chay.

### Operator Cannot

- La operator, toi KHONG THE chay first social workflow neu account bi blocked, vuot daily budget, hoac thieu credential policy.
- La operator, toi KHONG THE chay action ngoai scope nhu follow/like/comment/post/message trong spec nay.
- La operator, toi KHONG THE chay workflow tren target offline, stale, locked, hoac khong phai Android Mobile MCP.
- La operator, toi KHONG THE coi workflow nay la anti-detection proof.

### Error Cases

- Khi selected account blocked, preflight phai block launch va hien reason.
- Khi selected account over daily budget, preflight phai block hoac require approved policy neu sau nay co rule rieng.
- Khi selected device offline/stale/locked, preflight phai block dispatch.
- Khi macro co step khong support Mobile MCP V1, preflight hoac worker phai fail voi unsupported step reason.
- Khi run thanh cong nhung action history khong ghi duoc, run summary phai hien persistence warning thay vi claim full proof.

## Acceptance Criteria

- One operator can launch the first Instagram pilot workflow from existing run flow.
- The run uses exactly one selected account and one selected Android device.
- Unsupported social actions are blocked by scope guard or absent from the approved macro.
- Completed workflow writes a concrete action history event tied to the run.
- Run detail shows terminal status and evidence.
- Viewer can inspect evidence read-only.
- No UI copy or report claims anti-bot safety or production platform readiness.

## Verification

- Unit or integration test for account/device preflight blockers.
- Worker/service test for account action history persistence.
- E2E or manual script that prints selected account, selected device, run id, terminal status, and action history row.
