# Use Cases Architecture Spec

Date: 2026-07-07
Status: draft-for-implementation
Source: `docs/use-cases.md`

## Purpose

This spec maps the current use cases to:

- Data model tables and relationships.
- Role to permission rules.
- Frontend routes and backend/control endpoints.
- Anti-use-case enforcement rules.
- Error-case validation and handling.

No orphan design rule: every proposed table, permission, route, endpoint, validation, or rule must trace to at least one use case, anti-use case, error case, or out-of-scope guardrail from `docs/use-cases.md`.

## Scope Baseline

Verified strongest use case: Android Mobile MCP workflow orchestration on a real device.

Conditional areas:

- Laixi live proof requires VIP/API/live session.
- iOS proof requires Portal app and `iproxy`.
- Social platform safety is not guaranteed.
- Social account password encryption is pilot-only until moved server-side.
- Multi-target execution is acceptable as sequential pilot behavior.

## Data Model

### Core Identity

| Table | Fields | Relationships | Use cases |
| --- | --- | --- | --- |
| `profiles` | `id`, `user_id`, `email`, `role`, timestamps | `user_id` maps to Supabase auth user. Referenced by macros, runs, approvals, audit logs, accounts. | Visitor registration, Viewer/Operator/Admin RBAC. |

Rules:

- `role` enum: `ADMIN`, `OPERATOR`, `VIEWER`.
- Default new profile role: `OPERATOR` unless changed by admin policy.
- Only admin can assign or change roles.

### Devices

| Table | Fields | Relationships | Use cases |
| --- | --- | --- | --- |
| `devices` | `id`, `laixi_device_id`, `name`, `model`, `brand`, `android_version`, `screen_width`, `screen_height`, `status`, `last_seen_at`, `heartbeat_freshness`, `last_error_message`, `last_error_at`, `metadata_json`, timestamps | Referenced by `device_group_members`, `workflow_runs.target_selector_json`, `run_steps`, `artifacts`, `device_locks`. | Device fleet, target selection, Mobile MCP sync, device readiness. |
| `device_groups` | `id`, `name`, `description`, timestamps | Parent for `device_group_members`. | Group target runs. |
| `device_group_members` | `id`, `device_group_id`, `device_id` | Many-to-many between groups and devices. | Device group membership. |
| `device_locks` | `id`, `device_id`, `workflow_run_id`, `acquired_at`, `expires_at` | Prevents concurrent same-device execution. | Worker lock, lock cleanup, dispatch safety. |

Rules:

- Device identity is backend-specific. For Mobile MCP Android, `laixi_device_id` stores ADB serial.
- Dispatch should block offline/stale/locked devices.
- Same serial must be serialized by bridge/session manager.

### Macros And Runs

| Table | Fields | Relationships | Use cases |
| --- | --- | --- | --- |
| `macros` | `id`, `key`, `name`, `description`, `latest_version_id`, `created_by_user_id`, timestamps | Has many `macro_versions`. | Macro management and review. |
| `macro_versions` | `id`, `macro_id`, `version_number`, `status`, `definition_json`, `input_schema_json`, `tags_json`, `created_by_user_id`, `created_at` | Referenced by `workflow_runs`. | Versioned workflow execution. |
| `execution_profiles` | `id`, `name`, `description`, `concurrency_per_device`, `default_timeout_ms`, `max_retries`, `retry_base_delay_ms`, `retry_max_delay_ms`, `retry_max_elapsed_ms`, `target_failure_policy`, `require_approval_for_adb`, `require_approval_for_autox`, timestamps | Optional run config reference. | Admin execution config, retry/backoff policy, and target failure policy. |
| `workflow_runs` | `id`, `macro_version_id`, `triggered_by_user_id`, `target_type`, `target_selector_json`, `status`, `input_variables_json`, `execution_profile_id`, lifecycle timestamps, claim/lease fields, `summary_json`, timestamps | Has many `run_steps`, `artifacts`, `approvals`; referenced by `device_locks`. | Run creation, queue, monitor, cancel, resume. |
| `run_steps` | `id`, `workflow_run_id`, `device_id`, `step_index`, `step_id`, `step_type`, `status`, `input_json`, `output_json`, `error_json`, lifecycle timestamps, `retry_count`, `screenshot_artifact_id`, `created_at` | Step history for run/device. | Monitor, debug, error handling. |
| `artifacts` | `id`, `workflow_run_id`, `device_id`, `type`, `storage_key`, `content_type`, `size`, `metadata_json`, `created_at` | Belongs to run and optional device. | Screenshot/log/json previews. |
| `approvals` | `id`, `workflow_run_id`, `run_step_id`, `status`, `requested_by_user_id`, `reviewed_by_user_id`, `reason`, `payload_json`, `created_at`, `reviewed_at`, step metadata, reviewer metadata | Approval gate for sensitive steps. | Approval checkpoint and resume. |

Rules:

