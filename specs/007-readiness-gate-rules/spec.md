# Feature Specification: Readiness Gate Rules

Date: 2026-07-07
Status: draft

## Purpose

Define which readiness failures block operation, which failures only block verification claims, and which information is read-only evidence.

## Gate Model

Readiness has three gate types:

- `launch_blocker`: operator cannot dispatch the run.
- `verification_blocker`: run may exist, but admin cannot mark pilot verified.
- `warning`: user may continue, but the risk must be visible in report/run detail.

## In Scope

- Mobile MCP Android readiness gates.
- Run wizard/preflight gating.
- Admin readiness report review gating.
- Viewer read-only access to readiness status.
- Secret scrubbing as a verification prerequisite.

## Out Of Scope

- Billing or customer-facing compliance gates.
- Laixi/iOS verification unless their proof specs are satisfied.
- Production credential-vault gating beyond pilot key validation.
- Native mobile or offline mode.

## Data Model

Use existing readiness report fields where possible.

If implementation needs explicit gate persistence, add:

- `readiness_gate_results`
  - `id`
  - `report_id`
  - `gate_key`
  - `gate_type`: `launch_blocker`, `verification_blocker`, `warning`
  - `status`: `passed`, `failed`, `skipped`
  - `message`
  - `evidence_json`
  - `created_at`

Gate result evidence must not store secrets.

## Permissions

| Role | Permissions |
| --- | --- |
| Visitor | No access. |
| Viewer | Read readiness status and gate messages only. |
| Operator | Run checks, see blockers, submit report. |
| Admin | Review reports and set readiness status when verification blockers pass. |
| System Worker | Emits execution evidence but cannot mark readiness verified. |
| Mobile MCP Bridge | Emits health/capability evidence but cannot mark readiness verified. |

## Routes And Endpoints

Use existing or planned surfaces:

- `/device-setup`: local readiness checks and recovery hints.
- `/runs/new`: launch preflight blockers.
- `/readiness-reports`: submit/review readiness reports.
- `/runs/:id`: evidence and terminal status.

## Gate Rules

### Launch Blockers

- User is not authenticated.
- Role is viewer or visitor.
- Expected device serial is missing/offline.
- Target device is stale, locked, or capability-incompatible.
- Mobile MCP protected endpoint requires token and token is missing/invalid.
- Macro contains unsupported Mobile MCP V1 step.
- Required macro input is missing.
- Selected account is blocked.
- Selected account is over daily budget when policy says hard block.
- Credential key is missing when selected workflow requires account credential.

### Verification Blockers

- Missing run id.
- Run has no terminal status.
- Missing device/session evidence.
- Missing backend mode.
- Missing artifact or structured output evidence.
- Secret scrub status is not passed.
- Claim summary includes Laixi/iOS/fleet/social-production claim without matching evidence.
- Reviewer is not admin.

### Warnings

- Analytics source is `seed data`.
- Analytics source is `insufficient data`.
- Runtime evidence is older than the configured freshness window.
- Device count is below future fleet target but valid for Level 1.
- Run completed with non-critical artifact preview fallback.

## Use Cases

### Operator Can

- La operator, toi co the xem launch blockers truoc khi dispatch.
- La operator, toi co the submit readiness report khi launch proof da co evidence.
- La operator, toi co the xem recovery hint cho failed gate.

### Operator Cannot

- La operator, toi KHONG THE bypass launch blocker.
- La operator, toi KHONG THE mark failed verification gate thanh passed.
- La operator, toi KHONG THE submit report co secret chua scrub.

### Admin Can

- La admin, toi co the review gate results va mark report theo status hop le.

### Admin Cannot

- La admin, toi KHONG THE mark `pilot_verified` neu verification blocker failed.
- La admin, toi KHONG THE override unsupported claim thanh verified ma khong co proof.

### Error Cases

- Khi gate evidence thieu field bat buoc, gate failed voi field name cu the.
- Khi gate service loi, report status la `needs_rerun` hoac `not_verified`, khong auto-pass.
- Khi readiness report da bi xoa/het han, viewer thay not found/expired state.

## Acceptance Criteria

- Every blocker has a stable gate key and user-visible message.
- Launch blockers prevent run creation/dispatch.
- Verification blockers prevent `pilot_verified`.
- Warnings are visible but do not block.
- Viewer cannot mutate gate or report status.
- Failed gates include recovery hints where practical.

## Verification

- Unit tests for launch blocker classification.
- Unit tests for verification blocker classification.
- Permission tests for viewer/operator/admin mutation boundaries.
- Scripted output printing gate key, type, status, and message for at least one passing and one failing readiness report.