- `workflow_runs.status` terminal states: `COMPLETED`, `FAILED`, `CANCELLED`, `PARTIAL_SUCCESS`.
- `WAITING_APPROVAL` releases worker ownership and resumes after approval.
- Sensitive steps require approval before backend dispatch.
- Mobile MCP V1 does not support `run_autox`.
- Retry/backoff policy must be bounded by max retries and max elapsed time.
- Retry metadata should be persisted to step output/error for operator review.
- Target failure policy enum: `fail_fast` or `skip_failed_target`.
- Target failure summaries must preserve original failed target and error.

### Social Accounts

| Table | Fields | Relationships | Use cases |
| --- | --- | --- | --- |
| `accounts` | `id`, `user_id`, `username`, `encrypted_password`, `platform`, `warm_up_started_at`, `warm_up_stage`, `daily_action_limit`, `current_action_count`, `last_action_reset_at`, `is_blocked`, `detected_block_reason`, timestamps | Referenced by run inputs and `account_action_history`, `account_analytics`. | Account setup, warm-up, block tracking. |
| `account_action_history` | `id`, `account_id`, `action_type`, `step_id`, `success`, `error_message`, `created_at` | Belongs to account. | Action audit and budget tracking. |
| `account_analytics` | `id`, `account_id`, `snapshot_date`, follower/following/post counts, `engagement_rate`, `created_at` | Belongs to account. | Analytics UI. |

Rules:

- `platform` enum: `instagram`, `tiktok`, `facebook`.
- Password must be encrypted before insert.
- Current browser encryption is pilot-only.
- Blocked accounts must not be used for unsafe social engagement runs.

### Scheduling And Audit

| Table | Fields | Relationships | Use cases |
| --- | --- | --- | --- |
| `workflow_schedules` | `id`, `name`, `macro_id`, `macro_version_id`, `target_type`, target fields, `input_variables`, `cron_expression`, `timezone`, `is_active`, `next_run_at`, `last_run_at`, timestamps, `created_by` | Creates future `workflow_runs`. | Scheduler role. |
| `audit_logs` | `id`, `actor_user_id`, `action`, `resource_type`, `resource_id`, `metadata_json`, `created_at` | Actor is profile. | Audit visibility and investigation. |

Rules:

- Schedule trigger creates queued runs; worker executes them.
- Audit logs are append-only from app perspective.
- Admin can view all audit logs; operator can view permitted audit surfaces; viewer does not get audit navigation.

### Pilot Readiness

| Table | Fields | Relationships | Use cases |
| --- | --- | --- | --- |
| `pilot_readiness_reports` | `id`, `backend`, `status`, `report_path`, `evidence_json`, `created_by_user_id`, `reviewed_by_user_id`, `reviewed_at`, `review_notes`, timestamps | Creator/reviewer reference `profiles.user_id`. | Viewer readiness read, Operator readiness submit, Admin readiness review. |

Rules:

- `backend` enum: `mobile_mcp`, `laixi`, `ios_portal`, `unknown`.
- `status` enum: `draft`, `submitted`, `pilot_verified`, `not_verified`, `needs_rerun`.
- Evidence JSON must be scrubbed for secret-like keys before insert.
- `pilot_verified` requires backend proof, runtime/report status, device/session evidence, and run/smoke evidence.
- LAIXI verification additionally requires `laixiLiveSessionProof`.
- iOS verification additionally requires `iosPortalProof`.

## Permissions

### Role Matrix

| Resource / Action | Visitor | Viewer | Operator | Admin | System Worker | Bridge | Scheduler |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Auth register/login | Yes | N/A | N/A | N/A | No | No | No |
| Read app shell and operational insight screens | No until login | Yes | Yes | Yes | No | No | No |
| Read devices/groups | No | Yes | Yes | Yes | Service-role only | No | Read target data only |
| Create/update devices/groups | No | No | Yes | Yes | Device sync only | No | No |
| Delete devices/groups | No | No | No by default | Yes | No | No | No |
| Read macros/versions | No | Yes | Yes | Yes | Read definitions | No | Read scheduled macro |
| Create/update/publish macros | No | No | Yes | Yes | No | No | No |
| Delete/archive macros | No | No | No by default | Yes | No | No | No |
| Launch workflow run | No | No | Yes | Yes | No | No | Create from schedule only |
| Cancel workflow run | No | No | Yes | Yes | Apply cancel signal | No | No |
| Claim/execute run | No | No | No | No | Yes | No | No |
| Resolve approvals | No | No | Yes | Yes | Request/pause only | No | No |
| Read approvals | No | Yes | Yes | Yes | Yes | No | No |
| Read own/permitted run artifacts | No | Yes | Yes | Yes | Create | No | No |
| Manage accounts | No | No | Yes | Yes | Read inputs/update history | No | No |
| Read analytics/fleet health/system monitor | No | Yes | Yes | Yes | No | No | No |
| Read pilot readiness reports | No | Yes | Yes | Yes | No | No | No |
| Submit pilot readiness reports | No | No | Yes | Yes | No | No | No |
| Review pilot readiness reports | No | No | No | Yes | No | No | No |
| Configure retry/backoff policy | No | No | No | Yes | No | No | No |
| View retry/backoff timeline | No | Yes | Yes | Yes | No | No | No |
| Configure target failure policy | No | No | No | Yes | No | No | No |
| View target failure decisions | No | Yes | Yes | Yes | No | No | No |
| View audit logs | No | No | Yes partial | Yes all | Create | No | No |
| Manage roles/profiles | No | No | No | Yes | No | No | No |
| Bridge protected endpoints | No | No direct | Via worker/tooling only | Via tooling only | Yes with token | Enforce token | No |

### Permission Functions To Keep Or Add

Existing:

- `canManageRuns(role)`
- `canManageApprovals(role)`
- `canManageMacros(role)`
- `canViewAuditLogs(role)`
- `canViewAllAuditLogs(role)`

Recommended additions:

- `canManageAccounts(role)`
- `canManageDevices(role)`
- `canDeleteAdminResources(role)`
- `canManageSchedules(role)`
- `canManageRoles(role)`
- `canUseBridgeDirectly(role)` should be false for browser users; bridge access should be token-controlled.
- `canCreateReadinessReports(role)`
- `canReviewReadinessReports(role)`

## Routes And Endpoints

### Frontend Routes

| Route | Purpose | Auth | Min role | Source use cases |
| --- | --- | --- | --- | --- |
| `/social-dashboard` | Account health and ops overview | Required | Viewer read, Operator actions | V-CAN, OP-CAN |
| `/runs` | List/create runs | Required | Viewer read, Operator create | V-CAN, OP-CAN |
| `/runs/:id` | Run detail, steps, artifacts | Required | Viewer read, Operator cancel | V-CAN, OP-CAN |
| `/runs/:runId/monitor` | Live monitor, approval/cancel affordances | Required | Viewer read, Operator actions | V-CAN, OP-CAN |
| `/approvals` | Approval queue | Required | Viewer read, Operator resolve | V-CAN, OP-CAN |
| `/devices` | Device and group management | Required | Viewer read, Operator manage, Admin delete | V-CAN, OP-CAN, AD-CAN |
| `/device-setup` | Runtime diagnostics and lock cleanup | Required | Viewer read, Operator recovery, Admin cleanup | OP-CAN, AD-CAN |
| `/mobile-mcp-orchestrator` | Direct Android fleet operations | Required | Operator/Admin | OP-CAN |
| `/macros` | Macro list/create/seed | Required | Viewer read, Operator manage | V-CAN, OP-CAN |
| `/macros/:id` | Macro detail/version JSON | Required | Viewer read, Operator manage | V-CAN, OP-CAN |
| `/accounts` | Account setup/import/delete/warm-up | Required | Viewer read, Operator manage | V-CAN, OP-CAN |
| `/accounts/:id` | Account detail/history/warm-up | Required | Viewer read, Operator manage | V-CAN, OP-CAN |
| `/schedules` | Workflow schedules | Required | Viewer read, Operator manage | OP-CAN, SCH-CAN |
| `/analytics` | Account analytics | Required | Viewer read | V-CAN |
| `/readiness` | Pilot readiness reports and admin review | Required | Viewer read, Operator submit, Admin review | VIEW-CAN, OP-CAN, AD-CAN |
| `/fleet-health` | Fleet health | Required | Viewer read | V-CAN |
| `/system-monitor` | System monitor | Required | Viewer read | V-CAN |
| `/audit-logs` | Audit trail | Required | Operator partial, Admin all | AD-CAN |

### Control And Service Endpoints

| Endpoint / Operation | Method | Auth | Role/service | Purpose |
| --- | --- | --- | --- | --- |
| Supabase Auth register/login | Supabase SDK | Public auth | Visitor | Create/login user. |
| Supabase table operations | Supabase SDK | RLS | Viewer/Operator/Admin | CRUD according to RLS. |
| `execute-run` Edge Function or browser fallback | POST / Supabase update | Auth | Operator/Admin | Queue run control. |
| Execution worker health | `GET /health` | Local/service | Runtime | Worker readiness. |
| Laixi gateway health/sessions/dispatch | HTTP | Local/service | Worker/gateway | Laixi compatibility path. |
| Mobile MCP `/health` | GET | Public health | Runtime | Reports bridge status/auth mode. |
| Mobile MCP `/devices` | GET | Bridge token unless insecure dev | Worker/tooling | List devices. |
| Mobile MCP `/devices/:serial/health` | GET | Bridge token unless insecure dev | Worker/tooling | Device health. |
| Mobile MCP `/devices/:serial/execute-step` | POST | Bridge token unless insecure dev | Worker | Execute step. |
| Mobile MCP `/devices/:serial/tools/call` | POST | Bridge token unless insecure dev | Worker/tooling | Bridge tool call. |

## Use Case Coverage Matrix

Legend:

- DM: data model.
- PM: permission.
- RT: route/endpoint.
- VH: validation/handler.

### Visitor

| ID | Use case | Coverage |
| --- | --- | --- |
| VIS-CAN-001 | Open app and see login/register | RT auth shell, VH unauth redirect. |
| VIS-CAN-002 | Register account and get default profile | DM `profiles`, RT Supabase Auth, VH registration error handling. |
| VIS-CAN-003 | Login with email/password | RT Supabase Auth, VH invalid credential handling. |
| VIS-CAN-004 | See login error message | VH auth error mapping. |

### Viewer

| ID | Use case | Coverage |
| --- | --- | --- |
| VIEW-CAN-001 | View Social Dashboard | DM `accounts`, `account_action_history`; PM viewer read; RT `/social-dashboard`. |
| VIEW-CAN-002 | View devices and groups | DM `devices`, `device_groups`; PM read; RT `/devices`. |
| VIEW-CAN-003 | View macros and versions | DM `macros`, `macro_versions`; PM read; RT `/macros`, `/macros/:id`. |
| VIEW-CAN-004 | View runs, steps, errors, artifacts | DM `workflow_runs`, `run_steps`, `artifacts`; PM read; RT run routes. |
| VIEW-CAN-005 | View approvals read-only | DM `approvals`; PM read-only; RT `/approvals`. |
| VIEW-CAN-006 | View accounts and history where allowed | DM `accounts`, `account_action_history`; PM read; RT `/accounts`. |
| VIEW-CAN-007 | View health/analytics screens | DM analytics/health tables; PM read; RT insight routes. |
| VIEW-CAN-008 | See read-only role notice | PM role helpers; VH UI notice. |
| VIEW-CAN-009 | View pilot readiness report summaries | DM `pilot_readiness_reports`; PM read; RT `/readiness`. |
| VIEW-CAN-010 | View readiness freshness status | DM `pilot_readiness_reports.evidence_json.verified_at`; VH `getReadinessEvidenceFreshness`; RT `/readiness`. |
| VIEW-CAN-011 | View analytics source label | VH `classifyAnalyticsSource`; RT `/analytics`. |
| VIEW-CAN-012 | View retry/backoff timeline read-only | DM `run_steps.output_json/error_json`; RT run detail/monitor. |

### Operator

| ID | Use case | Coverage |
| --- | --- | --- |
| OP-CAN-001 | View Social Dashboard for ops | DM accounts/history; RT `/social-dashboard`. |
| OP-CAN-002 | Add social account | DM `accounts`; PM operator create; RT `/accounts`; VH encryption validation. |
| OP-CAN-003 | Import accounts from CSV | DM `accounts`; RT CSV modal; VH row-level parser errors. |
| OP-CAN-004 | Start warm-up | DM account warm-up fields; RT account pages; VH role/update check. |
| OP-CAN-005 | View action history | DM `account_action_history`; RT account history panel. |
| OP-CAN-006 | Manage devices/groups | DM device tables; PM operator manage; RT `/devices`. |
| OP-CAN-007 | Sync Android devices from ADB | DM `devices`; endpoint script/service-role sync. |
| OP-CAN-008 | Create/load sample macros | DM macros/versions; PM operator manage; RT `/macros`. |
| OP-CAN-009 | Edit/publish macro versions | DM `macro_versions`; PM operator manage; RT `/macros/:id`. |
| OP-CAN-010 | Create workflow run for target types | DM `workflow_runs`; PM operator create; RT `/runs`; VH preflight. |
| OP-CAN-011 | Select account in run wizard | DM `accounts`; RT run wizard account step; VH blocked account rule. |
| OP-CAN-012 | Fill input variables | DM `input_variables_json`; RT run wizard; VH required inputs. |
| OP-CAN-013 | View preflight issues | VH run preflight; RT run wizard review. |
| OP-CAN-014 | Cancel running run | DM run status/cancel fields; PM manage runs; RT run detail/monitor. |
| OP-CAN-015 | Approve/reject checkpoints | DM `approvals`; PM manage approvals; RT `/approvals`. |
| OP-CAN-016 | Monitor run realtime | DM runs/steps/artifacts; RT monitor route. |
| OP-CAN-017 | Use Device Setup readiness checks | DM devices/locks; endpoints runtime health; RT `/device-setup`. |
| OP-CAN-018 | Use Mobile MCP Orchestrator | Bridge endpoints; PM operator; RT `/mobile-mcp-orchestrator`. |
| OP-CAN-019 | Manage schedules | DM `workflow_schedules`; PM operator manage; RT `/schedules`. |
| OP-CAN-020 | View analytics/fleet health | DM analytics/devices; RT insights. |
| OP-CAN-021 | Submit pilot readiness report | DM `pilot_readiness_reports`; PM operator create; RT `/readiness`; VH evidence scrub. |
| OP-CAN-022 | View go/no-go readiness evidence | DM `pilot_readiness_reports`; RT `/readiness`. |
| OP-CAN-023 | View readiness evidence freshness before review request | DM `pilot_readiness_reports.evidence_json.verified_at`; VH `getReadinessEvidenceFreshness`; RT `/readiness`. |
| OP-CAN-024 | View retry reason/attempt/delay/terminal reason | DM `run_steps`; RT run monitor/detail. |
| OP-CAN-025 | View target failure policy and decisions | DM `workflow_runs.summary_json`; RT run summary. |

### Admin

| ID | Use case | Coverage |
| --- | --- | --- |
| AD-CAN-001 | Do all operator use cases | PM admin inherits operator. |
| AD-CAN-002 | View all audit logs | DM `audit_logs`; PM admin all; RT `/audit-logs`. |
| AD-CAN-003 | Read profiles/roles | DM `profiles`; PM admin; future/admin tooling. |
| AD-CAN-004 | Update user roles | DM `profiles.role`; PM admin; RLS/check constraint. |
| AD-CAN-005 | Manage execution profiles | DM `execution_profiles`; PM admin; future/admin UI/tooling. |
| AD-CAN-006 | Delete admin-only resources | DM devices/macros/groups; PM admin delete. |
| AD-CAN-007 | Cleanup device locks | DM `device_locks`; PM admin/operator recovery. |
| AD-CAN-008 | Configure deployment/env secrets | Env/config, not app table. |
| AD-CAN-009 | Review verification reports | Docs/plans artifacts. |
| AD-CAN-010 | Decide insecure dev mode | Env/config policy. |
| AD-CAN-011 | Review pilot readiness reports in app | DM `pilot_readiness_reports`; PM admin review; RT `/readiness`; VH evidence gate. |
| AD-CAN-012 | Verify readiness only with fresh evidence | DM `pilot_readiness_reports.evidence_json.verified_at`; VH `verification.evidence_fresh`; RT `/readiness`. |
| AD-CAN-013 | Configure retry/backoff policy | DM `execution_profiles`; PM admin; RT `/admin/execution-profiles`; VH retry validation. |
| AD-CAN-014 | Configure target failure policy | DM `execution_profiles.target_failure_policy`; PM admin; RT `/admin/execution-profiles`; VH enum validation. |

### System Worker

| ID | Use case | Coverage |
| --- | --- | --- |
| WORK-CAN-001 | Claim queued runs | DM run claim/lease fields; worker claim coordinator. |
| WORK-CAN-002 | Renew lease/heartbeat | DM lease fields; worker loop. |
| WORK-CAN-003 | Resolve target devices | DM devices/groups/run selector; worker context loaders. |
| WORK-CAN-004 | Execute macro steps by backend | DM macro definition; worker backends. |
| WORK-CAN-005 | Persist run steps and artifacts | DM run_steps/artifacts; worker stores. |
| WORK-CAN-006 | Create approval requests | DM approvals; worker gate. |
| WORK-CAN-007 | Release ownership on WAITING_APPROVAL | DM run status/claim fields; worker finalization. |
| WORK-CAN-008 | Cancel run on signal | DM run status/cancel fields; worker cancellation checks. |
| WORK-CAN-009 | Enforce action budget | DM accounts/history; budget library. |
| WORK-CAN-010 | Record action history | DM `account_action_history`; worker record. |
| WORK-CAN-011 | Mark account blocked | DM accounts block fields; block detector. |
| WORK-CAN-012 | Aggregate result status | DM workflow_runs.summary_json/status; worker aggregator. |
| WORK-CAN-013 | Retry step by bounded backoff policy | DM `execution_profiles`, `run_steps.retry_count`; worker retry helper. |
| WORK-CAN-014 | Persist retry reason/timeline | DM `run_steps.output_json/error_json`; worker step persistence. |
| WORK-CAN-015 | Apply multi-target failure policy | DM `execution_profiles.target_failure_policy`; multi-target worker. |
| WORK-CAN-016 | Persist target failure decision | DM `workflow_runs.summary_json`; final run summary. |

### Mobile MCP Bridge

| ID | Use case | Coverage |
| --- | --- | --- |
| BR-CAN-001 | Expose health | RT `/health`; bridge server. |
| BR-CAN-002 | Expose devices list | RT `/devices`; bridge manager. |
| BR-CAN-003 | Execute Android basic steps | RT `/execute-step`; Android session handlers. |
| BR-CAN-004 | Execute step by serial | DM device serial; RT serial path. |
| BR-CAN-005 | Use ADB-first session | Bridge Android session config. |
| BR-CAN-006 | Optional Portal setup | Env `MOBILE_MCP_ENSURE_PORTAL_ON_SESSION`. |
| BR-CAN-007 | Report auth mode | RT `/health` response fields. |

### Scheduler

| ID | Use case | Coverage |
| --- | --- | --- |
| SCH-CAN-001 | Read active schedules | DM `workflow_schedules`; scheduler service. |
| SCH-CAN-002 | Compute next run | DM `next_run_at`; cron parser. |
| SCH-CAN-003 | Create queued run from schedule | DM `workflow_runs`; scheduler trigger. |
| SCH-CAN-004 | Update last/next run | DM schedule timestamps; scheduler trigger. |

## Anti-Use Case Enforcement Matrix

### Visitor Rules

| ID | Rule | Enforce layer |
| --- | --- | --- |
| VIS-NO-001 | Visitor cannot view internal app routes. | Auth guard + route redirect. |
| VIS-NO-002 | Visitor cannot create runs or send device commands. | Auth required + RLS/service auth. |
| VIS-NO-003 | Visitor cannot view artifacts/audit/approvals/account password. | Auth guard + RLS. |
| VIS-NO-004 | Visitor cannot assign own role. | DB RLS/checks on `profiles`. |

### Viewer Rules

| ID | Rule | Enforce layer |
| --- | --- | --- |
| VIEW-NO-001 | Viewer cannot launch runs. | UI preflight + RLS insert policy. |
| VIEW-NO-002 | Viewer cannot cancel runs. | Role helper + RLS/update policy. |
| VIEW-NO-003 | Viewer cannot resolve approvals. | Role helper + approvals update policy. |
| VIEW-NO-004 | Viewer cannot manage macros. | Role helper + macro RLS. |
| VIEW-NO-005 | Viewer cannot manage devices/groups/locks/execution profiles. | Role helper + RLS. |
| VIEW-NO-006 | Viewer cannot manage social accounts. | Role helper + accounts RLS. |
| VIEW-NO-007 | Viewer cannot view audit logs if audit access requires operator/admin. | Sidebar filter + RLS. |
| VIEW-NO-008 | Viewer cannot change user roles. | Admin-only profile policy. |
| VIEW-NO-009 | Viewer cannot submit or review pilot readiness reports. | `canCreateReadinessReports` / `canReviewReadinessReports` + RLS. |

### Operator Rules

| ID | Rule | Enforce layer |
| --- | --- | --- |
| OP-NO-001 | Operator cannot assign/revoke roles. | Admin-only profile policy. |
| OP-NO-002 | Operator cannot delete admin-only resources. | Delete policies/admin checks. |
| OP-NO-003 | Operator cannot view all audit logs if admin-only. | `canViewAllAuditLogs` + RLS. |
| OP-NO-004 | Operator cannot bypass approval for sensitive steps. | Worker approval gate. |
| OP-NO-005 | Operator cannot run with offline/locked/stale/invalid target. | Run preflight + worker lock. |
| OP-NO-006 | Operator cannot save account password without crypto key. | Account create/import validation. |
| OP-NO-007 | Operator cannot use protected bridge endpoints without token except explicit insecure local mode. | Bridge auth. |
| OP-NO-008 | Operator cannot execute `run_autox` through Mobile MCP V1. | Backend capability check. |
| OP-NO-009 | Operator cannot promise production-safe anti-detection. | Product copy/docs guardrail. |
| OP-NO-010 | Operator cannot mark pilot readiness verified. | Admin-only `readiness_reports.review` permission + service guard. |
| OP-NO-011 | Operator cannot bypass execution profile retry/backoff limits. | Worker uses loaded execution profile policy. |
| OP-NO-012 | Operator cannot failover to non-dispatchable targets. | Current v1 only skips or stops resolved dispatchable targets; no replacement rotation. |

### Admin Rules

| ID | Rule | Enforce layer |
| --- | --- | --- |
| AD-NO-001 | Admin cannot bypass Supabase Auth/RLS without service-role context. | Supabase auth boundary. |
| AD-NO-002 | Admin cannot read plaintext social passwords in UI. | Store encrypted only; no decrypt UI. |
| AD-NO-003 | Admin cannot guarantee social platform non-detection. | Product/docs guardrail. |
| AD-NO-004 | Admin cannot claim Laixi live proof without live session. | Verification/report gate. |
| AD-NO-005 | Admin cannot claim iOS automation without Portal + iproxy proof. | Verification/report gate. |
| AD-NO-006 | Admin cannot scale artifacts infinitely in DB rows. | Artifact threshold policy. |
| AD-NO-007 | Admin cannot treat pricing/billing as an MVP runtime route. | Route guard and product guardrail. |
| AD-NO-008 | Admin cannot mark readiness verified with missing proof. | `validateReadinessEvidence` gate. |
| AD-NO-009 | Admin cannot mark readiness verified with missing, invalid, or expired evidence timestamp. | `verification.evidence_fresh` gate. |
| AD-NO-010 | Admin cannot configure infinite/invalid retry. | Execution profile validation + DB constraints. |
| AD-NO-011 | Admin cannot configure unknown target failure behavior. | Execution profile validation + DB enum check. |

### System Worker Rules

| ID | Rule | Enforce layer |
| --- | --- | --- |
| WORK-NO-001 | Worker cannot claim run with invalid claim token/lease. | Claim coordinator + DB conditions. |
| WORK-NO-002 | Worker cannot execute on device locked by another run. | Device lock acquisition. |
| WORK-NO-003 | Worker cannot execute sensitive step before approval. | Approval gate. |
| WORK-NO-004 | Worker cannot provide production-grade server credential decryption yet. | Scope guardrail. |
| WORK-NO-005 | Worker cannot guarantee fleet parallel SLA on sequential path. | Product/backend capability guardrail. |
| WORK-NO-006 | Worker cannot execute unsupported backend step. | Backend capability check. |
| WORK-NO-007 | Worker cannot retry forever. | Retry helper stops at max retries or max elapsed. |
| WORK-NO-008 | Worker cannot hide original target failure after continuing or stopping. | Target failure decision records original error in summary. |

### Bridge Rules

| ID | Rule | Enforce layer |
| --- | --- | --- |
| BR-NO-001 | Bridge cannot allow protected endpoints without token unless insecure dev is explicit. | `_check_auth`. |
| BR-NO-002 | Bridge cannot execute iOS ADB-only steps. | Step handler platform checks. |
| BR-NO-003 | Bridge cannot install Portal when device policy blocks USB install. | Handler error + optional Portal env. |
| BR-NO-004 | Bridge cannot own social platform logic. | API boundary. |
| BR-NO-005 | Bridge cannot skip same-device serialization. | Session mutex. |

### Scheduler Rules

| ID | Rule | Enforce layer |
| --- | --- | --- |
| SCH-NO-001 | Scheduler cannot execute device steps directly. | Scheduler only creates queued runs. |
| SCH-NO-002 | Scheduler cannot bypass UI/RLS schedule ownership. | Schedule policies. |
| SCH-NO-003 | Scheduler cannot guarantee success when runtime/device/bridge offline. | Run status/preflight handling. |
| SCH-NO-004 | Scheduler cannot auto-approve sensitive steps. | Worker approval gate. |

## Error Handling Matrix

### Visitor Errors

| ID | Trigger | Handling |
| --- | --- | --- |
| VIS-ERR-001 | Wrong login credentials. | Show login error, stay on login. |
| VIS-ERR-002 | Open internal URL while logged out. | Redirect to login. |
| VIS-ERR-003 | Registration fails. | Show Supabase/auth error, no session. |
| VIS-ERR-004 | Auth/network unavailable. | Show safe error, no empty app. |

### Viewer Errors

| ID | Trigger | Handling |
| --- | --- | --- |
| VIEW-ERR-001 | Viewer tries launch run. | Blocking preflight issue. |
| VIEW-ERR-002 | Viewer tries approve/reject. | Read-only notice, no update. |
| VIEW-ERR-003 | Macro/run deleted while viewing. | Not found or empty state. |
| VIEW-ERR-004 | Artifact unreadable/too large. | Show metadata/error fallback. |
| VIEW-ERR-005 | RLS denies read. | Access error or safe empty state. |
| VIEW-ERR-006 | Analytics has no persisted rows. | Show `Insufficient data` source label and no health-good claim. |

### Operator Errors

| ID | Trigger | Handling |
| --- | --- | --- |
| OP-ERR-001 | CSV missing username/password/platform. | Row error, skip row. |
| OP-ERR-002 | CSV platform invalid. | Row error with allowed platforms. |
| OP-ERR-003 | Account encryption key missing/short. | Inline error, no insert. |
| OP-ERR-004 | Macro missing required input. | Preflight blocking issue. |
| OP-ERR-005 | Selected account blocked. | Block/caution in wizard/preflight. |
| OP-ERR-006 | Target offline/stale/locked. | Preflight blocker/device setup issue. |
| OP-ERR-007 | Runtime service unhealthy. | Preflight fail and report path. |
| OP-ERR-008 | Expected serial missing. | Wait/diagnose report with recovery hints. |
| OP-ERR-009 | Bridge token missing and insecure dev off. | Bridge returns 503. |
| OP-ERR-010 | Device step timeout. | `run_steps.status=FAILED`, `error_json.code=STEP_TIMEOUT`, log artifact. |
| OP-ERR-011 | Run waits for approval. | `WAITING_APPROVAL`, release ownership. |
| OP-ERR-012 | Approval expired/deleted/resolved. | Show invalid approval state, no duplicate update. |
| OP-ERR-013 | Cancel terminal run. | Idempotent no-op/current status message. |
| OP-ERR-014 | Readiness evidence contains secret-like keys. | Strip secret/token/password/apiKey-like keys before insert. |

### Admin Errors

| ID | Trigger | Handling |
| --- | --- | --- |
| AD-ERR-001 | Invalid role update. | DB check constraint / validation error. |
| AD-ERR-002 | Delete referenced resource. | FK or service validation blocks unsafe delete. |
| AD-ERR-003 | Missing service-role env. | Service/tooling error message. |
| AD-ERR-004 | Bridge token mismatch. | Bridge returns 401. |
| AD-ERR-005 | Insecure dev mode outside local. | Config risk; docs require rollback. |
| AD-ERR-006 | Artifact payload exceeds inline policy. | Omit inline preview or move to storage path. |
| AD-ERR-007 | Readiness verification lacks required evidence. | Reject `pilot_verified` with missing evidence list. |
| AD-ERR-008 | Readiness verification evidence is expired. | Reject `pilot_verified` and require rerun before review. |
| AD-ERR-009 | Retry/backoff profile is invalid. | Reject max retry/delay/max elapsed values before save. |
| AD-ERR-010 | Target failure policy invalid. | Reject values outside `fail_fast`/`skip_failed_target`. |

### Worker Errors

| ID | Trigger | Handling |
| --- | --- | --- |
| WORK-ERR-001 | Device lock not acquired. | Device result FAILED, code DEVICE_LOCKED. |
| WORK-ERR-002 | Step timeout. | Persist FAILED, code STEP_TIMEOUT. |
| WORK-ERR-003 | Backend bridge request fails. | Persist FAILED with bridge error. |
| WORK-ERR-004 | Run cancelled mid-sequence. | Persist CANCELLED, finalize accordingly. |
| WORK-ERR-005 | Approval pending. | Persist WAITING_APPROVAL, stop further steps. |
| WORK-ERR-006 | Worker crash/exception. | Finalize FAILED when claim still valid. |
| WORK-ERR-007 | Schedule table/env unavailable. | Log error, keep claim loop alive. |
| WORK-ERR-008 | Fail-fast policy sees a target failure. | Stop dispatching unstarted targets and record skipped count. |

### Bridge Errors

| ID | Trigger | Handling |
| --- | --- | --- |
| BR-ERR-001 | Protected endpoint missing token and insecure off. | Return 503. |
| BR-ERR-002 | Invalid token. | Return 401. |
| BR-ERR-003 | Serial offline/not found. | Return device/session error. |
| BR-ERR-004 | Invalid Android package. | Return invalid package error. |
| BR-ERR-005 | ADB/driver call fails. | Return `success=false` and message. |
| BR-ERR-006 | Screenshot fails. | Return failure, no fake artifact. |

### Scheduler Errors

| ID | Trigger | Handling |
| --- | --- | --- |
| SCH-ERR-001 | Schedule table missing from schema cache. | Log error, keep worker claim loop alive. |
| SCH-ERR-002 | Invalid cron/timezone. | Validation error, do not save schedule. |
| SCH-ERR-003 | Missing macro version. | Fail trigger, do not create broken run. |
| SCH-ERR-004 | Invalid target. | Preflight/worker blocks or fails safely. |

## Out-Of-Scope Guardrails

| ID | Guardrail | Enforce by |
| --- | --- | --- |
| OOS-001 | No macro/template marketplace. | Do not add marketplace tables/routes. |
| OOS-002 | No real billing/payment/subscription in MVP. | Do not add pricing, billing, payment, checkout, or subscription runtime routes. |
| OOS-003 | No public social network features. | Do not add user-facing like/share/follow graph. |
| OOS-004 | No real-time collaborative macro editing. | No collaboration tables/websocket scope. |
| OOS-005 | No anti-bot guarantee. | Product copy/docs guardrail. |
| OOS-006 | No production credential vault yet. | Server-side encryption is future work. |
| OOS-007 | No automatic social account creation/purchase. | Product guardrail. |
| OOS-008 | No default sensitive publish/post automation. | Review-gated explicit allow only. |
| OOS-009 | No Mobile MCP `run_autox` support in V1. | Backend capability check. |
| OOS-010 | No Laixi live readiness claim without proof. | Verification gate. |
| OOS-011 | No iOS readiness claim without Portal + iproxy proof. | Verification gate. |
| OOS-012 | No infinite DB artifact scaling. | Artifact threshold policy. |
| OOS-013 | No external customer sharing/export audit package in MVP. | Do not add sharing endpoints. |
| OOS-014 | No fleet parallel SLA. | Sequential pilot path remains acceptable. |
| OOS-015 | No native mobile app. | Web app only. |
| OOS-016 | No offline-first mode. | Supabase/runtime/device connectivity required. |

## No Orphan Design Check

| Proposed design item | Source |
| --- | --- |
| Existing tables only for MVP | VIS/VIEW/OP/AD/WORK/BR/SCH use cases. |
| Suggested permission helpers | Anti-use-case rules for viewer/operator/admin boundaries. |
| Existing frontend routes | Viewer/operator/admin use cases. |
| `/readiness` route and `pilot_readiness_reports` table | VIEW-CAN-009..010, OP-CAN-021..023, AD-CAN-011..012, VIEW/OP/AD readiness anti-use cases. |
| Analytics source classifier | VIEW-CAN-011 and VIEW-ERR-006. |
| Retry/backoff fields, helper, and timeline UI | VIEW-CAN-012, OP-CAN-024, AD-CAN-013, WORK-CAN-013..014, OP/AD/WORK retry anti-use cases. |
| Target failure policy field/helper and summary UI | OP-CAN-025, AD-CAN-014, WORK-CAN-015..016, target failure anti-use/error cases. |
| Mobile MCP bridge endpoints | Bridge and operator device orchestration use cases. |
| Edge/function/browser run control | Operator run launch/cancel use cases. |
| Artifact threshold policy | Admin no infinite DB artifacts + OOS-012. |
| Server-side credential vault | Future only, from AD-NO-002 and OOS-006. |
| Marketplace/billing/collaboration/native app/offline mode | Explicitly out of scope. |

## Implementation Plan After Approval

1. Add stable IDs to `docs/use-cases.md` so this spec and future tests can reference immutable source lines.
2. Add or update permission helpers in `src/lib/role-access.ts` for accounts, devices, schedules, roles, and admin deletes.
3. Audit Supabase RLS policies against the permission matrix and create migrations only for gaps.
4. Add route-level and component-level role guards where UI currently only hides actions.
5. Add validation tests for CSV import, account encryption key, run preflight, blocked account, target readiness, and bridge auth.
6. Add worker tests for device lock, approval wait/resume, unsupported backend steps, and terminal cancel idempotency.
7. Add bridge tests or smoke checks for missing token, invalid token, invalid package, offline serial, and screenshot failure.
8. Keep out-of-scope guardrails in docs and product copy; do not add tables/routes for out-of-scope items.
